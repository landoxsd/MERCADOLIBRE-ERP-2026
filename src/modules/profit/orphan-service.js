// src/modules/profit/orphan-service.js
// Servicio de Detección y Sugerencia de Cambios de Código para Huérfanos y Descontinuados
// REGLA CRÍTICA: Profit Plus SQL Server (192.168.1.10:1433 RWC20_A) es ESTRICTAMENTE SOLO LECTURA.

import { queryProfit } from './profit-client.js';
import { pgPool } from '@/lib/supabase-admin';
import { getValidAccessToken } from '@/lib/meli-auth-helper';

const MELI_BASE_URL = 'https://api.mercadolibre.com';

/**
 * Escanea publicaciones en Mercado Libre (PostgreSQL) y busca coincidencias inteligentes
 * en Profit Plus (artículos descontinuados con stock, equivalencias, y sufijos genéricos 'E').
 */
export async function getOrphanSuggestions({ page = 1, limit = 50, filter = 'pending' } = {}) {
  // 1. Obtener artículos descontinuados que tienen stock físico en Profit Plus
  const discontinuedQuery = `
    SELECT 
      RTRIM(a.co_art) as co_art,
      RTRIM(a.art_des) as art_des,
      RTRIM(ISNULL(a.modelo, '')) as modelo,
      ROUND(a.prec_vta1, 2) as precio,
      ROUND(ISNULL(a.cos_pro_om, a.ult_cos_om), 2) as costo_usd,
      ISNULL(st.stock_total, 0) as stock_total
    FROM art a WITH (NOLOCK)
    JOIN (
      SELECT co_art, SUM(stock_act) as stock_total 
      FROM st_almac WITH (NOLOCK) 
      GROUP BY co_art 
      HAVING SUM(stock_act) > 0
    ) st ON a.co_art = st.co_art
    WHERE (a.art_des LIKE '%DESCONTINUADO%USE%' OR a.art_des LIKE '%DESCONTINUADO%')
      AND a.anulado = 0
  `;

  const discontinuedInProfit = await queryProfit(discontinuedQuery).catch(() => []);

  // Extraer todos los SKUs objetivo de Profit (bidireccional: nuevo -> viejo, viejo -> nuevo)
  const candidateTargets = new Map(); // targetSku -> profitItem
  for (const item of discontinuedInProfit) {
    const desc = item.art_des.toUpperCase();
    const matches = desc.match(/USE\s+([A-Z0-9\-_]+)/g);
    if (matches) {
      for (const m of matches) {
        const code = m.replace(/USE\s+/, '').trim();
        if (code) candidateTargets.set(code, item);
      }
    }
    const mod = item.modelo.trim().toUpperCase();
    if (mod && mod !== item.co_art) {
      candidateTargets.set(mod, item);
    }
    // También incluir el co_art descontinuado
    candidateTargets.set(item.co_art.trim().toUpperCase(), item);
  }

  const targetList = Array.from(candidateTargets.keys());

  if (targetList.length > 0) {
    // 2. Buscar en PostgreSQL publicaciones de Mercado Libre que coincidan
    const { rows: matchedProducts } = await pgPool.query(`
      SELECT meli_item_id, meli_account_id, sku, title, status, price, available_qty, permalink, thumbnail
      FROM products
      WHERE UPPER(sku) = ANY($1)
    `, [targetList]).catch(() => ({ rows: [] }));

    // 3. Insertar propuestas en orphan_proposals
    for (const prod of matchedProducts) {
      const rawSku = (prod.sku || '').trim().toUpperCase();
      const profitCand = candidateTargets.get(rawSku);
      if (!profitCand) continue;

      // El SKU sugerido:
      // Si la publicación en ML tiene el código nuevo (ej: K9009) que está en 0, sugerimos el código con stock físico (10384)
      // Si la publicación en ML tiene el código descontinuado (10384), sugerimos actualizar stock y precio del código 10384
      let suggestedSku = profitCand.co_art.trim();
      let reasonText = `La publicación en ML usa '${rawSku}' (stock ML: ${prod.available_qty}), pero en Profit el código '${profitCand.co_art}' (${profitCand.art_des}) tiene ${profitCand.stock_total} unidades en almacén con precio $${profitCand.precio.toFixed(2)}.`;
      
      await pgPool.query(`
        INSERT INTO orphan_proposals 
          (meli_item_id, current_sku, suggested_sku, match_type, reason, profit_stock, profit_price, profit_art_des, status)
        VALUES ($1, $2, $3, 'discontinued_replacement', $4, $5, $6, $7, 'pending')
        ON CONFLICT (meli_item_id, suggested_sku) 
        DO UPDATE SET 
          profit_stock = EXCLUDED.profit_stock,
          profit_price = EXCLUDED.profit_price,
          reason = EXCLUDED.reason;
      `, [
        prod.meli_item_id,
        rawSku,
        suggestedSku,
        reasonText,
        profitCand.stock_total,
        profitCand.precio,
        profitCand.art_des
      ]).catch(err => console.warn('Error guardando propuesta:', err.message));
    }
  }

  // 4. Consultar base de datos consolidada con datos frescos de `products`
  const offset = (page - 1) * limit;
  const countRes = await pgPool.query(`
    SELECT COUNT(*) FROM orphan_proposals op
    WHERE op.status = $1
  `, [filter]);

  const total = parseInt(countRes.rows[0].count, 10);

  const queryItems = await pgPool.query(`
    SELECT 
      op.id,
      op.meli_item_id,
      op.current_sku,
      op.suggested_sku,
      op.match_type,
      op.reason,
      op.profit_stock,
      op.profit_price,
      op.profit_art_des,
      op.status,
      op.applied_at,
      op.created_at,
      p.title,
      p.status as ml_status,
      p.price as ml_price,
      p.available_qty as ml_stock,
      p.permalink,
      p.thumbnail,
      p.meli_account_id
    FROM orphan_proposals op
    LEFT JOIN products p ON op.meli_item_id = p.meli_item_id
    WHERE op.status = $1
    ORDER BY (p.available_qty = 0) DESC, op.created_at DESC
    LIMIT $2 OFFSET $3
  `, [filter, limit, offset]);

  return {
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
    items: queryItems.rows
  };
}

