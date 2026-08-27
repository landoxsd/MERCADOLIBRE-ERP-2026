import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSettings } from "@/lib/settings";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { uploadPicture, publishItem, setItemDescription, getOfficialStoreId, getCategoryAttributes } from "@/lib/meli";
import { productsTable, supabaseAdmin } from "@/lib/supabase-admin";
import { enrichAutopartListing } from "@/lib/gemini";

// Helper de diccionario de abreviaturas para títulos SEO
const ABBREVIATIONS = {
  'AMORT.': 'AMORTIGUADOR', 'AMORT': 'AMORTIGUADOR',
  'DEL.': 'DELANTERO', 'DEL': 'DELANTERO', 'DELT.': 'DELANTERO', 'DELT': 'DELANTERO',
  'TRAS.': 'TRASERO', 'TRAS': 'TRASERO', 'TRST.': 'TRASERO', 'TRST': 'TRASERO',
  'IZQ.': 'IZQUIERDO', 'IZQ': 'IZQUIERDO',
  'DER.': 'DERECHO', 'DER': 'DERECHO',
  'SUP.': 'SUPERIOR', 'SUP': 'SUPERIOR',
  'INF.': 'INFERIOR', 'INF': 'INFERIOR',
  'PAST.': 'PASTILLAS', 'PAST': 'PASTILLAS',
  'BOMB.': 'BOMBA', 'BOMB': 'BOMBA',
  'BUJ.': 'BUJE', 'BUJ': 'BUJE',
  'ROT.': 'ROTULA', 'ROT': 'ROTULA',
  'TERM.': 'TERMINAL', 'TERM': 'TERMINAL',
  'KIT.': 'KIT', 'KIT': 'KIT',
  'EMP.': 'EMPACADURA', 'EMP': 'EMPACADURA',
  'ESTOP.': 'ESTOPERA', 'ESTOP': 'ESTOPERA',
  'ROD.': 'RODAMIENTO', 'ROD': 'RODAMIENTO',
  'FILT.': 'FILTRO', 'FILT': 'FILTRO',
  'VALV.': 'VALVULA', 'VALV': 'VALVULA',
  'CHEV.': 'CHEVROLET', 'CHEV': 'CHEVROLET', 'CHEVY': 'CHEVROLET',
  'TOY.': 'TOYOTA', 'TOY': 'TOYOTA',
  'MIT.': 'MITSUBISHI', 'MIT': 'MITSUBISHI',
  'HYU.': 'HYUNDAI', 'HYU': 'HYUNDAI',
  'FOR.': 'FORD', 'FOR': 'FORD',
  'MAZ.': 'MAZDA', 'MAZ': 'MAZDA',
  'REN.': 'RENAULT', 'REN': 'RENAULT',
  'CIL.': 'CILINDRO', 'CIL': 'CILINDRO',
  'MULT.': 'MULTIPLE', 'MULT': 'MULTIPLE',
  'CREM.': 'CREMALLERA', 'CREM': 'CREMALLERA'
};

function formatSEOTitle(rawTitle) {
  if (!rawTitle) return '';
  let seoTitle = String(rawTitle).toUpperCase();
  
  const sortedKeys = Object.keys(ABBREVIATIONS).sort((a, b) => b.length - a.length);
  const escapedKeys = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`\\b(${escapedKeys.join('|')})(?=\\.|\\s|$)`, 'gi');
  
  seoTitle = seoTitle.replace(regex, (matched) => {
    const upperMatched = matched.toUpperCase();
    return ABBREVIATIONS[upperMatched] || ABBREVIATIONS[upperMatched + '.'] || matched;
  });

  seoTitle = seoTitle
    .replace(/[,()]/g, " ")
    .replace(/\.([A-Z])/g, " $1")
    .replace(/\./g, " ")
    .replace(/\b(DE|LA|EL|LOS|LAS|CON|PARA|DEL)\b/gi, "")
    .replace(/NUEVO|OFERTA|PROMO|BARATO|ENVIO GRATIS|EXCELENTE|GARANTIZADO|ORIGINAL|REEMPLAZO/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  
  let finalTitle = seoTitle.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  if (finalTitle.length > 60) {
    let truncated = finalTitle.substring(0, 60);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 45) {
      truncated = truncated.substring(0, lastSpace);
    }
    return truncated.trim();
  }

  return finalTitle;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fallback oficial de imagen si no tiene foto local y se permite placeholder
