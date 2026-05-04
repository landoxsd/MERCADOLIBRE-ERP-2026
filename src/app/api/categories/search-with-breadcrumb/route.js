// ================================================================
// src/app/api/categories/search-with-breadcrumb/route.js
// Busca categorías por término y devuelve sugerencias con breadcrumb.
// Usa domain_discovery + /categories/{id} con token para breadcrumb.
// ================================================================
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const MELI_BASE_URL = "https://api.mercadolibre.com";
const SITE_ID = "MLV";

/**
 * Sugiere categorías por término usando domain_discovery (público)
 */
async function suggestCategories(query) {
    try {
        const url = `${MELI_BASE_URL}/sites/${SITE_ID}/domain_discovery/search?limit=5&q=${encodeURIComponent(query)}`;
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
        console.warn("⚠️ domain_discovery error:", err.message);
        return [];
    }
}

/**
 * Obtiene el breadcrumb de una categoría usando token
 */
async function getCategoryBreadcrumb(categoryId, accessToken) {
    try {
        const res = await fetch(`${MELI_BASE_URL}/categories/${categoryId}`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            },
            cache: "no-store"
        });

        if (!res.ok) return null;

        const data = await res.json();
        return {
            id: data.id,
            name: data.name,
            path: data.path_from_root?.map(p => p.name).join(" > ") || data.name,
            path_array: data.path_from_root || [{ id: data.id, name: data.name }],
            is_leaf: !data.children_categories || data.children_categories.length === 0,
        };
    } catch (err) {
        console.warn(`⚠️ Error breadcrumb para ${categoryId}:`, err.message);
        return null;
    }
}

/**
 * POST /api/categories/search-with-breadcrumb
 * Body: { query: "amortiguador" }
 *
 * Devuelve sugerencias con breadcrumb completo.
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

        // ------------------------------------------------------------------
        // 1. Sugerencias via domain_discovery (público, sin token)
        // ------------------------------------------------------------------
        const suggestions = await suggestCategories(query.trim());

        if (suggestions.length === 0) {
            return NextResponse.json({
                success: false,
                error: "No se encontraron categorías para este término",
            });
        }

        // ------------------------------------------------------------------
        // 2. Obtener token válido para breadcrumb
        // ------------------------------------------------------------------
        let accessToken = null;
        try {
            const { getValidAccessToken } = require("@/lib/meli-auth-helper");
            const { data: firstAccount } = await supabaseAdmin
                .from('meli_accounts')
                .select('id')
                .limit(1)
                .single();

            if (firstAccount) {
                accessToken = await getValidAccessToken(firstAccount.id);
            }
        } catch (e) {
            console.warn("⚠️ No se pudo obtener token para breadcrumb:", e.message);
        }

        // ------------------------------------------------------------------
        // 3. Enriquecer cada sugerencia con breadcrumb
        // ------------------------------------------------------------------
        const enriched = [];
        for (const suggestion of suggestions) {
            let breadcrumb = null;
            if (accessToken) {
                breadcrumb = await getCategoryBreadcrumb(suggestion.category_id, accessToken);
            }

            enriched.push({
                category_id: suggestion.category_id,
                category_name: suggestion.category_name,
                domain_id: suggestion.domain_id,
                domain_name: suggestion.domain_name,
                breadcrumb: breadcrumb?.path || suggestion.category_name,
                breadcrumb_array: breadcrumb?.path_array || [{ id: suggestion.category_id, name: suggestion.category_name }],
                is_leaf: breadcrumb?.is_leaf ?? true,
            });
        }

        return NextResponse.json({
            success: true,
            query: query.trim(),
            results: enriched,
        });

    } catch (err) {
        console.error("[Search Breadcrumb] Error:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
