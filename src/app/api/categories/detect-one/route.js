// ================================================================
// src/app/api/categories/detect-one/route.js
// Detecta la categoría de ML para UNA sola sublínea por su nombre
// usando la API pública de domain_discovery (sin token).
// ================================================================
import { NextResponse } from "next/server";

const MELI_BASE_URL = "https://api.mercadolibre.com";
const SITE_ID = "MLV";

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
 * POST /api/categories/detect-one
 * Body: { query: "AMORTIGUADOR NORMAL" }
 *
 * Devuelve la mejor sugerencia de categoría ML para el término dado.
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { query } = body;

        if (!query || typeof query !== "string") {
            return NextResponse.json(
                { error: "Se requiere un término de búsqueda en 'query'" },
                { status: 400 }
            );
        }

        const suggestions = await suggestCategory(query.trim());

        if (suggestions.length === 0) {
            return NextResponse.json({
                success: false,
                error: "No se encontró ninguna categoría para este término",
            });
        }

        const best = suggestions[0];
        return NextResponse.json({
            success: true,
            query: query.trim(),
            category_id: best.category_id,
            category_name: best.category_name,
            domain_id: best.domain_id,
            domain_name: best.domain_name,
            alternatives: suggestions.slice(1),
        });
    } catch (err) {
        console.error("[Detect One] Error:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
