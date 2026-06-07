import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const account_id = searchParams.get("accountId") || 1; 

        // Traer Watchlist + Último Snapshot (para la tarjeta de UI)
        const { data, error } = await supabaseAdmin
            .from('seller_watchlist')
            .select(`
                *,
                seller_snapshots (
                    id, scanned_at, total_items, total_revenue_usd, avg_price, pct_free_shipping, power_seller_status, top_products
                )
            `)
            .eq('account_id', account_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Ordenamos los snapshots por scanned_at desc y agarramos el más reciente
        const formattedData = data.map(seller => {
            const snapshots = seller.seller_snapshots || [];
            snapshots.sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at));
            
            return {
                ...seller,
                last_snapshot: snapshots[0] || null,
                snapshots: snapshots // Enviamos todos para las gráficas
            };
        });

        return NextResponse.json({ success: true, watchlist: formattedData });
    } catch (err) {
        console.error("❌ Error fetching watchlist:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { accountId, sellerId, sellerNickname, permalink, notes, snapshotData } = body;

        if (!sellerId || !sellerNickname) {
            return NextResponse.json({ error: "Faltan datos del competidor" }, { status: 400 });
        }

        // 1. Crear o Buscar en Watchlist (Upsert por account_id + seller_id)
        let watchlistId;
        const { data: existing, error: checkErr } = await supabaseAdmin
            .from('seller_watchlist')
            .select('id')
            .eq('account_id', accountId || 1)
            .eq('seller_id', sellerId)
            .maybeSingle();

        if (checkErr) throw checkErr;

        if (existing) {
            watchlistId = existing.id;
            // Opcional: Actualizar notes si vienen
            if (notes !== undefined) {
                await supabaseAdmin.from('seller_watchlist')
                    .update({ notes, updated_at: new Date().toISOString() })
                    .eq('id', watchlistId);
            }
        } else {
            const { data: inserted, error: insertErr } = await supabaseAdmin
                .from('seller_watchlist')
                .insert([{
                    account_id: accountId || 1,
                    seller_id: sellerId,
                    seller_nickname: sellerNickname,
                    permalink: permalink,
                    notes: notes || ""
                }])
                .select()
                .single();
            if (insertErr) throw insertErr;
            watchlistId = inserted.id;
        }

        // 2. Insertar Snapshot si viene Data
        if (snapshotData) {
            const { error: snapErr } = await supabaseAdmin
                .from('seller_snapshots')
                .insert([{
                    watchlist_id: watchlistId,
                    total_items: snapshotData.total_items || 0,
                    total_revenue_usd: snapshotData.total_revenue_usd || 0,
                    avg_price: snapshotData.avg_price || 0,
                    pct_free_shipping: snapshotData.pct_free_shipping || 0,
                    power_seller_status: snapshotData.power_seller_status || "",
                    top_products: snapshotData.top_products || [],
                    category_distribution: snapshotData.category_distribution || {}
                }]);
            if (snapErr) throw snapErr;
        }

        return NextResponse.json({ success: true, message: "Añadido al Watchlist exitosamente" });

    } catch (err) {
        console.error("❌ Error adding to watchlist:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const watchlistId = searchParams.get("id");

        if (!watchlistId) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        const { error } = await supabaseAdmin
            .from('seller_watchlist')
            .delete()
            .eq('id', watchlistId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("❌ Error deleting watchlist:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
