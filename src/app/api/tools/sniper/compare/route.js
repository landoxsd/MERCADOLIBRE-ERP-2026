// ================================================================
// POST /api/tools/sniper/compare
// Compara nuestro ítem vs el líder y genera análisis con scoring
// Body: { ourItemId: string, batchId?: string, competitorItemId?: string, mode?: 'auto'|'fitment'|'price' }
// ================================================================
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { calculateCompetitiveScore } from "@/lib/sniper-scoring";

const MELI_BASE_URL = "https://api.mercadolibre.com";

export async function POST(request) {
    try {
        const { ourItemId, batchId, competitorItemId, mode = "auto", accountId } = await request.json();

        if (!ourItemId) {
            return NextResponse.json({ error: "ourItemId requerido" }, { status: 400 });
        }

        // ------------------------------------------------------------------
        // 1. OBTENER TOKEN SI HAY CUENTA
        // ------------------------------------------------------------------
        let accessToken = null;
        if (accountId) {
            try {
                accessToken = await getValidAccessToken(accountId);
            } catch {
                console.warn("Token no disponible. Continuando con datos públicos.");
            }
        }

        // ------------------------------------------------------------------
        // 2. OBTENER NUESTRO ÍTEM
        // ------------------------------------------------------------------
        let ourItem = null;
        try {
            const ourRes = await fetch(`${MELI_BASE_URL}/items/${ourItemId}`, {
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
            });
            if (ourRes.ok) ourItem = await ourRes.json();
        } catch {
            return NextResponse.json({ error: `No se pudo obtener nuestro ítem: ${ourItemId}` }, { status: 404 });
        }

        // ------------------------------------------------------------------
        // 3. OBTENER LÍDER (del batch más reciente o por competitorItemId)
        // ------------------------------------------------------------------
        let leader = null;
        let snapshots = [];

        if (batchId) {
            // Buscar snapshots de este batch
            const { data, error } = await supabaseAdmin
                .from("mlv_market_snapshots")
                .select("*")
                .eq("snapshot_batch_id", batchId)
                .order("sold_quantity", { ascending: false });

            if (!error && data?.length > 0) {
                snapshots = data;
                leader = data[0];
            }
        } else if (competitorItemId) {
            // Buscar snapshot específico del competidor
            const { data, error } = await supabaseAdmin
                .from("mlv_market_snapshots")
                .select("*")
                .eq("ml_item_id", competitorItemId)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (!error && data) {
                leader = data;
            }
        }

        // Fallback: buscar el batch más reciente para este ourItemId
        if (!leader) {
            const { data, error } = await supabaseAdmin
                .from("mlv_market_snapshots")
                .select("*")
                .eq("our_ml_item_id", ourItemId)
                .order("created_at", { ascending: false })
                .limit(10);

            if (!error && data?.length > 0) {
                snapshots = data;
                leader = data[0];
            }
        }

        if (!leader) {
            return NextResponse.json({
                error: "No hay datos de competidores. Ejecuta /analyze primero.",
            }, { status: 404 });
        }

        // ------------------------------------------------------------------
        // 4. EJECUTAR SCORING
        // ------------------------------------------------------------------
        const analysis = calculateCompetitiveScore(ourItem, leader, snapshots, mode);

        // ------------------------------------------------------------------
        // 5. PERSISTIR ANÁLISIS EN SUPABASE
        // ------------------------------------------------------------------
        const analysisRecord = {
            snapshot_batch_id: leader.snapshot_batch_id,
            our_product_sku: leader.our_product_sku || ourItem.seller_custom_field || ourItem.id,
            our_ml_item_id: ourItemId,
            competitor_item_id: leader.ml_item_id,
            score_total: analysis.score_total,
            score_breakdown: analysis.score_breakdown,
            price_gap_percent: analysis.gaps.price_percent,
            missing_attributes: analysis.gaps.missing_attributes,
            missing_photos_count: analysis.gaps.photo_gap,
            title_issues: analysis.gaps.spam_words.length > 0 ? ["spam_words"] : [],
            action_plan: analysis.action_plan,
            leader_item_id: leader.ml_item_id,
            leader_price: leader.price_usd,
            leader_sold_quantity: leader.sold_quantity,
            analysis_mode: analysis.mode,
        };

        const { data: insertedAnalysis, error: analysisError } = await supabaseAdmin
            .from("mlv_competitive_analysis")
            .insert(analysisRecord)
            .select()
            .single();

        if (analysisError) {
            console.error("Error guardando análisis:", analysisError);
        }

        // ------------------------------------------------------------------
        // 6. RESPUESTA
        // ------------------------------------------------------------------
        return NextResponse.json({
            success: true,
            analysis_id: insertedAnalysis?.id || null,
            mode: analysis.mode,
            score_total: analysis.score_total,
            score_breakdown: analysis.score_breakdown,
            action_plan: analysis.action_plan,
            gaps: analysis.gaps,
            our_item: {
                id: ourItem.id,
                title: ourItem.title,
                price: ourItem.price,
                pictures: ourItem.pictures?.length || 0,
                attributes: ourItem.attributes?.length || 0,
            },
            leader: {
                ml_item_id: leader.ml_item_id,
                title: leader.title,
                price_usd: leader.price_usd,
                sold_quantity: leader.sold_quantity,
                pictures_count: leader.pictures_count,
                attributes_count: leader.attributes_count,
                logistics_data: leader.logistics_data,
            },
        });
    } catch (err) {
        console.error("Error en /api/tools/sniper/compare:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
