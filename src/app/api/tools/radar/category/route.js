// ================================================================
// POST /api/tools/radar/category
// Escanea una categoría para obtener métricas agregadas y calcular tendencias.
// ================================================================
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getValidAccessToken } from "@/lib/meli-auth-helper";

const MELI_BASE_URL = "https://api.mercadolibre.com";
const MAX_ITEMS = 500; // Muestra representativa para velocidad
const PAGE_SIZE = 50;

export async function POST(request) {
    try {
        const { category_id, account_id } = await request.json();

        if (!category_id) {
            return NextResponse.json({ error: "category_id requerido" }, { status: 400 });
        }

        // 1. Token
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
        } catch (e) { /* silencioso */ }

        // 3. Paginación de Búsqueda
        let allItems = [];
        let offset = 0;
        let total = Infinity;

        while (offset < total && allItems.length < MAX_ITEMS) {
            const url = `${MELI_BASE_URL}/sites/MLV/search?category=${category_id}&limit=${PAGE_SIZE}&offset=${offset}`;
            const res = await fetch(url, { headers });

            if (!res.ok) break;

            const data = await res.json();
            total = data.paging?.total ?? 0;
            
            if (data.results && data.results.length > 0) {
                allItems.push(...data.results);
            } else {
                break;
            }
            
            offset += PAGE_SIZE;
            if (offset < total && allItems.length < MAX_ITEMS) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        if (allItems.length === 0) {
            return NextResponse.json({ error: "No se encontraron publicaciones en esta categoría" }, { status: 404 });
        }

        // 4. Calcular Métricas
        const uniqueSellers = new Set();
        let totalSoldQty = 0;
        let totalRevenueUsd = 0;
        let sumPrice = 0;

        allItems.forEach(item => {
            if (item.seller?.id) uniqueSellers.add(item.seller.id);
            const soldQty = item.sold_quantity || 0;
            const price = item.price || 0;
            totalSoldQty += soldQty;
            totalRevenueUsd += (soldQty * price);
            sumPrice += price;
        });

        const avgPrice = allItems.length > 0 ? sumPrice / allItems.length : 0;
        
        // Estimar total real basado en la muestra (Regla de 3)
        // Si escaneamos 500 pero hay 2000, multiplicamos las métricas por 4 para tener un estimado macro
        const multiplier = total > 0 && allItems.length > 0 ? total / allItems.length : 1;
        const estTotalSoldQty = Math.round(totalSoldQty * multiplier);
        const estTotalRevenueUsd = totalRevenueUsd * multiplier;
        const estTotalSellers = Math.round(uniqueSellers.size * multiplier);

        // 5. Comparar con Snapshot Anterior para Tendencia
        const { data: lastSnapshot } = await supabaseAdmin
            .from("category_radar_snapshots")
            .select("total_revenue_usd")
            .eq("category_id", category_id)
            .order("scanned_at", { ascending: false })
            .limit(1)
            .single();

        let trendPct = 0;
        let trendLabel = "stable";

        if (lastSnapshot && lastSnapshot.total_revenue_usd > 0) {
            trendPct = ((estTotalRevenueUsd - lastSnapshot.total_revenue_usd) / lastSnapshot.total_revenue_usd) * 100;
            if (trendPct > 20) trendLabel = "hot";
            else if (trendPct > 5) trendLabel = "growing";
            else if (trendPct < -5) trendLabel = "declining";
        }

        const snapshotData = {
            category_id,
            category_name: categoryName,
            site_id: 'MLV',
            total_items: total,
            total_sellers: estTotalSellers,
            total_sold_qty: estTotalSoldQty,
            total_revenue_usd: parseFloat(estTotalRevenueUsd.toFixed(2)),
            avg_price: parseFloat(avgPrice.toFixed(2)),
            avg_health: 0, // Requiere multiget intensivo, se omite por velocidad en el radar macro
            trend_pct: parseFloat(trendPct.toFixed(2)),
            trend_label: trendLabel
        };

        const { data: savedSnapshot, error: snapErr } = await supabaseAdmin
            .from("category_radar_snapshots")
            .insert(snapshotData)
            .select()
            .single();

        if (snapErr) console.error("Error guardando radar snapshot:", snapErr);

        // 6. Obtener historial para la gráfica (sparkline)
        const { data: history } = await supabaseAdmin
            .from("category_radar_snapshots")
            .select("scanned_at, total_revenue_usd")
            .eq("category_id", category_id)
            .order("scanned_at", { ascending: true })
            .limit(10);

        return NextResponse.json({
            success: true,
            snapshot: savedSnapshot || snapshotData,
            history: history || []
        });

    } catch (err) {
        console.error("❌ Radar Category error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
