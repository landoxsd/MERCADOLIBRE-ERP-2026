// src/lib/meli-promotions.js
// ================================================================
// Cliente de la API de Promociones de Mercado Libre
// Todos los endpoints de /seller-promotions
// ================================================================

const MELI_BASE_URL = "https://api.mercadolibre.com";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function meliPromoGet(endpoint, accessToken, retries = 0) {
  const res = await fetch(`${MELI_BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (res.status === 429 && retries < 3) {
    await sleep(1000 * Math.pow(2, retries));
    return meliPromoGet(endpoint, accessToken, retries + 1);
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`ML Promo API [${res.status}]: ${endpoint} - ${errBody}`);
  }
  return res.json();
}

async function meliPromoPost(endpoint, accessToken, body) {
  const res = await fetch(`${MELI_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `ML Promo POST Error [${res.status}]`);
  }
  return res.json();
}

// ── CONSULTAS ──────────────────────────────────────────────────────

// Lista todas las campañas disponibles del vendedor
export async function getSellerCampaigns(userId, accessToken) {
  return meliPromoGet(`/seller-promotions/users/${userId}?app_version=v2`, accessToken);
}

// Estado de promociones de un ítem
export async function getItemPromotions(itemId, accessToken) {
  const data = await meliPromoGet(
    `/seller-promotions/items/${itemId}?app_version=v2`, accessToken
  );
  return Array.isArray(data) ? data : [data];
}

// Estado de promociones de múltiples ítems (paralelo con concurrencia controlada)
export async function getItemsPromotionsBatch(itemIds, accessToken, concurrency = 5) {
  const results = [];
  for (let i = 0; i < itemIds.length; i += concurrency) {
    const chunk = itemIds.slice(i, i + concurrency);
    const chunkResults = await Promise.allSettled(
      chunk.map(id => getItemPromotions(id, accessToken).then(promos => ({ id, promos })))
    );
    results.push(...chunkResults.map((r, idx) => r.status === 'fulfilled' ? r.value : { id: chunk[idx], promos: [], error: r.reason?.message }));
    if (i + concurrency < itemIds.length) await sleep(200); // rate limiting gentil
  }
  return results;
}

// ── APLICAR DESCUENTOS ─────────────────────────────────────────────

// Sumar UN ítem a una campaña con precio de oferta
export async function addItemToPromotion(itemId, promotionId, promotionType, dealPrice, accessToken) {
  return meliPromoPost(`/seller-promotions/items/${itemId}?app_version=v2`, accessToken, {
    promotion_id: promotionId,
    promotion_type: promotionType,
    deal_price: dealPrice
  });
}

// Sumar MÚLTIPLES ítems a una campaña (por lotes, respeta rate limiting)
export async function addItemsBatchToPromotion(items, promotionId, promotionType, accessToken) {
  // items = [{ id: "MLV...", dealPrice: 72.29 }, ...]
  const results = [];
  for (const item of items) {
    try {
      const r = await addItemToPromotion(item.id, promotionId, promotionType, item.dealPrice, accessToken);
      results.push({ id: item.id, success: true, data: r });
    } catch (err) {
      results.push({ id: item.id, success: false, error: err.message });
    }
    await sleep(150); // 6-7 req/seg, seguro bajo el límite de ML
  }
  return results;
}

// Descuento individual (PRICE_DISCOUNT) con rango de fechas
export async function addPriceDiscount(itemId, dealPrice, startDate, finishDate, accessToken, topDealPrice = null) {
  const body = {
    promotion_type: 'PRICE_DISCOUNT',
    deal_price: dealPrice,
    start_date: startDate,   // "2026-06-01T00:00:00" — formato LOCAL
    finish_date: finishDate, // "2026-06-14T00:00:00" — máx 14 días
  };
  if (topDealPrice) body.top_deal_price = topDealPrice;
  return meliPromoPost(`/seller-promotions/items/${itemId}?app_version=v2`, accessToken, body);
}

// ── CALCULAR PRECIO ÓPTIMO ─────────────────────────────────────────

