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

        let query = supabaseAdmin
            .from("seller_spy_sessions")
            .select("id, seller_id, seller_nickname, scanned_at, total_items, total_sold_qty, total_revenue_usd, avg_price, avg_conversion, pct_free_shipping")
            .order("scanned_at", { ascending: false })
            .limit(100);

        if (seller_id) {
            query = query.eq("seller_id", seller_id);
        }

        const { data: sessions, error } = await query;

        if (error) throw error;

        return NextResponse.json({ success: true, sessions: sessions || [] });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url);
        const seller_id = searchParams.get("seller_id");

        if (seller_id) {
            const { error } = await supabaseAdmin
                .from("seller_spy_sessions")
                .delete()
                .eq("seller_id", seller_id);
            if (error) throw error;
        } else {
            const { error } = await supabaseAdmin
                .from("seller_spy_sessions")
                .delete()
                .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all
            if (error) throw error;
        }

        return NextResponse.json({ success: true, message: "Historial borrado correctamente" });
    } catch (err) {
        console.error("❌ Error borrando historial:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
