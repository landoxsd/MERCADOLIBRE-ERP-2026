/**
 * src/lib/scrapling-client.js
 * Conector Node.js →
 *   1) Puente Integraly Search API (/sites/MLV/search en puerto 8088, ~0.4s sin bloqueos Anubis)
 *   2) Microservicio Scrapling Python (puerto 8765, fallback Camoufox)
 */

const SCRAPLING_BASE = process.env.SCRAPLING_SERVICE_URL || 'http://127.0.0.1:8765';
const BRIDGE_CANDIDATES = [
  process.env.PHOTO_BRIDGE_URL,
  'http://127.0.0.1:8088',
  'http://192.168.1.97:8088',
].filter(Boolean);
const TIMEOUT_MS = 90_000;

/**
 * Verifica si el puente Integraly (8088) o el microservicio Scrapling (8765) está activo.
 * @returns {Promise<boolean>}
 */
export async function isScraplingAvailable() {
  for (const base of BRIDGE_CANDIDATES) {
    try {
      const res = await fetch(`${base}/health`, {
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) return true;
    } catch {
      // try next
    }
  }
  try {
    const res = await fetch(`${SCRAPLING_BASE}/health`, {
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Extrae el SERP de MLV Venezuela y calcula la posición de tus items.
 * Prioriza el puente Integraly API (/sites/MLV/search + multiget) y usa Scrapling Python como fallback.
 */
export async function scraplingSerp({ query, nickname = '', category = '', myItemIds = [], maxResults = 48, offset = 0 }) {
  // 1. Intentar primero por el Puente Integraly (0.4s, API oficial MLV sin Anubis)
  for (const base of BRIDGE_CANDIDATES) {
    try {
      const res = await fetch(`${base}/serp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          nickname,
          category,
          max_results: maxResults,
          offset,
          my_item_ids: myItemIds,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.results)) {
          return data;
        }
      }
    } catch {
      // Probar siguiente candidato
    }
  }

  // 2. Fallback a Scrapling Python (puerto 8765)
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
      error = 'Servicio de búsqueda de terceros no disponible.';
    } else if (isTimeout) {
      error = `Timeout (${TIMEOUT_MS / 1000}s) consultando SERP.`;
    } else {
      error = err.message;
    }

    console.error('[scrapling-client] Error:', error);
    return { ok: false, error };
  }
}

export async function scraplingItem(itemId) {
  try {
    const res = await fetch(`${SCRAPLING_BASE}/item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: `Scrapling item error ${res.status}: ${detail}` };
    }

    const data = await res.json();
    return { ok: true, seller_id: data.seller_id, url: data.url };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function scraplingSellerFromItem(itemUrl) {
  try {
    const res = await fetch(`${SCRAPLING_BASE}/seller-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_url: itemUrl }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, error: `Scrapling seller-item error ${res.status}: ${detail}` };
    }

    const data = await res.json();
    if (data.status === 'found_via_serp' && data.nickname) {
      return {
        ok: true,
        nickname: data.nickname,
        item_id: data.item_id,
        matched_item_id: data.matched_item_id,
      };
    }
    return { ok: false, error: 'Seller not found in SERP' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