/**
 * Aprueba una propuesta de cambio de código de huérfano:
 * 1. Actualiza el SKU (SELLER_SKU), precio, stock y estado en Mercado Libre vía API oficial.
 * 2. Actualiza la tabla `products` en PostgreSQL.
 * 3. Marca la propuesta como 'approved' con marca de tiempo.
 */
export async function approveOrphanSuggestion({ id, meli_item_id, suggested_sku, update_ml = true }) {
  // 1. Obtener la propuesta
  const propRes = await pgPool.query(`
    SELECT op.*, p.meli_account_id, p.price as cur_price, p.available_qty as cur_stock
    FROM orphan_proposals op
    LEFT JOIN products p ON op.meli_item_id = p.meli_item_id
    WHERE op.id = $1 OR (op.meli_item_id = $2 AND op.suggested_sku = $3)
    LIMIT 1
  `, [id || 0, meli_item_id || '', suggested_sku || '']);

  if (!propRes.rows.length) {
    throw new Error('Propuesta no encontrada');
  }

  const prop = propRes.rows[0];
  const accountId = prop.meli_account_id;
  const targetSku = prop.suggested_sku;
  const newPrice = parseFloat(prop.profit_price) || 0;
  const newStock = parseInt(prop.profit_stock, 10) || 1;

  let mlUpdateResult = null;

  if (update_ml && accountId) {
    const accessToken = await getValidAccessToken(accountId);

    // Actualizar atributos (SELLER_SKU)
    const updateBody = {
      attributes: [
        { id: 'SELLER_SKU', value_name: targetSku }
      ]
    };

    if (newPrice >= 2) {
      updateBody.price = newPrice;
    }
    if (newStock > 0) {
      updateBody.available_quantity = newStock;
      updateBody.status = 'active'; // Reactivar si estaba en cero
    }

    const res = await fetch(`${MELI_BASE_URL}/items/${prop.meli_item_id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateBody)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn(`Aviso actualizando ML para ${prop.meli_item_id}:`, JSON.stringify(errData));
      // Si falla cambio directo de status y precio a la vez, intentamos actualizar atributos solamente
      await fetch(`${MELI_BASE_URL}/items/${prop.meli_item_id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ attributes: [{ id: 'SELLER_SKU', value_name: targetSku }] })
      });
    } else {
      mlUpdateResult = await res.json().catch(() => ({}));
    }
  }

  // 2. Actualizar PostgreSQL
  await pgPool.query(`
    UPDATE products
    SET 
      sku = $1,
      price = CASE WHEN $2 > 0 THEN $2 ELSE price END,
      available_qty = CASE WHEN $3 > 0 THEN $3 ELSE available_qty END,
      status = CASE WHEN $3 > 0 THEN 'active' ELSE status END,
      updated_at = NOW()
    WHERE meli_item_id = $4
  `, [targetSku, newPrice, newStock, prop.meli_item_id]);

  // 3. Marcar propuesta como 'approved'
  await pgPool.query(`
    UPDATE orphan_proposals
    SET status = 'approved', applied_at = NOW()
    WHERE id = $1
  `, [prop.id]);

  return {
    success: true,
    message: `Código actualizado a '${targetSku}', stock sincronizado a ${newStock} y precio a $${newPrice.toFixed(2)}.`,
    meli_item_id: prop.meli_item_id,
    sku: targetSku,
    mlUpdateResult
  };
}

/**
 * Descarta / Rechaza una propuesta de cambio.
 */
export async function rejectOrphanSuggestion({ id }) {
  await pgPool.query(`
    UPDATE orphan_proposals
    SET status = 'rejected', applied_at = NOW()
    WHERE id = $1
  `, [id]);

  return { success: true, message: 'Propuesta descartada.' };
}
