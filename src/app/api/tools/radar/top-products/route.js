// ================================================================
// GET /api/tools/radar/top-products
// Obtiene el top de productos ganadores de una categoría específica,
// calcula el market share de cada uno y detecta monopolios.
// ================================================================
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getValidAccessToken } from "@/lib/meli-auth-helper";

const MELI_BASE_URL = "https://api.mercadolibre.com";
const MAX_ITEMS = 250; // Muestra representativa para velocidad y profundidad
const PAGE_SIZE = 50;

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const category_id = searchParams.get("category_id");
        const account_id = searchParams.get("account_id");

        if (!category_id) {
            return NextResponse.json({ error: "category_id es requerido" }, { status: 400 });
        }

        // 1. Obtener Token
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

        // 2. Info de la Categoría
        let categoryName = category_id;
        try {
            const catRes = await fetch(`${MELI_BASE_URL}/categories/${category_id}`, { headers });
            if (catRes.ok) {
                const catData = await catRes.json();
                categoryName = catData.name;
            }
        } catch (e) {
            console.warn("⚠️ Error obteniendo nombre de la categoría:", e.message);
        }

        // 3. Paginación de Búsqueda
        let allItems = [];
        let offset = 0;
        let total = Infinity;

        while (offset < total && allItems.length < MAX_ITEMS) {
            const url = `${MELI_BASE_URL}/sites/MLV/search?category=${category_id}&limit=${PAGE_SIZE}&offset=${offset}`;
            const res = await fetch(url, { headers });

            if (!res.ok) {
                console.error(`Error buscando ítems: ${res.statusText}`);
                break;
            }

            const data = await res.json();
            total = data.paging?.total ?? 0;
            
            if (data.results && data.results.length > 0) {
                allItems.push(...data.results);
            } else {
                break;
            }
            
            offset += PAGE_SIZE;
            if (offset < total && allItems.length < MAX_ITEMS) {
                await new Promise(r => setTimeout(r, 100)); // Delay para evitar rate limit
            }
        }

        if (allItems.length === 0) {
            return NextResponse.json({ error: "No se encontraron publicaciones en esta categoría" }, { status: 404 });
        }

        // 4. Calcular métricas agregadas globales sobre la muestra
        let sampleTotalSold = 0;
        let sampleTotalRevenue = 0;
        const sellerAggregates = {};

        allItems.forEach(item => {
            const sold = item.sold_quantity || 0;
            const price = item.price || 0;
            const revenue = sold * price;

            sampleTotalSold += sold;
            sampleTotalRevenue += revenue;

            if (item.seller?.id) {
                const sId = item.seller.id.toString();
                const sName = item.seller.nickname || "Vendedor Anónimo";
                
                if (!sellerAggregates[sId]) {
                    sellerAggregates[sId] = {
                        seller_id: sId,
                        seller_nickname: sName,
                        total_sold: 0,
                        total_revenue: 0,
                        items_count: 0
                    };
                }
                sellerAggregates[sId].total_sold += sold;
                sellerAggregates[sId].total_revenue += revenue;
                sellerAggregates[sId].items_count += 1;
            }
        });

        // Evitar división por cero
        const finalTotalRevenue = sampleTotalRevenue || 1;
        const finalTotalSold = sampleTotalSold || 1;

        // 5. Ordenar en memoria por más vendidos (sold_quantity) desc
        const sortedItems = [...allItems].sort((a, b) => {
            if ((b.sold_quantity || 0) !== (a.sold_quantity || 0)) {
                return (b.sold_quantity || 0) - (a.sold_quantity || 0);
            }
            // Sub-ordenar por ingresos si tienen las mismas ventas
            const revB = (b.sold_quantity || 0) * (b.price || 0);
            const revA = (a.sold_quantity || 0) * (a.price || 0);
            return revB - revA;
        });

        // 6. Tomar los top 20
        const top20Raw = sortedItems.slice(0, 20);

        // Formatear los top 20 ítems con su market share
        const topProducts = top20Raw.map((item, index) => {
            const sold = item.sold_quantity || 0;
            const price = item.price || 0;
            const revenue = sold * price;
            
            return {
                rank: index + 1,
                id: item.id,
                title: item.title,
                price: price,
                sold_quantity: sold,
                revenue: revenue,
                permalink: item.permalink,
                thumbnail: item.thumbnail ? item.thumbnail.replace("-I.jpg", "-O.jpg") : null, // Mayor resolución
                seller_id: item.seller?.id ? item.seller.id.toString() : null,
                seller_nickname: item.seller?.nickname || "Vendedor Anónimo",
                free_shipping: item.shipping?.free_shipping ?? false,
                listing_type_id: item.listing_type_id,
                market_share_revenue_pct: parseFloat(((revenue / finalTotalRevenue) * 100).toFixed(2)),
                market_share_units_pct: parseFloat(((sold / finalTotalSold) * 100).toFixed(2))
            };
        });

        // 7. Detectar monopolios en los vendedores
        const sellerShares = Object.values(sellerAggregates).map(s => ({
            ...s,
            market_share_revenue_pct: parseFloat(((s.total_revenue / finalTotalRevenue) * 100).toFixed(2)),
            market_share_units_pct: parseFloat(((s.total_sold / finalTotalSold) * 100).toFixed(2))
        })).sort((a, b) => b.total_revenue - a.total_revenue);

        // Detectar si algún vendedor tiene >30% de market share (por ingresos o unidades)
        const sellerMonopolies = sellerShares.filter(s => s.market_share_revenue_pct > 30 || s.market_share_units_pct > 30);
        const hasMonopoly = sellerMonopolies.length > 0;

        // 8. Enviar respuesta
        return NextResponse.json({
            success: true,
            category_id,
            category_name: categoryName,
            total_listings: total,
            sample_size: allItems.length,
            global_metrics: {
                total_revenue: parseFloat(sampleTotalRevenue.toFixed(2)),
                total_sold: sampleTotalSold,
                avg_price: parseFloat((allItems.reduce((sum, item) => sum + (item.price || 0), 0) / allItems.length).toFixed(2))
            },
            top_products: topProducts,
            market_distribution: {
                has_monopoly: hasMonopoly,
                monopolists: sellerMonopolies,
                top_sellers: sellerShares.slice(0, 5) // Mostrar los top 5 vendedores de la categoría
            }
        });

    } catch (err) {
        console.error("❌ Radar Top Products error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