const OFFICIAL_STORE_PLACEHOLDER = "https://http2.mlstatic.com/D_NQ_NP_918237-MLV52098675124_102022-O.webp";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      accountId,
      items, // Array de { sku, title, price, stock, subline, brand, oem }
      photosPath, // Carpeta en disco local indicada por el usuario
      listingTypeId = "gold_special", // "gold_special" (Clásica) o "gold_pro" (Premium)
      usePlaceholderIfNoPhoto = true,
      useAI = true
    } = body;

    if (!accountId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Parámetros inválidos. Se requiere accountId y una lista de items." }, { status: 400 });
    }

    const settings = getSettings();
    const effectivePhotosPath = (photosPath && photosPath.trim()) || settings.photosPath || "";
    const hasValidPhotosDir = effectivePhotosPath && fs.existsSync(effectivePhotosPath);

    // 1. Obtener Token y Tienda Oficial
    const accessToken = await getValidAccessToken(accountId);
    const officialStoreId = await getOfficialStoreId(accessToken);

    // Preparar Stream SSE para respuesta en tiempo real
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (eventType, data) => {
      const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(payload));
    };

    // Procesar en segundo plano dentro del stream
    (async () => {
      let totalSuccess = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      const startTime = Date.now();

      await sendEvent("start", {
        total: items.length,
        photosPath: effectivePhotosPath,
        officialStoreId: officialStoreId || null,
        listingTypeId
      });

      // Cache en memoria de archivos locales para evitar escaneos repetitivos de disco
      let localFiles = [];
      if (hasValidPhotosDir) {
        try {
          localFiles = fs.readdirSync(effectivePhotosPath);
        } catch (e) {
          console.error("Error leyendo directorio de fotos:", e.message);
        }
      }

      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const sku = String(item.sku || "").trim();
        const rawTitle = item.title || "";
        const price = parseFloat(item.price);
        const stock = parseInt(item.stock, 10) || 1;
        const subline = String(item.subline || "").trim();
        const brand = item.brand || "Original";
        const oem = item.oem || "";

        const itemEventData = {
          index: index + 1,
          total: items.length,
          sku,
          rawTitle,
          price
        };

        if (!sku) {
          totalErrors++;
          await sendEvent("item_error", { ...itemEventData, error: "SKU vacío o inválido" });
          continue;
        }

        // Validación de precio mínimo de Mercado Libre (2 USD)
        if (isNaN(price) || price < 2) {
          totalErrors++;
          await sendEvent("item_error", { ...itemEventData, error: `Precio inválido ($${price}). Mercado Libre exige mínimo $2.00 USD.` });
          continue;
        }

        try {
          // A. Escaneo y Subida de Fotos Locales
          const picturePayloads = [];
          let hasLocalPhoto = false;

          if (hasValidPhotosDir && localFiles.length > 0) {
            const skuLower = sku.toLowerCase();
            const matchingFiles = localFiles.filter(f => {
              const base = f.split('.')[0].toLowerCase();
              if (base === skuLower) return true;
              const lastDashIndex = base.lastIndexOf('-');
              if (lastDashIndex !== -1) {
                const prefix = base.substring(0, lastDashIndex);
                const suffix = base.substring(lastDashIndex + 1);
                return prefix === skuLower && /^\d+$/.test(suffix);
              }
              return false;
            }).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, 6);

            if (matchingFiles.length > 0) {
              hasLocalPhoto = true;
              await sendEvent("item_status", { ...itemEventData, status: `Subiendo ${matchingFiles.length} fotos locales...` });

              for (const fileName of matchingFiles) {
                try {
                  const filePath = path.join(effectivePhotosPath, fileName);
                  const buffer = fs.readFileSync(filePath);
                  const picRes = await uploadPicture(buffer, fileName, accessToken);
                  if (picRes && picRes.id) {
                    picturePayloads.push({ id: picRes.id });
                  }
                } catch (picErr) {
                  console.warn(`⚠️ Error subiendo foto local ${fileName}:`, picErr.message);
                }
              }
            }
          }

          // Si no tiene foto local
          if (picturePayloads.length === 0) {
            if (!usePlaceholderIfNoPhoto) {
              totalSkipped++;
              await sendEvent("item_skipped", {
                ...itemEventData,
                reason: "No tiene foto en la carpeta local y se eligió no usar imagen provisional."
              });
              continue;
            } else {
              // Inyectar placeholder oficial
              picturePayloads.push({ source: OFFICIAL_STORE_PLACEHOLDER });
            }
          }

          // B. Título SEO
          const title = formatSEOTitle(rawTitle) || rawTitle;

          // C. Categoría ML
          let categoryId = null;
          if (subline) {
            const { data: mapping } = await supabaseAdmin
              .from('category_mappings')
              .select('ml_category_id')
              .ilike('internal_name', subline)
              .limit(1)
              .single();

            if (mapping && mapping.ml_category_id) {
              categoryId = mapping.ml_category_id;
            }
          }

          if (!categoryId && settings.categoryMap && settings.categoryMap[subline]) {
            categoryId = settings.categoryMap[subline];
          }

          // Fallback domain discovery
          if (!categoryId) {
            try {
              const predictRes = await fetch(`https://api.mercadolibre.com/sites/MLV/domain_discovery/search?q=${encodeURIComponent(title)}`);
              const predictData = await predictRes.json();
              if (Array.isArray(predictData) && predictData.length > 0 && predictData[0].category_id) {
                categoryId = predictData[0].category_id;
              }
            } catch (e) {
              console.warn("Error prediciendo categoría:", e.message);
            }
          }

          if (!categoryId) {
            totalErrors++;
            await sendEvent("item_error", { ...itemEventData, error: `No se encontró categoría para la sublínea '${subline}' ni por predicción de título.` });
            continue;
          }

          // D. Atributos Técnicos
          const requiredAttributes = await getCategoryAttributes(categoryId);
          const dynamicAttributes = [
            { id: "SELLER_SKU", value_name: sku }
          ];

          if (brand) dynamicAttributes.push({ id: "BRAND", value_name: brand });
          else dynamicAttributes.push({ id: "BRAND", value_name: "Genérico" });

          if (oem) dynamicAttributes.push({ id: "PART_NUMBER", value_name: oem });

          for (const attr of requiredAttributes) {
            if (!dynamicAttributes.find(a => a.id === attr.id)) {
              let defaultValue = "Genérico";
              if (attr.id === "VEHICLE_TYPE" || attr.name?.toLowerCase().includes("vehículo")) defaultValue = "Auto/Camioneta";
              else if (attr.id === "UNITS_PER_PACKAGE") defaultValue = "1";
              else if (attr.id === "IS_OEM") defaultValue = oem ? "Sí" : "No";
              
              dynamicAttributes.push({ id: attr.id, value_name: defaultValue });
            }
          }

          // E. Enriquecimiento con Gemini AI
          let itemDescriptionText = `¡BIENVENIDOS A NUESTRA TIENDA OFICIAL!\n\nPRODUCTO: ${title}\nSKU: ${sku}\nMARCA: ${brand}\nOEM: ${oem || 'N/A'}\n\n- Repuesto nuevo garantizado.\n- Envíos a nivel nacional.\n- Garantía de 90 días por defectos de fábrica.`;

          if (useAI) {
            await sendEvent("item_status", { ...itemEventData, status: "Enriqueciendo ficha técnica con Gemini IA..." });
            const aiRes = await enrichAutopartListing({ sku, title, brand, oem, subline });
            if (aiRes && aiRes.description) {
              itemDescriptionText = aiRes.description;
            }
          }

          // F. Armar Payload de Publicación
          const mlPayload = {
            title,
            category_id: categoryId,
            price,
            currency_id: "USD",
            available_quantity: stock,
            buying_mode: "buy_it_now",
            condition: "new",
            listing_type_id: listingTypeId,
            pictures: picturePayloads,
            attributes: dynamicAttributes,
            shipping: { mode: "not_specified" }
          };

          if (officialStoreId) {
            mlPayload.official_store_id = Number(officialStoreId) || officialStoreId;
          }

          // G. Publicar en Mercado Libre
          await sendEvent("item_status", { ...itemEventData, status: "Creando publicación en Mercado Libre..." });
          const publishRes = await publishItem(mlPayload, accessToken);

          if (publishRes && publishRes.id) {
            // Adjuntar descripción
            await setItemDescription(publishRes.id, itemDescriptionText, accessToken);

            // H. Guardar en Supabase
            const productRecord = {
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
              raw_data: {
                ...publishRes,
                photo_status: hasLocalPhoto ? "real" : "placeholder",
                published_via: "api_batch"
              },
              updated_at: new Date()
            };

            await productsTable().upsert(productRecord, { onConflict: "meli_item_id" });

            totalSuccess++;
            await sendEvent("item_success", {
              ...itemEventData,
              meli_id: publishRes.id,
              permalink: publishRes.permalink,
              hasLocalPhoto,
              title: publishRes.title
            });
          } else {
            throw new Error("No se recibió ID de publicación de Mercado Libre.");
          }

        } catch (err) {
          totalErrors++;
          console.error(`❌ Error publicando SKU ${sku}:`, err.message);
          await sendEvent("item_error", {
            ...itemEventData,
            error: err.message || "Error desconocido al publicar en Mercado Libre"
          });
        }

        // Pausa preventiva de 400ms para cuidar límites de API
        await sleep(400);
      }

      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
      await sendEvent("complete", {
        total: items.length,
        totalSuccess,
        totalSkipped,
        totalErrors,
        elapsedSeconds
      });

      await writer.close();
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      }
    });

  } catch (error) {
    console.error("❌ Error en Batch Publisher Route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
