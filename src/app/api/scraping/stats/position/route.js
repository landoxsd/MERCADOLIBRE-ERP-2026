/**
 * src/app/api/scraping/stats/position/route.js
 * API Route — SERP Position Tracker
 *
 * POST /api/scraping/stats/position
 * Body: { query: string, myItemIds?: string[], maxResults?: number }
 *
 * Respuesta exitosa:
 * {
 *   query, url, total_found,
 *   results: [{ position, id, title, price_usd, seller, ... }],
 *   my_positions: { "MLV824681578": 3 },
 *   elapsed_seconds,
 * }
 */

import { scraplingSerp, isScraplingAvailable } from '@/lib/scrapling-client';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutos — StealthyFetcher puede tardar

export async function POST(request) {
  try {
    const body = await request.json();
    const { query, myItemIds = [], maxResults = 48 } = body;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return Response.json(
        { error: 'El parámetro "query" es requerido (mínimo 2 caracteres).' },
        { status: 400 }
      );
    }

    // Verificar que el servicio Scrapling esté corriendo
    const available = await isScraplingAvailable();
    if (!available) {
      return Response.json(
        {
          error: 'El servicio Scrapling no está activo.',
          hint: 'Ejecuta scrapling-service/start.bat para iniciarlo antes de usar esta función.',
          service_url: process.env.SCRAPLING_SERVICE_URL || 'http://127.0.0.1:8765',
        },
        { status: 503 }
      );
    }

    const result = await scraplingSerp({
      query: query.trim(),
      myItemIds,
      maxResults: Math.min(maxResults, 100),
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 502 });
    }

    return Response.json(result);

  } catch (err) {
    console.error('[/api/scraping/stats/position] Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// GET simple para prueba desde browser
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) || [];

  if (!query) {
    return Response.json({
      endpoint: 'POST /api/scraping/stats/position',
      description: 'SERP Position Tracker para MercadoLibre Venezuela',
      body_example: {
        query: 'amortiguador delantero aveo',
        myItemIds: ['MLV824681578', 'MLV741525823'],
        maxResults: 48,
      },
    });
  }

  // Soporte GET con ?query=...&ids=MLV1,MLV2 para pruebas rápidas
  const result = await scraplingSerp({ query, myItemIds: ids });
  if (!result.ok) return Response.json({ error: result.error }, { status: 502 });
  return Response.json(result);
}
