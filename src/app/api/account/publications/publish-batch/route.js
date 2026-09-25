import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSettings } from "@/lib/settings";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import {
  publishItem,
  setItemDescription,
  getOfficialStoreId,
  getCategoryAttributes,
} from "@/lib/meli";
import { productsTable, supabaseAdmin } from "@/lib/supabase-admin";
import { enrichAutopartListing } from "@/lib/gemini";
import {
  formatSEOTitle,
  resolvePicturesForSku,
  resolveCategoryId,
  buildDynamicAttributes,
  loadPublishedSkuSet,
  buildDefaultDescription,
  injectVehiclePhoto,
} from "@/lib/publish-helpers";
import {
  getVehiclesForSku,
  resolveVehiclePicture,
  persistFitmentAfterPublish,
  generateCompatibilityText,
} from "@/lib/vehicle-catalog";
import {
  analyzeCompetitorsForListing,
  mergeLeaderInsights,
  validatePublishItem,
} from "@/lib/publication-quality-engine";

export const runtime = "nodejs";
export const maxDuration = 300;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      accountId,
      items,
      photosPath,
      listingTypeId = "gold_special",
      usePlaceholderIfNoPhoto = true,
      useAI = true,
      skipDuplicates = true,
      useCompetitorIntel = true,
      injectVehiclePhotos = true,
      preferLocalPhotos = false,
    } = body;

    if (!accountId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Parámetros inválidos. Se requiere accountId y una lista de items." },
        { status: 400 }
      );
    }

    const settings = getSettings();
    const effectivePhotosPath = (photosPath && photosPath.trim()) || settings.photosPath || "";
    const hasValidPhotosDir = effectivePhotosPath && fs.existsSync(effectivePhotosPath);

    const accessToken = await getValidAccessToken(accountId);
    const officialStoreId = await getOfficialStoreId(accessToken);

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (eventType, data) => {
      const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(payload));
    };

    (async () => {
      let totalSuccess = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      const startTime = Date.now();
      const categoryAttributesCache = new Map();

      let publishedSkuSet = new Set();
      if (skipDuplicates) {
        publishedSkuSet = await loadPublishedSkuSet(
          supabaseAdmin,
          accountId,
          items.map((it) => it.sku)
        );
      }

      await sendEvent("start", {
        total: items.length,
        photosPath: effectivePhotosPath,
        officialStoreId: officialStoreId || null,
        listingTypeId,
        skipDuplicates,
        useCompetitorIntel,
        injectVehiclePhotos,
        preferLocalPhotos,
        alreadyPublished: publishedSkuSet.size,
      });

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
          price,
        };

        if (!sku) {
          totalErrors++;
          await sendEvent("item_error", { ...itemEventData, error: "SKU vacío o inválido" });
          continue;
        }

        if (skipDuplicates && publishedSkuSet.has(sku.toUpperCase())) {
          totalSkipped++;
          await sendEvent("item_skipped", {
            ...itemEventData,
            reason: "SKU ya publicado en ML",
            skipReason: "duplicate",
          });
          continue;
        }

        if (isNaN(price) || price < 2) {
          totalErrors++;
          await sendEvent("item_error", {
            ...itemEventData,
            error: `Precio inválido ($${price}). Mercado Libre exige mínimo $2.00 USD.`,
          });
          continue;
        }

        const earlyValidation = validatePublishItem(
          { sku, title: rawTitle, price, stock },
          null,
          null
        );
        if (!earlyValidation.ok) {
          totalErrors++;
          await sendEvent("item_error", {
            ...itemEventData,
            error: earlyValidation.errors.join("; "),
          });
          continue;
        }

        try {
          let title = formatSEOTitle(rawTitle) || rawTitle;
          let effectivePrice = price;

          let {
            picturePayloads,
            photoSource,
            hasRealPhoto,
            matchingFiles,
          } = await resolvePicturesForSku({
            supabaseAdmin,
            sku,
            photosPath: effectivePhotosPath,
            localFiles,
            accessToken,
            usePlaceholderIfNoPhoto,
            preferLocalPhotos,
            maxPhotos: 6,
          });

          if (injectVehiclePhotos) {
            const vehicles = await getVehiclesForSku(supabaseAdmin, sku);
            if (vehicles.length > 0) {
              const vehiclePicture = await resolveVehiclePicture(
                supabaseAdmin,
                vehicles[0],
                { accessToken, photosPath: effectivePhotosPath }
              );
              if (vehiclePicture) {
                picturePayloads = injectVehiclePhoto(picturePayloads, vehiclePicture);
                await sendEvent("item_status", {
                  ...itemEventData,
                  status: `Foto de aplicación (${vehicles[0].make} ${vehicles[0].model}) insertada en posición 2`,
                });
              }
            }
          }

          if (photoSource === "local" && matchingFiles?.length) {
            await sendEvent("item_status", {
              ...itemEventData,
              status: `Subiendo ${matchingFiles.length} fotos locales...`,
            });
          } else if (photoSource === "image_bank") {
            await sendEvent("item_status", {
              ...itemEventData,
              status: `Usando ${picturePayloads.length} fotos del Banco de Imágenes...`,
            });
          }

          if (picturePayloads.length === 0) {
            totalSkipped++;
            await sendEvent("item_skipped", {
              ...itemEventData,
              reason: "No tiene foto en Banco de Imágenes ni en carpeta local y se eligió no usar imagen provisional.",
              skipReason: "no_photo",
            });
            continue;
          }

          const categoryId = await resolveCategoryId(supabaseAdmin, {
            subline,
            title,
            settings,
          });

          if (!categoryId) {
            totalErrors++;
            await sendEvent("item_error", {
              ...itemEventData,
              error: `No se encontró categoría para la sublínea '${subline}' ni por predicción de título.`,
            });
            continue;
          }

          const preflight = validatePublishItem(
            { sku, title, price: effectivePrice, stock },
            categoryId,
            picturePayloads
          );
          for (const w of preflight.warnings) {
            await sendEvent("item_status", {
              ...itemEventData,
              status: `⚠️ ${w}`,
            });
          }
          if (!preflight.ok) {
            totalErrors++;
            await sendEvent("item_error", {
              ...itemEventData,
              error: preflight.errors.join("; "),
            });
            continue;
          }

          if (!categoryAttributesCache.has(categoryId)) {
            categoryAttributesCache.set(
              categoryId,
              await getCategoryAttributes(categoryId)
            );
          }
          const requiredAttributes = categoryAttributesCache.get(categoryId);

          let extraAttrs = [];
          let competitorLeader = null;

          if (useCompetitorIntel) {
            await sendEvent("item_status", {
              ...itemEventData,
              status: "Analizando competencia (SERP + multiget)...",
            });

            const intel = await analyzeCompetitorsForListing({
              title,
              sku,
              subline,
              accountId,
              accessToken,
            });

            if (intel.ok && intel.leader) {
              competitorLeader = intel.leader;
              const preliminaryAttrs = [
                { id: "SELLER_SKU", value_name: sku },
                ...(brand ? [{ id: "BRAND", value_name: brand }] : []),
                ...(oem ? [{ id: "PART_NUMBER", value_name: oem }] : []),
              ];
              const merged = mergeLeaderInsights({
                ourTitle: title,
                ourPrice: effectivePrice,
                ourAttrs: preliminaryAttrs,
                leader: intel.leader,
              });

              title = merged.suggestedTitle || title;
              if (merged.suggestedPrice && merged.suggestedPrice >= 2) {
                effectivePrice = merged.suggestedPrice;
              }
              extraAttrs = merged.missingAttributes || [];

              await sendEvent("competitor_intel", {
                ...itemEventData,
                leader_id: intel.leader.id,
                leader_title: intel.leader.title,
                leader_price: intel.leader.price,
                leader_sold: intel.leader.sold_quantity,
                suggested_price: effectivePrice,
                suggested_title: title,
                title_keywords: merged.titleKeywords,
                attributes_added: extraAttrs.length,
                query: intel.query,
              });
            } else if (intel.error) {
              await sendEvent("item_status", {
                ...itemEventData,
                status: `Intel competencia omitida: ${intel.error}`,
              });
            }
          }

          const dynamicAttributes = buildDynamicAttributes({
            requiredAttributes,
            sku,
            brand,
            oem,
            extraAttrs,
          });

          let itemDescriptionText = buildDefaultDescription({
            title,
            sku,
            brand,
            oem,
          });

          if (useAI) {
            await sendEvent("item_status", {
              ...itemEventData,
              status: "Enriqueciendo ficha técnica con Gemini IA...",
            });
            const aiRes = await enrichAutopartListing({ sku, title, brand, oem, subline });
            if (aiRes?.description) {
              itemDescriptionText = aiRes.description;
            }
          }

          const fitmentVehicles = await getVehiclesForSku(supabaseAdmin, sku);
          if (fitmentVehicles.length > 0) {
            itemDescriptionText += generateCompatibilityText(fitmentVehicles);
          }

          const mlPayload = {
            title,
            category_id: categoryId,
            price: effectivePrice,
            currency_id: "USD",
            available_quantity: stock,
            buying_mode: "buy_it_now",
            condition: "new",
            listing_type_id: listingTypeId,
            pictures: picturePayloads,
            attributes: dynamicAttributes,
            shipping: { mode: "not_specified" },
          };

          if (officialStoreId) {
            mlPayload.official_store_id = Number(officialStoreId) || officialStoreId;
          }

          await sendEvent("item_status", {
            ...itemEventData,
            status: "Creando publicación en Mercado Libre...",
          });

          const publishRes = await publishItem(mlPayload, accessToken);

          if (publishRes?.id) {
            const fitmentResult = await persistFitmentAfterPublish({
              supabase: supabaseAdmin,
              meliItemId: publishRes.id,
              productId: null,
              vehicles: fitmentVehicles,
              accessToken,
              description: itemDescriptionText,
            });

            if (fitmentResult.compatText) {
              itemDescriptionText += fitmentResult.compatText;
            }

            await setItemDescription(publishRes.id, itemDescriptionText, accessToken);

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
              sku,
              raw_data: {
                ...publishRes,
                photo_status: hasRealPhoto ? "real" : "placeholder",
                photo_source: photoSource,
                published_via: "api_batch",
                competitor_leader_id: competitorLeader?.id || null,
                fitment_ml_api: fitmentResult.mlApiOk,
                fitment_db_stored: fitmentResult.dbStored,
              },
              updated_at: new Date(),
            };

            await productsTable().upsert(productRecord, { onConflict: "meli_item_id" });

            publishedSkuSet.add(sku.toUpperCase());

            totalSuccess++;
            await sendEvent("item_success", {
              ...itemEventData,
              meli_id: publishRes.id,
              permalink: publishRes.permalink,
              hasLocalPhoto: hasRealPhoto,
              photoSource,
              title: publishRes.title,
              price: effectivePrice,
              competitor_leader_id: competitorLeader?.id || null,
            });
          } else {
            throw new Error("No se recibió ID de publicación de Mercado Libre.");
          }
        } catch (err) {
          totalErrors++;
          console.error(`❌ Error publicando SKU ${sku}:`, err.message);
          await sendEvent("item_error", {
            ...itemEventData,
            error: err.message || "Error desconocido al publicar en Mercado Libre",
          });
        }

        await sleep(400);
      }

      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
      await sendEvent("complete", {
        total: items.length,
        totalSuccess,
        totalSkipped,
        totalErrors,
        elapsedSeconds,
      });

      await writer.close();
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("❌ Error en Batch Publisher Route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
