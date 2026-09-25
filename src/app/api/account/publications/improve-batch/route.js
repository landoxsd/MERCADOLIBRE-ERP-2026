import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { getItemsBatch } from "@/lib/meli";
import { productsTable } from "@/lib/supabase-admin";
import {
  analyzeCompetitorsForListing,
  mergeLeaderInsights,
} from "@/lib/publication-quality-engine";

export const runtime = "nodejs";
export const maxDuration = 300;

const MELI_BASE_URL = "https://api.mercadolibre.com";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSafePriceUpdate(currentPrice, suggestedPrice) {
  const current = parseFloat(currentPrice);
  const suggested = parseFloat(suggestedPrice);
  if (isNaN(suggested) || suggested < 2) return false;
  if (isNaN(current) || current <= 0) return true;
  const ratio = suggested / current;
  return ratio >= 0.8 && ratio <= 1.2;
}

async function updateMeliItem(itemId, updates, accessToken) {
  const res = await fetch(`${MELI_BASE_URL}/items/${itemId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const causes = errData.cause?.map((c) => c.message).join(", ") || "";
    throw new Error(`${errData.message || "Error ML PUT"}${causes ? ` (${causes})` : ""}`);
  }

  return res.json();
}

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      accountId,
      itemIds,
      useCompetitorIntel = true,
      applyChanges = false,
    } = body;

    if (!accountId || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: "Parámetros inválidos. Se requiere accountId y itemIds[]." },
        { status: 400 }
      );
    }

    const accessToken = await getValidAccessToken(accountId);

    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (eventType, data) => {
      const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(payload));
    };

    (async () => {
      let totalImproved = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      const startTime = Date.now();

      await sendEvent("start", {
        total: itemIds.length,
        useCompetitorIntel,
        applyChanges,
      });

      for (let index = 0; index < itemIds.length; index++) {
        const itemId = itemIds[index];
        const itemEventData = { index: index + 1, total: itemIds.length, itemId };

        try {
          const [ourItem] = await getItemsBatch([itemId], accessToken);
          if (!ourItem?.id) {
            totalErrors++;
            await sendEvent("item_error", {
              ...itemEventData,
              error: "No se pudo obtener el ítem de Mercado Libre",
            });
            continue;
          }

          await sendEvent("item_status", {
            ...itemEventData,
            sku: ourItem.seller_custom_field || ourItem.id,
            title: ourItem.title,
            status: "Analizando publicación existente...",
          });

          if (!useCompetitorIntel) {
            totalSkipped++;
            await sendEvent("item_skipped", {
              ...itemEventData,
              reason: "Inteligencia competitiva desactivada",
            });
            continue;
          }

          const intel = await analyzeCompetitorsForListing({
            title: ourItem.title,
            sku: ourItem.seller_custom_field,
            subline: null,
            accountId,
            accessToken,
          });

          if (!intel.ok || !intel.leader) {
            totalSkipped++;
            await sendEvent("item_skipped", {
              ...itemEventData,
              reason: intel.error || "Sin competidor líder",
            });
            continue;
          }

          const merged = mergeLeaderInsights({
            ourTitle: ourItem.title,
            ourPrice: ourItem.price,
            ourAttrs: ourItem.attributes || [],
            leader: intel.leader,
          });

          await sendEvent("competitor_intel", {
            ...itemEventData,
            leader_id: intel.leader.id,
            leader_title: intel.leader.title,
            leader_price: intel.leader.price,
            leader_sold: intel.leader.sold_quantity,
            suggested_title: merged.suggestedTitle,
            suggested_price: merged.suggestedPrice,
            title_keywords: merged.titleKeywords,
            attributes_added: merged.missingAttributes?.length || 0,
            query: intel.query,
          });

          const changes = [];
          const updates = {};

          if (
            merged.suggestedTitle &&
            merged.suggestedTitle !== ourItem.title &&
            merged.suggestedTitle.length <= 60
          ) {
            changes.push({
              field: "title",
              from: ourItem.title,
              to: merged.suggestedTitle,
            });
            updates.title = merged.suggestedTitle;
          }

          if (merged.missingAttributes?.length > 0) {
            changes.push({
              field: "attributes",
              added: merged.missingAttributes,
            });
            updates.attributes = merged.missingAttributes;
          }

          if (isSafePriceUpdate(ourItem.price, merged.suggestedPrice)) {
            const rounded = Math.round(merged.suggestedPrice * 100) / 100;
            if (rounded !== ourItem.price) {
              changes.push({
                field: "price",
                from: ourItem.price,
                to: rounded,
              });
              updates.price = rounded;
            }
          }

          if (changes.length === 0) {
            totalSkipped++;
            await sendEvent("item_skipped", {
              ...itemEventData,
              reason: "Sin mejoras aplicables",
            });
            continue;
          }

          if (!applyChanges) {
            totalImproved++;
            await sendEvent("item_preview", {
              ...itemEventData,
              changes,
              dryRun: true,
            });
            continue;
          }

          await sendEvent("item_status", {
            ...itemEventData,
            status: `Aplicando ${changes.length} mejora(s)...`,
          });

          const updated = await updateMeliItem(itemId, updates, accessToken);

          await productsTable()
            .update({
              title: updated.title,
              price: updated.price,
              updated_at: new Date().toISOString(),
            })
            .eq("meli_item_id", itemId);

          totalImproved++;
          await sendEvent("item_improved", {
            ...itemEventData,
            changes,
            title: updated.title,
            price: updated.price,
          });
        } catch (err) {
          totalErrors++;
          console.error(`❌ Error mejorando ${itemId}:`, err.message);
          await sendEvent("item_error", {
            ...itemEventData,
            error: err.message || "Error desconocido",
          });
        }

        await sleep(500);
      }

      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
      await sendEvent("complete", {
        total: itemIds.length,
        totalImproved,
        totalSkipped,
        totalErrors,
        applyChanges,
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
    console.error("❌ Error en improve-batch:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
