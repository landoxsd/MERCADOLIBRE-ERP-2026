/**
 * src/lib/scrapling-client.js
 * Conector Node.js → Microservicio Scrapling Python (puerto 8765)
 *
 * Uso:
 *   import { scraplingSerp } from '@/lib/scrapling-client';
 *   const data = await scraplingSerp({ query: 'amortiguador aveo', myItemIds: ['MLV824681578'] });
 *
 * Fallback automático: si el servicio Python no está corriendo,
 * devuelve un error claro (no rompe el ERP).
 */

const SCRAPLING_BASE = process.env.SCRAPLING_SERVICE_URL || 'http://127.0.0.1:8765';
const TIMEOUT_MS = 90_000; // 90s — StealthyFetcher puede tardar ~30s

// ── Healthcheck ──────────────────────────────────────────────

/**
 * Verifica si el microservicio Scrapling está activo.
 * @returns {Promise<boolean>}
 */
export async function isScraplingAvailable() {
  try {
    const res = await fetch(`${SCRAPLING_BASE}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── SERP Position Tracker ────────────────────────────────────

/**
 * Extrae el SERP de MLV Venezuela y calcula la posición de tus items.
 *
 * @param {object} params
 * @param {string}   params.query        - Término de búsqueda (ej. "amortiguador aveo")
 * @param {string[]} params.myItemIds    - IDs propios para calcular posición (ej. ["MLV824681578"])
 * @param {number}   [params.maxResults] - Máximo de resultados (default 48)
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   query: string,
 *   url: string,
 *   total_found: number,
 *   results: Array<{
 *     position: number,
 *     id: string,
 *     title: string,
 *     price_usd: number|null,
 *     price_ves: number|null,
 *     seller: string,
 *     sold_quantity: number,
 *     free_shipping: boolean,
 *     rating: number|null,
 *     thumbnail: string|null,
 *     url: string,
 *   }>,
 *   my_positions: Record<string, number>,
 *   elapsed_seconds: number,
 *   error?: string,
 * }>}
 */
export async function scraplingSerp({ query, myItemIds = [], maxResults = 48 }) {
  try {
    const res = await fetch(`${SCRAPLING_BASE}/serp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        my_item_ids: myItemIds,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: `Scrapling service error ${res.status}: ${detail}` };
    }

    const data = await res.json();
    return { ok: true, ...data };

  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    const isOffline = err.cause?.code === 'ECONNREFUSED';

    let error;
    if (isOffline) {
      error = 'Scrapling service offline. Ejecuta scrapling-service/start.bat para iniciarlo.';
    } else if (isTimeout) {
      error = `Scrapling timeout (${TIMEOUT_MS / 1000}s). La página puede estar cargando lentamente.`;
    } else {
      error = err.message;
    }

    console.error('[scrapling-client] Error:', error);
    return { ok: false, error };
  }
}
