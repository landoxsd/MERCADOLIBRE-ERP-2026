import { NextResponse } from "next/server";

const MELI_BASE_URL = "https://api.mercadolibre.com";

/**
 * POST /api/utils/extract-category
 * Extrae la categoría exacta de una publicación de Mercado Libre.
 *
 * Estrategia (sin token requerido):
 * 1. Intenta la API pública /items/{id}
 * 2. Si falla (404/bloqueo), fallback a búsqueda por ID
 * 3. Si aún falla, intenta scraping del HTML público
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
    // MÉTODO 1: API PÚBLICA /items/{id}
    // ------------------------------------------------------------------
    try {
      const res = await fetch(`${MELI_BASE_URL}/items/${itemId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        if (data.category_id) {
          console.log(`✅ Método 1 (API pública): ${data.category_id}`);
          return NextResponse.json({
            success: true,
            category_id: data.category_id,
            title: data.title,
            method: 'api_public'
          });
        }
      }
      console.warn(`⚠️ Método 1 falló (${res.status}), intentando fallback...`);
    } catch (e) {
      console.warn("⚠️ Método 1 error:", e.message);
    }

    // ------------------------------------------------------------------
    // MÉTODO 2: BÚSQUEDA POR ID (fallback)
    // ------------------------------------------------------------------
    try {
      const siteId = itemId.substring(0, 3).toUpperCase();
      const searchUrl = `${MELI_BASE_URL}/sites/${siteId}/search?q=${itemId}&limit=1`;
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        const item = data.results?.[0];
        if (item?.category_id) {
          console.log(`✅ Método 2 (búsqueda): ${item.category_id}`);
          return NextResponse.json({
            success: true,
            category_id: item.category_id,
            title: item.title,
            method: 'search_fallback'
          });
        }
      }
      console.warn(`⚠️ Método 2 falló (${res.status}), intentando scraping...`);
    } catch (e) {
      console.warn("⚠️ Método 2 error:", e.message);
    }

    // ------------------------------------------------------------------
    // MÉTODO 3: SCRAPING DEL HTML PÚBLICO (último recurso)
    // ------------------------------------------------------------------
    try {
      const siteId = itemId.substring(0, 3).toLowerCase();
      // Construir URL pública del item (ej: articulo.mercadolibre.com.ve/MLV-581037829-...)
      // Nota: necesitamos el permalink completo. Hacemos una petición a un URL genérico
      // que ML redirige al permalink correcto.
      const publicUrl = `https://articulo.mercadolibre.com.${getDomain(siteId)}/${itemId}`;

      const res = await fetch(publicUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        redirect: 'follow',
        cache: 'no-store'
      });

      if (res.ok) {
        const html = await res.text();

        // Buscar category_id en el HTML (ML lo suele poner en meta tags o scripts)
        const catMatch = html.match(/"category_id"\s*:\s*"(ML[A-Z]{2}\d+)"/);
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);

        if (catMatch) {
          console.log(`✅ Método 3 (scraping): ${catMatch[1]}`);
          return NextResponse.json({
            success: true,
            category_id: catMatch[1],
            title: titleMatch ? titleMatch[1].trim() : '',
            method: 'scraping_fallback'
          });
        }
      }
      console.warn(`⚠️ Método 3 falló (${res.status})`);
    } catch (e) {
      console.warn("⚠️ Método 3 error:", e.message);
    }

    // ------------------------------------------------------------------
    // NINGUNO FUNCIONÓ
    // ------------------------------------------------------------------
    return NextResponse.json({
      error: "No se pudo encontrar la categoría de esta publicación. Puede que el item esté eliminado, sea privado, o el ID sea incorrecto."
    }, { status: 404 });

  } catch (error) {
    console.error("❌ Extract Category Error:", error);
    return NextResponse.json({ error: "Error interno: " + error.message }, { status: 500 });
  }
}

function getDomain(siteId) {
  const map = {
    'MLA': 'com.ar',
    'MLB': 'com.br',
    'MLC': 'cl',
    'MCO': 'com.co',
    'MCR': 'co.cr',
    'MRD': 'com.do',
    'MEC': 'com.ec',
    'MSV': 'com.sv',
    'MGT': 'com.gt',
    'MHN': 'hn',
    'MLM': 'com.mx',
    'MNI': 'com.ni',
    'MPA': 'com.pa',
    'MPY': 'com.py',
    'MPE': 'com.pe',
    'MLU': 'com.uy',
    'MLV': 'com.ve',
  };
  return map[siteId.toUpperCase()] || 'com';
}
