// ================================================================
// POST /api/tools/sniper/analyze
// Búsqueda de competidores + enriquecimiento multiget + scraping MLV
// ================================================================
import { NextResponse } from "next/server";
import crypto from "node:crypto";
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

// ------------------------------------------------------------------
// SCRAPER DE BÚSQUEDA PÚBLICA CON PLAYWRIGHT (HYBRID APPROACH)
// ------------------------------------------------------------------
import { scrapeMeliSearch } from "@/lib/mlv-playwright-scraper";

export async function POST(request) {
    try {
        let { query, sku, ourItemId, accountId, categoryId, rawSearchResults } = await request.json();

        let skuExistsInInventory = false;
        if (sku) {
            const { data: invData } = await supabaseAdmin
                .from("internal_inventory")
                .select("sku, title")
                .eq("sku", sku)
                .single();
            
            if (invData) {
                skuExistsInInventory = true;
                if (!query || query.trim().length === 0) {
                    query = invData.title;
                }
            }

            if (!ourItemId) {
                const { data: prodData } = await supabaseAdmin
                    .from("products")
                    .select("meli_item_id, title")
                    .eq("sku", sku)
                    .limit(1)
                    .single();
                
                if (prodData) {
                    ourItemId = prodData.meli_item_id;
                    if (!query || query.trim().length === 0) {
                        query = prodData.title;
                    }
                }
            }
        }

        if (!query || query.trim().length === 0) {
            return NextResponse.json({ error: "Query requerida o SKU no encontrado para auto-resolver" }, { status: 400 });
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
            // Intentar búsqueda oficial. Si falla por 403 u otro error, usar bypass scraper
            try {
                const clientIdParam = clientId ? `&client_id=${clientId}` : "";
                const searchUrl = `${MELI_BASE_URL}/sites/${MLV_SITE_ID}/search?q=${encodeURIComponent(normalizedQuery)}&limit=30${categoryId ? `&category=${categoryId}` : ""}${clientIdParam}`;

                const searchHeaders = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "application/json",
                    "Accept-Language": "es-VE,es;q=0.9",
                };
                if (accessToken) {
                    searchHeaders["Authorization"] = `Bearer ${accessToken}`;
                }

                console.log(`🔍 Intentando búsqueda API oficial para: "${normalizedQuery}"`);
                const searchRes = await fetch(searchUrl, { headers: searchHeaders });
                if (!searchRes.ok) {
                    throw new Error(`ML Search failed: ${searchRes.status}`);
                }
                const searchData = await searchRes.json();
                rawResults = searchData.results || [];
                console.log(`✅ Búsqueda API oficial exitosa: ${rawResults.length} resultados obtenidos`);
            } catch (searchErr) {
                console.warn(`⚠️ Búsqueda API oficial falló (${searchErr.message}). Iniciando scraper Playwright en el servidor...`);
                
                const scrapedItems = await scrapeMeliSearch(normalizedQuery);
                if (scrapedItems && scrapedItems.length > 0) {
                    rawResults = scrapedItems.map(item => {
                        return {
                            id: item.id,
                            title: item.title || "",
                            price: item.price || 0,
                            currency_id: item.currency_id || "USD",
                            permalink: item.permalink || "",
                            available_quantity: 1,
                            sold_quantity: item.sold_quantity || 0,
                            condition: 'new',
                            listing_type_id: 'gold_special',
                            seller: {
                                id: 0,
                                nickname: item.seller_nickname || 'Competidor'
                            },
                            thumbnail: item.thumbnail || "",
                            shipping: {
                                free_shipping: item.free_shipping || false,
                                local_pick_up: true
                            }
                        };
                    });
                    console.log(`✅ Scraper Playwright exitoso: ${rawResults.length} resultados obtenidos y mapeados`);
                } else {
                    console.error("❌ Scraper Playwright no obtuvo ningún resultado.");
                    throw searchErr;
                }
            }
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
        const topCompetitors = sortedResults.slice(0, 25);

        // ------------------------------------------------------------------
        // 3. MULTIGET PARA DETALLES ENRIQUECIDOS (fotos, atributos)
        // ------------------------------------------------------------------
        const itemIds = topCompetitors.map((r) => r.id);
        const chunks = chunkArray(itemIds, 20);
        const itemDetails = [];
        
        const detailPromises = topCompetitors.map(async (item) => {
            try {
                const detailHeaders = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "application/json",
                };
                const res = await fetch(`${MELI_BASE_URL}/items/${item.id}`, { headers: detailHeaders });
                console.log(`[Details API] Fetching ${item.id} anonymously. Status: ${res.status}`);
                if (res.ok) {
                    const data = await res.json();
                    itemDetails.push(data);
                }
            } catch (e) {
                console.log(`[Details API] Error fetching ${item.id}:`, e.message);
            }
        });
        
        await Promise.all(detailPromises);

        const detailsMap = new Map(itemDetails.map((d) => [d.id, d]));

        // 3.2. OBTENER NOMBRES DE VENDEDORES (SELLER NICKNAMES)
        const sellerIds = [...new Set(itemDetails.map(d => d.seller_id).filter(Boolean))];
        const sellersMap = new Map();
        
        if (sellerIds.length > 0) {
            const sellerPromises = sellerIds.map(async (sellerId) => {
                try {
                    const sellerHeaders = { "Accept": "application/json" };
                    if (accessToken) sellerHeaders["Authorization"] = `Bearer ${accessToken}`;
                    const res = await fetch(`${MELI_BASE_URL}/users/${sellerId}`, { headers: sellerHeaders });
                    if (res.ok) {
                        const data = await res.json();
                        sellersMap.set(sellerId, { nickname: data.nickname, permalink: data.permalink });
                    }
                } catch (e) {
                    console.log(`[Seller API] Error fetching seller ${sellerId}:`, e.message);
                }
            });
            await Promise.all(sellerPromises);
        }

        // ------------------------------------------------------------------
        // 3.5. OBTENER VISTAS (VISITS)
        // ------------------------------------------------------------------
        const visitsMap = new Map();
        try {
            const visitsHeaders = { "Accept": "application/json" };
            if (accessToken) visitsHeaders["Authorization"] = `Bearer ${accessToken}`;
            
            // ML API only allows 1 ID per request for visits
            const visitPromises = topCompetitors.map(async (item) => {
                try {
                    const visitsUrl = `${MELI_BASE_URL}/visits/items?ids=${item.id}`;
                    const res = await fetch(visitsUrl, { headers: visitsHeaders });
                    if (res.ok) {
                        const data = await res.json();
                        if (data[item.id] !== undefined) {
                            visitsMap.set(item.id, data[item.id]);
                        }
                    } else {
                        console.log(`[Visits API] Failed for ${item.id} with status: ${res.status}`);
                    }
                } catch (e) {
                    console.log(`[Visits API] Exception for ${item.id}: ${e.message}`);
                }
            });
            
            await Promise.all(visitPromises);
        } catch (e) {
            console.warn("⚠️ Error general en fetch de vistas:", e.message);
        }

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
                    sku: skuExistsInInventory ? sku : null,
                    ourItemId,
                    position: index + 1,
                });

                // Inyectar seller nickname si lo obtuvimos
                if (detail.seller_id && sellersMap.has(detail.seller_id)) {
                    const sellerInfo = sellersMap.get(detail.seller_id);
                    snapshot.seller_nickname = sellerInfo.nickname;
                }

                // Inyectar health y visitas
                snapshot.health_score = healthData.score;
                snapshot.health_level = healthData.level;
                snapshot.visits = visitsMap.get(item.id) || 0;

                return snapshot;
            })
        );

        // ------------------------------------------------------------------
        // 7. PERSISTIR SNAPSHOTS EN SUPABASE
        // ------------------------------------------------------------------
        const dbSnapshots = snapshots.map(s => {
            const { 
                attributes_primary, 
                attributes_other, 
                original_price_usd, 
                video_id, 
                first_picture_size, 
                visits,
                thumbnail,
                ...dbFields 
            } = s;
            return dbFields;
        });

        const { data: insertedSnapshots, error: snapError } = await supabaseAdmin
            .from("mlv_market_snapshots")
            .insert(dbSnapshots)
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
                sku: s.sku || null,
                brand: s.brand || null,
                permalink: s.permalink || null,
                price_usd: s.price_usd,
                original_price_usd: s.original_price_usd,
                sold_quantity: s.sold_quantity,
                visits: s.visits || 0,
                seller_id: s.seller_id,
                seller_nickname: s.seller_nickname,
                thumbnail: s.thumbnail || s.raw_api_response?.thumbnail || s.raw_api_response?.secure_thumbnail || null,
                pictures_count: s.pictures_count,
                first_picture_size: s.first_picture_size,
                video_id: s.video_id,
                attributes_count: s.attributes_count,
                primary_attributes_count: s.attributes_primary?.length || 0,
                secondary_attributes_count: s.attributes_other?.length || 0,
                logistics_data: s.logistics_data,
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