// Calcula el precio de oferta más competitivo basado en precios de competidores
export function calculateOptimalDealPrice(ourPrice, competitorPrices = [], targetDiscountPct = null) {
  if (targetDiscountPct !== null) {
    // Modo porcentaje explícito (decisiones del usuario por línea/lote)
    const pct = Math.min(Math.max(targetDiscountPct, 5), 80);
    return parseFloat((ourPrice * (1 - pct / 100)).toFixed(2));
  }

  if (competitorPrices.length === 0) {
    // Sin competidores: aplicar 5% mínimo
    return parseFloat((ourPrice * 0.95).toFixed(2));
  }

  const minCompetitorPrice = Math.min(...competitorPrices);

  if (ourPrice <= minCompetitorPrice) {
    // Ya somos los más baratos: aplicar 5% para visibilidad extra
    return parseFloat((ourPrice * 0.95).toFixed(2));
  }

  // Precio 3% por debajo del campeón
  const targetPrice = parseFloat((minCompetitorPrice * 0.97).toFixed(2));
  const impliedDiscount = ((ourPrice - targetPrice) / ourPrice) * 100;

  // Validar rango 5%-80%
  if (impliedDiscount < 5) return parseFloat((ourPrice * 0.95).toFixed(2));
  if (impliedDiscount > 80) return parseFloat((ourPrice * 0.20).toFixed(2));

  return targetPrice;
}

// Calcula el precio de oferta por porcentaje (para gestión por línea)
export function calcPriceByPercent(originalPrice, discountPercent) {
  const pct = Math.min(Math.max(discountPercent, 5), 80);
  return parseFloat((originalPrice * (1 - pct / 100)).toFixed(2));
}

// ── REMOVER DESCUENTOS ─────────────────────────────────────────────

export async function removeItemFromPromotion(itemId, promotionId, promotionType, accessToken) {
  const url = `${MELI_BASE_URL}/seller-promotions/items/${itemId}?promotion_type=${promotionType}&promotion_id=${promotionId}&app_version=v2`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error(`ML DELETE Error [${res.status}] para ${itemId}`);
  return { success: true, itemId };
}

// Eliminar TODAS las promociones de un ítem (excepto DOD y LIGHTNING)
export async function removeAllPromotionsFromItem(itemId, accessToken) {
  const url = `${MELI_BASE_URL}/seller-promotions/items/${itemId}?app_version=v2`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error(`ML Bulk DELETE Error [${res.status}] para ${itemId}`);
  return res.json();
}

// ── GESTIÓN DE CAMPAÑAS DEL VENDEDOR ──────────────────────────────

// Crear nueva SELLER_CAMPAIGN (máximo 14 días de duración)
export async function createSellerCampaign(name, startDate, finishDate, accessToken) {
  return meliPromoPost(`/seller-promotions/promotions?app_version=v2`, accessToken, {
    promotion_type: 'SELLER_CAMPAIGN',
    name,
    sub_type: 'FLEXIBLE_PERCENTAGE',
    start_date: startDate,  // "YYYY-MM-DDTHH:MM:SS" — formato LOCAL
    finish_date: finishDate
  });
}

// Actualizar SELLER_CAMPAIGN (solo los campos enviados se modifican)
export async function updateSellerCampaign(promotionId, fields, accessToken) {
  const url = `${MELI_BASE_URL}/seller-promotions/promotions/${promotionId}?app_version=v2`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ promotion_type: 'SELLER_CAMPAIGN', ...fields })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `ML PUT Error [${res.status}]`);
  }
  return res.json();
}

// Eliminar SELLER_CAMPAIGN
export async function deleteSellerCampaign(promotionId, accessToken) {
  const url = `${MELI_BASE_URL}/seller-promotions/promotions/${promotionId}?promotion_type=SELLER_CAMPAIGN&app_version=v2`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error(`ML DELETE Campaign Error [${res.status}]`);
  return { success: true, promotionId };
}

// Consultar detalle de una campaña
export async function getCampaignDetail(promotionId, promotionType, accessToken) {
  return meliPromoGet(
    `/seller-promotions/promotions/${promotionId}?promotion_type=${promotionType}&app_version=v2`,
    accessToken
  );
}

// Consultar ítems de una campaña (paginado)
export async function getCampaignItems(promotionId, promotionType, accessToken, limit = 50, searchAfter = null) {
  let url = `/seller-promotions/promotions/${promotionId}/items?promotion_type=${promotionType}&app_version=v2&limit=${limit}`;
  if (searchAfter) url += `&search_after=${encodeURIComponent(searchAfter)}`;
  return meliPromoGet(url, accessToken);
}
