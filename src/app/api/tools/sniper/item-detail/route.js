import { NextResponse } from "next/server";
import { scrapeItemDetail } from "@/lib/mlv-playwright-scraper";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const maxDuration = 60; // Maximo tiempo en Vercel Pro (o hobby)

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const url = searchParams.get('url');
        const sessionId = searchParams.get('session_id');
        const itemId = searchParams.get('item_id');
        const price = parseFloat(searchParams.get('price')) || 0;

        if (!url) {
            return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
        }

        // Ejecutar el scraper de playwright
        const detail = await scrapeItemDetail(url);

        // Actualizar la base de datos Supabase si tenemos los IDs
        if (sessionId && itemId && supabaseAdmin) {
            const revenue_usd = (detail.sold_quantity || 0) * price;
            const { error } = await supabaseAdmin
                .from("seller_spy_items")
                .update({
                    sold_quantity: detail.sold_quantity,
                    category_name: detail.category_name,
                    revenue_usd: revenue_usd
                })
                .eq("session_id", sessionId)
                .eq("ml_item_id", itemId);

            if (error) {
                console.error("❌ Error guardando hidratación en Supabase:", error);
            } else {
                console.log(`✅ Supabase actualizado: Item ${itemId}`);
            }
        }

        return NextResponse.json(detail);
    } catch (err) {
        console.error("Error en /api/tools/sniper/item-detail:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
