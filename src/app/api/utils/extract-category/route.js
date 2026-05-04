import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const MELI_BASE_URL = "https://api.mercadolibre.com";

/**
 * POST /api/utils/extract-category
 * Extrae la categoría exacta de una publicación de Mercado Libre.
 * REQUIERE token de autenticación (la API de ML /items/{id} no es pública).
 * Usa getValidAccessToken para auto-refrescar si el token está vencido.
 */
export async function POST(req) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "Falta la URL o el ID" }, { status: 400 });
    }

    // Extraer el ID del item del input (cualquier país de ML: MLV, MLA, MLB, MCO, etc.)
    // Soporta: MLV12345678, MLV-12345678, MLA12345678, MCO-12345678, o URLs que lo contengan
    const match = url.match(/(ML[A-Z]{1,2}[-_]?\d{7,})/i);
    if (!match) {
      return NextResponse.json({
        error: "No se encontró un ID de Mercado Libre válido. Pegá el link completo o el ID (ej: MLV-581037829)."
      }, { status: 400 });
    }

    const itemId = match[1].replace(/[-_]/g, '');
    console.log(`🔍 Extrayendo categoría para: ${itemId}`);

    // ------------------------------------------------------------------
    // OBTENER TOKEN VÁLIDO (con auto-refresh si está vencido)
    // ------------------------------------------------------------------
    const { getValidAccessToken } = require("@/lib/meli-auth-helper");

    let accessToken = null;
    try {
      // Buscar la primera cuenta vinculada
      const { data: firstAccount } = await supabaseAdmin
        .from('meli_accounts')
        .select('id')
        .limit(1)
        .single();

      if (firstAccount) {
        accessToken = await getValidAccessToken(firstAccount.id);
        console.log(`🔑 Token válido obtenido para cuenta ${firstAccount.id}`);
      }
    } catch (e) {
      console.warn("⚠️ No se pudo obtener token:", e.message);
    }

    if (!accessToken) {
      return NextResponse.json({
        error: "No tienes una cuenta de Mercado Libre vinculada o el token no pudo refrescarse. Ve a Autenticación y vincula tu cuenta."
      }, { status: 401 });
    }

    // ------------------------------------------------------------------
    // LLAMAR A LA API DE ML CON TOKEN
    // ------------------------------------------------------------------
    const res = await fetch(`${MELI_BASE_URL}/items/${itemId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      cache: 'no-store'
    });

    const data = await res.json();

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({
        error: `Mercado Libre rechazó el token (${res.status}). Intenta re-vincular tu cuenta en la sección de Autenticación.`
      }, { status: res.status });
    }

    if (res.status === 404 || !data.category_id) {
      return NextResponse.json({
        error: "La publicación no existe o fue eliminada."
      }, { status: 404 });
    }

    if (!res.ok) {
      return NextResponse.json({
        error: `Mercado Libre devolvió error ${res.status}. ${data.message || ''}`.trim()
      }, { status: res.status });
    }

    console.log(`✅ Categoría encontrada: ${data.category_id} | ${data.title}`);
    return NextResponse.json({
      success: true,
      category_id: data.category_id,
      title: data.title
    });

  } catch (error) {
    console.error("❌ Extract Category Error:", error);
    return NextResponse.json({ error: "Error interno: " + error.message }, { status: 500 });
  }
}
