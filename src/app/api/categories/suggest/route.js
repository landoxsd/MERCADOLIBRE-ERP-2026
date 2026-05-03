// ================================================================
// src/app/api/categories/suggest/route.js
// API para sugerir categoría de MercadoLibre a partir de una SubLínea interna
// ================================================================
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveCategoryForSubline } from "@/lib/meli-categories";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * POST /api/categories/suggest
 * Body: { lineCode, sublineCode, sublineName, title }
 *
 * Resuelve la categoría ML para una sublínea interna:
 * 1. Busca mapeo validado en category_mappings
 * 2. Si no existe, sugiere vía domain_discovery
 * 3. Retorna atributos obligatorios de la categoría
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { lineCode, sublineCode, sublineName, title } = body;

        if (!lineCode || !sublineCode) {
            return NextResponse.json(
                { error: "Se requieren lineCode y sublineCode" },
                { status: 400 }
            );
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        const result = await resolveCategoryForSubline(supabase, {
            lineCode,
            sublineCode,
            sublineName,
            title,
        });

        return NextResponse.json({
            success: true,
            line_code: lineCode,
            subline_code: sublineCode,
            ...result,
        });
    } catch (err) {
        console.error("[Categories Suggest] Error:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
