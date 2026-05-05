import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSettings } from "@/lib/settings";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { uploadPicture, publishItem, getCategoryAttributes } from "@/lib/meli";
import { productsTable, supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req) {
  try {
    let { accountId, sku, title, price, stock, subline } = await req.json();
    sku = sku?.trim();

    if (!accountId || !sku || !title) {
      return NextResponse.json({ error: "Faltan parámetros obligatorios (accountId, sku, title)" }, { status: 400 });
    }

    // 1. Obtener Token
    const accessToken = await getValidAccessToken(accountId);

    // 2. Obtener Settings y Mapeo de Categoría
    const settings = getSettings();
    let categoryId = settings.categoryMap[subline] || settings.categoryMap["DEFAULT"];

    if (!categoryId) {
      console.log(`🔍 No hay mapeo para "${subline}", intentando predecir categoría para "${title}"...`);
      try {
        const predictRes = await fetch(`https://api.mercadolibre.com/sites/MLV/domain_discovery/search?q=${encodeURIComponent(title)}`);
        const predictData = await predictRes.json();
        if (Array.isArray(predictData) && predictData.length > 0 && predictData[0].category_id) {
          categoryId = predictData[0].category_id;
          console.log(`✅ Categoría predicha: ${categoryId} (${predictData[0].category_name})`);
        }
      } catch (predictErr) {
        console.error("❌ Error al predecir categoría:", predictErr);
      }
    }

    if (!categoryId) {
      return NextResponse.json({ 
        error: `No hay categoría mapeada para la sublínea "${subline}" y falló la predicción automática. Por favor configúrala en Ajustes.` 
      }, { status: 400 });
    }

    // 3. Buscar Fotos (Primero en Image Bank, luego Local)
    const picturePayloads = [];
    
    // Consulta al Image Bank en Supabase
    const { data: bankPhotos, error: bankError } = await supabaseAdmin
      .from('image_bank')
      .select('ml_picture_id, ml_url')
      .eq('sku', sku)
      .eq('sync_status', 'synced')
      .order('image_index', { ascending: true });

    if (!bankError && bankPhotos && bankPhotos.length > 0) {
      console.log(`🌐 Usando ${bankPhotos.length} fotos desde Image Bank para SKU ${sku}`);
      bankPhotos.forEach(p => {
        if (p.ml_picture_id) {
          picturePayloads.push({ id: p.ml_picture_id });
        } else if (p.ml_url) {
          picturePayloads.push({ source: p.ml_url });
        }
      });
    } else {
      // FALLBACK: Buscar y Subir Fotos Locales
      console.log(`🔍 No hay fotos en Image Bank para ${sku}, buscando en local...`);
      
      if (settings.photosPath && fs.existsSync(settings.photosPath)) {
        const allFiles = fs.readdirSync(settings.photosPath);
        const skuLower = sku.toLowerCase();

        const matchingFiles = allFiles.filter(f => {
          const base = f.split('.')[0].toLowerCase();
          if (base === skuLower) return true;
          const lastDashIndex = base.lastIndexOf('-');
          if (lastDashIndex !== -1) {
            const prefix = base.substring(0, lastDashIndex);
            const suffix = base.substring(lastDashIndex + 1);
            return prefix === skuLower && /^\d+$/.test(suffix);
          }
          return false;
        }).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, 10);

        if (matchingFiles.length > 0) {
          console.log(`📸 Detectadas ${matchingFiles.length} fotos locales para el SKU ${sku}`);
          const { uploadImageToStorage } = require("@/lib/supabase-admin");

          for (const fileName of matchingFiles) {
            const filePath = path.join(settings.photosPath, fileName);
            const buffer = fs.readFileSync(filePath);
            
            try {
              const picRes = await uploadPicture(buffer, fileName, accessToken);
              if (picRes.id) {
                picturePayloads.push({ id: picRes.id });
              }
            } catch (uploadErr) {
              try {
                const publicUrl = await uploadImageToStorage(buffer, fileName);
                picturePayloads.push({ source: publicUrl });
              } catch (supabaseErr) {
                console.error(`❌ Falló subida local para ${fileName}`);
              }
            }
          }
        }
      }
    }

    if (picturePayloads.length === 0) {
      return NextResponse.json({ 
        error: `No se encontraron fotos (ni en Image Bank ni locales) para el SKU "${sku}".` 
      }, { status: 400 });
    }

    // Validación estricta de precio mínimo
    const finalPrice = parseFloat(price);
    if (isNaN(finalPrice) || finalPrice < 2) {
      return NextResponse.json({ error: `El precio (${price}) es inválido. Mercado Libre exige un precio mínimo de 2 USD para esta categoría.` }, { status: 400 });
    }

    // 4. Obtener atributos obligatorios de la categoría
    const requiredAttributes = await getCategoryAttributes(categoryId);
    const dynamicAttributes = [
      { id: "SELLER_SKU", value_name: sku }
    ];

    // Inyectar Marca (BRAND) y Modelo si vienen del Excel
    if (brand) dynamicAttributes.push({ id: "BRAND", value_name: brand });
    
    // El código OEM suele ir en PART_NUMBER en autopartes
    if (oem) dynamicAttributes.push({ id: "PART_NUMBER", value_name: oem });

    // Inyectar atributos extra
    if (extraAttrs && Array.isArray(extraAttrs)) {
      extraAttrs.forEach(at => {
        if (!dynamicAttributes.find(da => da.id === at.id)) {
          dynamicAttributes.push({ id: at.id, value_name: at.value_name });
        }
      });
    }

    // Autocompletar atributos obligatorios con un valor por defecto si no existen
    for (const attr of requiredAttributes) {
      if (!dynamicAttributes.find(a => a.id === attr.id)) {
        let defaultValue = "Genérico";
        if (attr.values && attr.values.length > 0) {
          defaultValue = attr.values[0].name;
        }
        dynamicAttributes.push({
          id: attr.id,
          value_name: defaultValue
        });
      }
    }

    // Asegurar que la Marca (BRAND) siempre esté presente para Tiendas Oficiales
    if (!dynamicAttributes.find(a => a.id === "BRAND")) {
      dynamicAttributes.push({ id: "BRAND", value_name: "Genérico" });
    }

    // 4.5. Obtener el perfil del usuario para extraer el official_store_id (Obligatorio para Tiendas Oficiales)
    let officialStoreId = null;
    try {
      const userRes = await fetch('https://api.mercadolibre.com/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const userData = await userRes.json();
      
      // Intentar extraer de userData.brands (Estructura estándar de Tienda Oficial)
      if (userData.brands && Array.isArray(userData.brands) && userData.brands.length > 0) {
        // Buscamos el primer official_store_id válido en la lista de marcas
        const brandWithStore = userData.brands.find(b => b.official_store_id);
        if (brandWithStore) {
          officialStoreId = brandWithStore.official_store_id;
        }
      }
      
      if (officialStoreId) {
        console.log(`✅ Detectada Tienda Oficial ID: ${officialStoreId}`);
      }
    } catch (err) {
      console.warn("⚠️ No se pudo obtener el perfil del usuario para official_store_id:", err);
    }

    // 5. Construir Payload para Mercado Libre
    const mlPayload = {
      title: title,
      category_id: categoryId,
      price: finalPrice,
      currency_id: "USD", // Ajustar según necesidad o site_id
      available_quantity: stock,
      buying_mode: "buy_it_now",
      condition: "new",
      listing_type_id: "gold_special", // Clásica (ajustar si se prefiere Premium)
      pictures: picturePayloads,
      attributes: dynamicAttributes
    };

    // Si la cuenta es Tienda Oficial, inyectamos el ID
    if (officialStoreId) {
      mlPayload.official_store_id = Number(officialStoreId) || officialStoreId;
    }

    // Configuración de envíos (evitar advertencias de shipping modes en MLV)
    mlPayload.shipping = { mode: "not_specified" };

    // 5. Publicar en ML
    console.log(`🚀 Publicando SKU ${sku} en Mercado Libre...`);
    const publishRes = await publishItem(mlPayload, accessToken);

    // 6. Guardar en Supabase para sincronización inmediata
    const productData = {
      meli_item_id: publishRes.id,
      meli_account_id: accountId,
      title: publishRes.title,
      status: publishRes.status,
      price: publishRes.price,
      available_qty: publishRes.available_quantity,
      permalink: publishRes.permalink,
      thumbnail: publishRes.thumbnail,
      category_id: publishRes.category_id,
      sku: sku,
      raw_data: publishRes,
      updated_at: new Date()
    };

    await productsTable().upsert(productData, { onConflict: 'meli_item_id' });

    return NextResponse.json({ 
      success: true, 
      meli_id: publishRes.id,
      permalink: publishRes.permalink 
    });

  } catch (error) {
    console.error("❌ Error en Publicación:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
