import { NextResponse } from "next/server";

/**
 * POST /api/utils/extract-category
 * Extrae la categoría exacta de una publicación de Mercado Libre
 * usando la API PÚBLICA (sin token de autenticación requerido).
 * Esto evita el error 403 por token vencido.
 */
export async function POST(req) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "Falta la URL" }, { status: 400 });
    }

    // Extraer el ID del item de la URL (ej: MLV12345678 o MLV-12345678)
    const match = url.match(/(MLV[-_]?\d+)/i);
    if (!match) {
      return NextResponse.json({ error: "No se encontró un ID de Mercado Libre válido en el link" }, { status: 400 });
    }

    const itemId = match[1].replace(/[-_]/g, '');
    console.log(`🔍 Extrayendo categoría de publicación: ${itemId}`);

    // --- API PÚBLICA: No requiere token de autorización ---
    // ML permite consultar /items/{id} sin auth para obtener info pública
    const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      cache: 'no-store'
    });

    const data = await res.json();

    if (res.status === 404 || !data.category_id) {
      return NextResponse.json({ error: "La publicación no existe o fue eliminada." }, { status: 404 });
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
