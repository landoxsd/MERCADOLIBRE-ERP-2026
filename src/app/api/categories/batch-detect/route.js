// ================================================================
// src/app/api/categories/batch-detect/route.js
// Detecta categorías de ML para múltiples sublíneas automáticamente
// usando la API pública de Mercado Libre (sin token requerido).
// ================================================================
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MELI_BASE_URL = "https://api.mercadolibre.com";
const SITE_ID = "MLV";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Sugiere categoría para un término usando la API pública de ML
 */
async function suggestCategory(query) {
    try {
        const url = `${MELI_BASE_URL}/sites/${SITE_ID}/domain_discovery/search?limit=3&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
            cache: "no-store"
        });

        if (!res.ok) return [];

        const data = await res.json();
        return data.map((item) => ({
            category_id: item.category_id,
            category_name: item.category_name,
            domain_id: item.domain_id,
            domain_name: item.domain_name,
        }));
    } catch (err) {
        console.warn(`⚠️ Error sugiriendo categoría para "${query}":`, err.message);
        return [];
    }
}

/**
 * POST /api/categories/batch-detect
 * Body: { sublines: ["AMORTIGUADOR NORMAL", "BASE AMORTIGUADOR", ...] }
 *
 * Para cada sublínea:
 * 1. Busca mapeo existente en category_mappings
 * 2. Si no existe, sugiere categoría vía domain_discovery
 * 3. Devuelve resultados con status
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { sublines } = body;

        if (!Array.isArray(sublines) || sublines.length === 0) {
            return NextResponse.json(
                { error: "Se requiere un array de sublíneas en 'sublines'" },
                { status: 400 }
            );
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // Buscar mapeos existentes para todas las sublíneas
        const { data: existingMappings } = await supabase
            .from("category_mappings")
            .select("internal_subline_code, ml_category_id, ml_category_name, is_validated")
            .in("internal_subline_code", sublines);

        const existingMap = new Map();
        if (existingMappings) {
            for (const m of existingMappings) {
                existingMap.set(m.internal_subline_code, m);
            }
        }

        const results = [];
        let processed = 0;

        for (const subline of sublines) {
            const trimmed = subline.trim();
            if (!trimmed) continue;

            const existing = existingMap.get(trimmed);

            if (existing) {
                results.push({
                    subline: trimmed,
                    status: "mapped",
                    category_id: existing.ml_category_id,
                    category_name: existing.ml_category_name,
                    is_validated: existing.is_validated,
                    suggestions: [],
                });
                continue;
            }

            // Intentar sugerir categoría
            const suggestions = await suggestCategory(trimmed);

            if (suggestions.length > 0) {
                const best = suggestions[0];
                results.push({
                    subline: trimmed,
                    status: "suggested",
                    category_id: best.category_id,
                    category_name: best.category_name,
                    suggestions: suggestions,
                });
            } else {
                results.push({
                    subline: trimmed,
                    status: "not_found",
                    category_id: null,
                    category_name: null,
                    suggestions: [],
                });
            }

            // Pequeño delay para no saturar la API de ML
            processed++;
            if (processed % 5 === 0) {
                await new Promise((r) => setTimeout(r, 300));
            }
        }

        return NextResponse.json({
            success: true,
            total: sublines.length,
            mapped: results.filter((r) => r.status === "mapped").length,
            suggested: results.filter((r) => r.status === "suggested").length,
            not_found: results.filter((r) => r.status === "not_found").length,
            results,
        });
    } catch (err) {
        console.error("[Batch Detect] Error:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
