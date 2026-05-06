// ================================================================
// POST /api/tools/sniper/analyze
// Búsqueda de competidores + enriquecimiento multiget + scraping MLV
// ================================================================
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import {
    processSnapshot,
    fetchItemDescription,
    fetchItemPerformance,
    sortBySoldQuantity,
    chunkArray,
    detectAnalysisMode,
} from "@/lib/sniper-helpers";

const MELI_BASE_URL = "https://api.mercadolibre.com";
const MLV_SITE_ID = "MLV";

export async function POST(request) {
    try {
        const { query, sku, ourItemId, accountId, categoryId, rawSearchResults } = await request.json();

        if (!query || query.trim().length === 0) {
            return NextResponse.json({ error: "Query requerida" }, { status: 400 });
        }

        const batchId = crypto.randomUUID();
        const normalizedQuery = query.trim();

        // ------------------------------------------------------------------
        // 0. OBTENER TOKEN (la búsqueda desde servidores cloud requiere auth)
        // ------------------------------------------------------------------
        let resolvedAccountId = accountId;
        let accessToken = null;

        // Si no hay accountId, buscar la primera cuenta disponible
        let clientId = null;
        if (!resolvedAccountId) {
            try {
                const { data: firstAccount } = await supabaseAdmin
                    .from("meli_accounts")
                    .select("id, client_id")
                    .limit(1)
                    .single();
                if (firstAccount) {
                    resolvedAccountId = firstAccount.id;
                    clientId = firstAccount.client_id;
                }
            } catch {
                // Silencioso
            }
        } else {
            // Obtener client_id de la cuenta proporcionada
            try {
                const { data: acc } = await supabaseAdmin
                    .from("meli_accounts")
                    .select("client_id")
                    .eq("id", resolvedAccountId)
                    .single();
                if (acc) clientId = acc.client_id;
            } catch {
                // Silencioso
            }
        }

        if (resolvedAccountId) {
            try {
                accessToken = await getValidAccessToken(resolvedAccountId);
                console.log(`✅ Token obtenido para cuenta ${resolvedAccountId}`);
            } catch (err) {
                console.warn("❌ No se pudo obtener token:", err.message);
            }
        } else {
            console.warn("⚠️ No hay accountId ni cuentas en DB. Búsqueda sin autenticación.");
        }

        // ------------------------------------------------------------------
        // 1. BÚSQUEDA POR RELEVANCIA
        // ------------------------------------------------------------------
        let rawResults = [];

        if (rawSearchResults && Array.isArray(rawSearchResults) && rawSearchResults.length > 0) {
            // Usar resultados enviados desde el frontend (navegador del usuario)
            console.log(`📦 Usando ${rawSearchResults.length} resultados enviados desde el navegador`);
            rawResults = rawSearchResults;
        } else {
            // Fallback: búsqueda desde el servidor (puede fallar por IP de datacenter)
            const clientIdParam = clientId ? `&client_id=${clientId}` : "";
            const searchUrl = `${MELI_BASE_URL}/sites/${MLV_SITE_ID}/search?q=${encodeURIComponent(normalizedQuery)}&limit=20${categoryId ? `&category=${categoryId}` : ""}${clientIdParam}`;

            const searchHeaders = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json",
                "Accept-Language": "es-VE,es;q=0.9",
            };
            if (accessToken) {
                searchHeaders["Authorization"] = `Bearer ${accessToken}`;
            }

            const searchRes = await fetch(searchUrl, { headers: searchHeaders });
            if (!searchRes.ok) {
                throw new Error(`ML Search failed: ${searchRes.status}`);
            }
            const searchData = await searchRes.json();
            rawResults = searchData.results || [];
        }

        if (rawResults.length === 0) {
            return NextResponse.json({
                success: true,
                batch_id: batchId,
                query: normalizedQuery,
                totalResults: 0,
                message: "No se encontraron resultados para esta búsqueda.",
            });
        }

        // ------------------------------------------------------------------
        // 2. ORDENAR POR VENTAS EN MEMORIA (simula sold_quantity_desc)
        // ------------------------------------------------------------------
        const sortedResults = sortBySoldQuantity(rawResults);
        const topCompetitors = sortedResults.slice(0, 10);

        // ------------------------------------------------------------------
        // 3. MULTIGET PARA DETALLES ENRIQUECIDOS (fotos, atributos)
        // ------------------------------------------------------------------
        const itemIds = topCompetitors.map((r) => r.id);
        const chunks = chunkArray(itemIds, 20);
        const itemDetails = [];

        for (const chunk of chunks) {
            const idsParam = chunk.join(",");
            const detailHeaders = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json",
            };
            if (accessToken) detailHeaders["Authorization"] = `Bearer ${accessToken}`;
            const detailRes = await fetch(`${MELI_BASE_URL}/items?ids=${idsParam}`, {
                headers: detailHeaders,
            });
            if (detailRes.ok) {
                const details = await detailRes.json();
                itemDetails.push(...details.filter((d) => d.code === 200).map((d) => d.body));
            }
        }

        const detailsMap = new Map(itemDetails.map((d) => [d.id, d]));

        // ------------------------------------------------------------------
        // 4. TOKEN YA ESTÁ DISPONIBLE DESDE EL PASO 0
        // ------------------------------------------------------------------
        // accessToken se obtuvo antes de la búsqueda para evitar 403 en Vercel

        // ------------------------------------------------------------------
        // 5. OBTENER NUESTRO ÍTEM (si se proporcionó ourItemId)
        // ------------------------------------------------------------------
        let ourItem = null;
        if (ourItemId) {
            try {
                const ourRes = await fetch(`${MELI_BASE_URL}/items/${ourItemId}`, {
                    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
                });
                if (ourRes.ok) ourItem = await ourRes.json();
            } catch {
                console.warn("No se pudo obtener nuestro ítem.", ourItemId);
            }
        }

        // ------------------------------------------------------------------
        // 6. PROCESAR Y ENRIQUECER CADA COMPETIDOR
        // ------------------------------------------------------------------
        const snapshots = await Promise.all(
            topCompetitors.map(async (item, index) => {
                const detail = detailsMap.get(item.id) || {};

                // Scraping de descripción para logística MLV
                const descText = await fetchItemDescription(item.id);

                // Performance/Health (requiere token)
                let healthData = { score: null, level: null };
                if (accessToken) {
                    healthData = await fetchItemPerformance(item.id, accessToken);
                }

                const snapshot = processSnapshot(item, detail, descText, {
                    batchId,
                    query: normalizedQuery,
                    sku,
                    ourItemId,
                    position: index + 1,
                });

                // Inyectar health
                snapshot.health_score = healthData.score;
                snapshot.health_level = healthData.level;

                return snapshot;
            })
        );

        // ------------------------------------------------------------------
        // 7. PERSISTIR SNAPSHOTS EN SUPABASE
        // ------------------------------------------------------------------
        const { data: insertedSnapshots, error: snapError } = await supabaseAdmin
            .from("mlv_market_snapshots")
            .insert(snapshots)
            .select();

        if (snapError) {
            console.error("Error guardando snapshots:", snapError);
        }

        // ------------------------------------------------------------------
        // 8. IDENTIFICAR LÍDER (más vendido)
        // ------------------------------------------------------------------
        const leader = snapshots[0]; // Ya están ordenados por sold_quantity

        // ------------------------------------------------------------------
        // 9. GUARDAR IMÁGENES DE REFERENCIA DEL LÍDER
        // ------------------------------------------------------------------
        if (leader && leader.raw_api_response?.pictures?.length > 0) {
            const imageRefs = leader.raw_api_response.pictures.map((pic, idx) => ({
                ml_item_id: leader.ml_item_id,
                image_url: pic.url || pic.secure_url,
                image_order: idx,
                is_primary: idx === 0,
                analysis_metadata: { size: pic.size || null, max_size: pic.max_size || null },
            }));

            await supabaseAdmin.from("competitor_image_refs").insert(imageRefs);
        }

        // ------------------------------------------------------------------
        // 10. RESPUESTA
        // ------------------------------------------------------------------
        return NextResponse.json({
            success: true,
            batch_id: batchId,
            query: normalizedQuery,
            analysis_mode: detectAnalysisMode(normalizedQuery),
            totalResults: rawResults.length,
            analyzed: snapshots.length,
            leader: {
                ml_item_id: leader.ml_item_id,
                title: leader.title,
                price_usd: leader.price_usd,
                sold_quantity: leader.sold_quantity,
                seller_nickname: leader.seller_nickname,
                pictures_count: leader.pictures_count,
                attributes_count: leader.attributes_count,
                logistics_data: leader.logistics_data,
            },
            competitors: snapshots.map((s) => ({
                ml_item_id: s.ml_item_id,
                title: s.title,
                price_usd: s.price_usd,
                sold_quantity: s.sold_quantity,
                seller_nickname: s.seller_nickname,
                pictures_count: s.pictures_count,
                search_position: s.search_position,
            })),
            ourItem: ourItem
                ? {
                    id: ourItem.id,
                    title: ourItem.title,
                    price: ourItem.price,
                    pictures: ourItem.pictures?.length || 0,
                    sold_quantity: ourItem.sold_quantity,
                    attributes: ourItem.attributes || [],
                }
                : null,
            stats: {
                avg_price: parseFloat((snapshots.reduce((a, b) => a + (b.price_usd || 0), 0) / snapshots.length).toFixed(2)),
                max_sales: Math.max(...snapshots.map((s) => s.sold_quantity)),
                min_price: Math.min(...snapshots.map((s) => s.price_usd || Infinity)),
                max_price: Math.max(...snapshots.map((s) => s.price_usd || 0)),
            },
        });
    } catch (err) {
        console.error("Error en /api/tools/sniper/analyze:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
