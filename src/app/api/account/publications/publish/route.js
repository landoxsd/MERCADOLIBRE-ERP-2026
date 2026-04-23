import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSettings } from "@/lib/settings";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { uploadPicture, publishItem } from "@/lib/meli";
import { productsTable } from "@/lib/supabase-admin";

export async function POST(req) {
  try {
    const { accountId, sku, title, price, stock, subline } = await req.json();

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

    // 3. Buscar y Subir Fotos Locales
    if (!settings.photosPath || !fs.existsSync(settings.photosPath)) {
      return NextResponse.json({ error: "Ruta de fotos no configurada o inaccesible." }, { status: 400 });
    }

    const allFiles = fs.readdirSync(settings.photosPath);
    const normalizedSku = sku.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const cleanSku = sku.replace(/^0+/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

    // Encontrar archivos que coincidan con el SKU (máximo 5 para empezar)
    const matchingFiles = allFiles.filter(f => {
      const base = f.split('.')[0].toLowerCase().replace(/[^a-z0-9]/gi, '');
      return base === normalizedSku || 
             base.startsWith(`${normalizedSku}-`) || 
             (cleanSku && base === cleanSku) ||
             (cleanSku && base.startsWith(`${cleanSku}-`));
    }).slice(0, 5);

    if (matchingFiles.length === 0) {
      return NextResponse.json({ error: "No se encontraron fotos locales para este SKU." }, { status: 400 });
    }

    console.log(`📸 Subiendo ${matchingFiles.length} fotos para el SKU ${sku}...`);
    const pictureIds = [];
    for (const fileName of matchingFiles) {
      const filePath = path.join(settings.photosPath, fileName);
      const buffer = fs.readFileSync(filePath);
      const picRes = await uploadPicture(buffer, fileName, accessToken);
      if (picRes.id) pictureIds.push({ id: picRes.id });
    }

    // 4. Construir Payload para Mercado Libre
    const mlPayload = {
      title: title,
      category_id: categoryId,
      price: price,
      currency_id: "USD", // Ajustar según necesidad o site_id
      available_quantity: stock,
      buying_mode: "buy_it_now",
      condition: "new",
      listing_type_id: "gold_special", // Clásica (ajustar si se prefiere Premium)
      pictures: pictureIds,
      attributes: [
        { id: "SELLER_SKU", value_name: sku },
        { id: "BRAND", value_name: "Generic" }, // Idealmente vendría del Excel
      ]
    };

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
