// ================================================================
// POST /api/tools/sniper/seller
// Escaneo COMPLETO de la cuenta de un competidor (paginación total)
// Cache inteligente: si existe sesión < 24h, devuelve desde Supabase
//
// ANTI-ANUBIS: No usa scraping web. Usa API oficial de ML:
//   GET /sites/MLV/search?seller_id={id}&limit=50&offset=0
// El endpoint es JSON puro → Anubis no existe en la capa API.
// ================================================================
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { chunkArray } from "@/lib/sniper-helpers";

const MELI_BASE_URL = "https://api.mercadolibre.com";
const CACHE_TTL_HOURS = 24;
const MAX_ITEMS = 500;
const PAGE_SIZE = 50;
const MULTIGET_SIZE = 20;

// ----------------------------------------------------------------
// Función core: obtener IDs del vendedor via API oficial (sin Anubis)
// ----------------------------------------------------------------
async function getSellerItemsFromAPI(seller_id, accessToken) {
    const allIds = [];
    let offset = 0;
    let totalAvailable = null;

    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
    };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    while (allIds.length < MAX_ITEMS) {
        const url = `${MELI_BASE_URL}/sites/MLV/search?seller_id=${seller_id}&limit=${PAGE_SIZE}&offset=${offset}&attributes=id,title,price,sold_quantity,available_quantity,thumbnail,permalink,shipping,listing_type_id,status`;

        console.log(`[API] Paginando vendedor ${seller_id} offset=${offset}...`);
        const res = await fetch(url, { headers });

        if (!res.ok) {
            console.warn(`[API] Error HTTP ${res.status} en offset ${offset}`);
            break;
        }

        const data = await res.json();

        // En la primera página obtenemos el total
        if (totalAvailable === null) {
            totalAvailable = data.paging?.total || 0;
            console.log(`[API] Total publicaciones del vendedor: ${totalAvailable}`);
        }

        const results = data.results || [];
        if (results.length === 0) break;

        for (const item of results) {
            if (item.id) allIds.push(item.id);
        }

        offset += PAGE_SIZE;

        // Si ya descargamos todo, parar
        if (offset >= Math.min(totalAvailable, MAX_ITEMS)) break;

        // Pequeño delay para no golpear el rate limit
        await new Promise(r => setTimeout(r, 150));
    }

    console.log(`[API] ✅ ${allIds.length} IDs recolectados del vendedor ${seller_id}`);
    return allIds;
}

