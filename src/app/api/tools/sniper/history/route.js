// ================================================================
// API /api/tools/sniper/history
// GET: Lista historial de posiciones por item/query
// POST: Registra una nueva medición de posición
// ================================================================
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ------------------------------------------------------------------
// GET — Listar historial de posiciones
// Query params: ourItemId, sku, searchQuery
// ------------------------------------------------------------------
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const ourItemId = searchParams.get("ourItemId");
        const sku = searchParams.get("sku");
        const searchQuery = searchParams.get("searchQuery");
        const limit = parseInt(searchParams.get("limit") || "50", 10);

        let query = supabaseAdmin
            .from("mlv_position_history")
            .select("*")
            .order("recorded_at", { ascending: false })
            .limit(limit);

        if (ourItemId) query = query.eq("our_ml_item_id", ourItemId);
        if (sku) query = query.eq("our_product_sku", sku);
        if (searchQuery) query = query.eq("search_query", searchQuery);

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({
            success: true,
            count: data?.length || 0,
            history: data || [],
        });
    } catch (err) {
        console.error("Error en GET /api/tools/sniper/history:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ------------------------------------------------------------------
// POST — Registrar nueva posición
// Body: { ourItemId, sku, searchQuery, positionPrevious, positionCurrent, batchId, actionsApplied, marketContext }
// ------------------------------------------------------------------
export async function POST(request) {
    try {
        const body = await request.json();
        const {
            ourItemId,
            sku,
            searchQuery,
            positionPrevious,
            positionCurrent,
            batchId,
            actionsApplied,
            marketContext,
        } = body;

        if (!ourItemId || !sku || !searchQuery) {
            return NextResponse.json(
                { error: "ourItemId, sku y searchQuery son requeridos" },
                { status: 400 }
            );
        }

        const record = {
            our_ml_item_id: ourItemId,
            our_product_sku: sku,
            search_query: searchQuery,
            position_previous: positionPrevious,
            position_current: positionCurrent,
            snapshot_batch_id: batchId || null,
            actions_applied: actionsApplied || [],
            market_context: marketContext || {},
        };

        const { data, error } = await supabaseAdmin
            .from("mlv_position_history")
            .insert(record)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            record: data,
            trend: positionPrevious && positionCurrent
                ? positionCurrent < positionPrevious ? "improved" : positionCurrent > positionPrevious ? "worsened" : "stable"
                : null,
        });
    } catch (err) {
        console.error("Error en POST /api/tools/sniper/history:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
