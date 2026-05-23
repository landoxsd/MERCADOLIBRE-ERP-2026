// ================================================================
// GET /api/tools/sniper/seller/history?seller_id=XXX
// Lista todas las sesiones guardadas para un vendedor
// ================================================================
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const seller_id = searchParams.get("seller_id");

        if (!seller_id) {
            return NextResponse.json({ error: "seller_id requerido" }, { status: 400 });
        }

        const { data: sessions, error } = await supabaseAdmin
            .from("seller_spy_sessions")
            .select("id, seller_id, seller_nickname, scanned_at, total_items, total_sold_qty, total_revenue_usd, avg_price, avg_conversion, pct_free_shipping")
            .eq("seller_id", seller_id)
            .order("scanned_at", { ascending: false })
            .limit(20);

        if (error) throw error;

        return NextResponse.json({ success: true, sessions: sessions || [] });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