export async function POST(request) {
    try {
        const { seller_id, account_id, force_refresh = false } = await request.json();

        if (!seller_id) {
            return NextResponse.json({ error: "seller_id requerido" }, { status: 400 });
        }

        // ----------------------------------------------------------------
        // 0. VERIFICAR CACHE (< 24 horas)
        // ----------------------------------------------------------------
        if (!force_refresh) {
            const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 3600 * 1000).toISOString();
            const { data: cached } = await supabaseAdmin
                .from("seller_spy_sessions")
                .select("*")
                .eq("seller_id", seller_id)
                .gte("scanned_at", cutoff)
                .order("scanned_at", { ascending: false })
                .limit(1)
                .single();

            if (cached) {
                console.log(`⚡ Cache hit para seller ${seller_id} (sesión ${cached.id})`);
                const { data: items } = await supabaseAdmin
                    .from("seller_spy_items")
                    .select("*")
                    .eq("session_id", cached.id)
                    .order("revenue_usd", { ascending: false });

                return NextResponse.json({
                    success: true,
                    cached: true,
                    session: cached,
                    items: items || [],
                });
            }
        }

        // ----------------------------------------------------------------
        // 1. OBTENER TOKEN
        // ----------------------------------------------------------------
        let accessToken = null;
        let resolvedAccountId = account_id;

        if (!resolvedAccountId) {
            const { data: firstAccount } = await supabaseAdmin
                .from("meli_accounts")
                .select("id")
                .limit(1)
                .single();
            if (firstAccount) resolvedAccountId = firstAccount.id;
        }

        if (resolvedAccountId) {
            try {
                accessToken = await getValidAccessToken(resolvedAccountId);
            } catch (err) {
                console.warn("⚠️ No se pudo obtener token:", err.message);
            }
        }

        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
        };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

        // ----------------------------------------------------------------
        // 2. RECOLECTAR IDs via API oficial (SIN Playwright, SIN Anubis)
        // ----------------------------------------------------------------
        console.log(`🔍 Iniciando escaneo via API oficial del vendedor ${seller_id}...`);
        const allItemIdsArray = await getSellerItemsFromAPI(seller_id, accessToken);

        if (allItemIdsArray.length === 0) {
            return NextResponse.json(
                { error: "No se encontraron publicaciones para este vendedor. Verifica que el seller_id sea correcto." },
                { status: 404 }
            );
        }

        // ----------------------------------------------------------------
        // 3. OBTENER NICKNAME DEL VENDEDOR
        // ----------------------------------------------------------------
        let sellerNickname = seller_id;
        let sellerLevel = null;
        try {
            const userRes = await fetch(`${MELI_BASE_URL}/users/${seller_id}`, { headers });
            if (userRes.ok) {
                const userData = await userRes.json();
                sellerNickname = userData.nickname || seller_id;
                sellerLevel = userData.seller_reputation?.level_id || null;
            }
        } catch { /* silencioso */ }

        // ----------------------------------------------------------------
        // 4. MULTIGET — enriquecer cada item con datos completos
        // ----------------------------------------------------------------
        const WANTED_ATTRS = "id,title,price,sold_quantity,available_quantity,thumbnail,permalink,health,shipping,listing_type_id,attributes,category_id,date_created,status,pictures";
        const itemChunks = chunkArray(allItemIdsArray, MULTIGET_SIZE);
        let enrichedItems = [];
        let apiEnrichedCount = 0;

        for (const chunk of itemChunks) {
            const url = `${MELI_BASE_URL}/items?ids=${chunk.join(",")}&attributes=${WANTED_ATTRS}`;
            const res = await fetch(url, { headers });
            if (res.ok) {
                const data = await res.json();
                const valid = data.filter(r => r.code === 200).map(r => r.body);
                apiEnrichedCount += valid.length;
                enrichedItems.push(...valid);
            } else {
                console.warn(`[Multiget] Error HTTP ${res.status} en chunk`);
            }
            await new Promise(r => setTimeout(r, 100));
        }

        console.log(`✅ Multiget: ${enrichedItems.length} items enriquecidos (${apiEnrichedCount} desde API)`);

        // ----------------------------------------------------------------
        // 5. VISITAS por lotes
        // ----------------------------------------------------------------
        const visitsMap = {};
        const visitChunks = chunkArray(enrichedItems.map(i => i.id), 20);
        for (const chunk of visitChunks) {
            try {
                const url = `${MELI_BASE_URL}/visits/items?ids=${chunk.join(",")}`;
                const res = await fetch(url, { headers });
                if (res.ok) {
                    const data = await res.json();
                    Object.assign(visitsMap, data);
                }
            } catch {/* silencioso */}
            await new Promise(r => setTimeout(r, 100));
        }

        // ----------------------------------------------------------------
        // 6. RESOLVER NOMBRES DE CATEGORÍAS
        // ----------------------------------------------------------------
        const uniqueCategoryIds = [...new Set(enrichedItems.map(i => i.category_id).filter(Boolean))];
        const categoryNameMap = {};
        for (const catId of uniqueCategoryIds) {
            try {
                const res = await fetch(`${MELI_BASE_URL}/categories/${catId}`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    categoryNameMap[catId] = data.name || catId;
                }
            } catch {/* silencioso */}
        }

        // ----------------------------------------------------------------
        // 7. PROCESAR Y CALCULAR MÉTRICAS
        // ----------------------------------------------------------------
        const processedItems = enrichedItems.map(item => {
            const visits = visitsMap[item.id] || 0;
            const soldQty = item.sold_quantity || 0;
            const price = item.price || 0;
            const revenue = price * soldQty;
            const conversion = visits > 0 ? soldQty / visits : 0;
            const categoryName = categoryNameMap[item.category_id] || item.category_id;

            // Extraer SKU y Marca de atributos
            const attrs = item.attributes || [];
            const brandAttr = attrs.find(a => a.id === "BRAND" || a.name?.toLowerCase().includes("marca"));
            const skuAttr = attrs.find(a => a.id === "SELLER_ITEM_EXTRA_INFO" || a.id === "SKU" || a.id === "PART_NUMBER");

            return {
                ml_item_id: item.id,
                title: item.title,
                brand: brandAttr?.value_name || null,
                sku: skuAttr?.value_name || null,
                category_id: item.category_id,
                category_name: categoryName,
                price_usd: price,
                sold_quantity: soldQty,
                visits,
                conversion_rate: conversion,
                available_quantity: item.available_quantity || 0,
                pictures_count: item.pictures?.length || 0,
                health_score: item.health || null,
                has_free_shipping: item.shipping?.free_shipping || false,
                has_local_pickup: item.shipping?.local_pick_up || false,
                listing_type_id: item.listing_type_id,
                permalink: item.permalink,
                thumbnail: item.thumbnail,
                revenue_usd: revenue,
                market_share_pct: 0, // se calcula tras tener el total
                is_paused: item.status === "paused",
                date_created: item.date_created ? item.date_created.split("T")[0] : null,
                attributes_raw: attrs,
            };
        });

        // Calcular Market Share
        const totalRevenue = processedItems.reduce((s, i) => s + i.revenue_usd, 0);
        const totalSold = processedItems.reduce((s, i) => s + i.sold_quantity, 0);
        processedItems.forEach(item => {
            item.market_share_pct = totalRevenue > 0
                ? parseFloat(((item.revenue_usd / totalRevenue) * 100).toFixed(2))
                : 0;
        });

        // Agrupar ingresos por categoría
        const categoryRevMap = {};
        processedItems.forEach(item => {
            const key = item.category_name || "Otras";
            categoryRevMap[key] = (categoryRevMap[key] || 0) + item.revenue_usd;
        });
        const categoriesJson = Object.entries(categoryRevMap)
            .sort((a, b) => b[1] - a[1])
            .map(([name, revenue]) => ({ name, revenue: parseFloat(revenue.toFixed(2)) }));

        const topCategory = categoriesJson[0];

        // Métricas globales de la sesión
        const totalItems = processedItems.length;
        const avgPrice = totalItems > 0 ? totalRevenue / Math.max(totalSold, 1) : 0;
        const totalVisits = processedItems.reduce((s, i) => s + i.visits, 0);
        const avgConversion = totalVisits > 0 ? totalSold / totalVisits : 0;
        const pctFreeShipping = totalItems > 0
            ? (processedItems.filter(i => i.has_free_shipping).length / totalItems) * 100 : 0;
        const pctLocalPickup = totalItems > 0
            ? (processedItems.filter(i => i.has_local_pickup).length / totalItems) * 100 : 0;
        const pctGold = totalItems > 0
            ? (processedItems.filter(i => i.listing_type_id === "gold_special").length / totalItems) * 100 : 0;
        const avgHealth = totalItems > 0
            ? processedItems.reduce((s, i) => s + (i.health_score || 0), 0) / totalItems : 0;

        // ----------------------------------------------------------------
        // 8. GUARDAR EN SUPABASE
        // ----------------------------------------------------------------
        const sessionData = {
            seller_id,
            seller_nickname: sellerNickname,
            seller_level: sellerLevel,
            account_id: resolvedAccountId || null,
            total_items: totalItems,
            total_sold_qty: totalSold,
            total_revenue_usd: parseFloat(totalRevenue.toFixed(2)),
            avg_price: parseFloat(avgPrice.toFixed(2)),
            avg_health: parseFloat(avgHealth.toFixed(2)),
            avg_conversion: parseFloat(avgConversion.toFixed(4)),
            pct_free_shipping: parseFloat(pctFreeShipping.toFixed(2)),
            pct_local_pickup: parseFloat(pctLocalPickup.toFixed(2)),
            pct_gold_listing: parseFloat(pctGold.toFixed(2)),
            top_category_id: null,
            top_category_name: topCategory?.name || null,
            categories_json: categoriesJson,
        };

        const { data: session, error: sessionErr } = await supabaseAdmin
            .from("seller_spy_sessions")
            .insert(sessionData)
            .select()
            .single();

        if (sessionErr) {
            console.error("❌ Error guardando sesión:", sessionErr);
        }

        // Insertar items en lotes de 100
        if (session) {
            const itemsToInsert = processedItems.map(item => ({
                ...item,
                session_id: session.id,
            }));
            const insertChunks = chunkArray(itemsToInsert, 100);
            for (const chunk of insertChunks) {
                await supabaseAdmin.from("seller_spy_items").insert(chunk);
            }
            console.log(`✅ ${itemsToInsert.length} items guardados en Supabase`);
        }

        return NextResponse.json({
            success: true,
            cached: false,
            session: session || sessionData,
            items: processedItems.sort((a, b) => b.revenue_usd - a.revenue_usd),
        });

    } catch (err) {
        console.error("❌ Seller Spy error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
