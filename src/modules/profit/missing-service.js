// ================================================================
// src/modules/profit/missing-service.js
// Servicio de Detección de Publicaciones Faltantes agrupadas por Sub-línea
// Cruzando Profit Plus SQL Server (Solo Lectura) vs PostgreSQL Dell R630
// Incluye motor de Equivalencias (tabla equivalencia + ref/campo6/campo7)
// ================================================================
import fs from 'fs';
import path from 'path';
import { queryProfit } from './profit-client.js';
import { pgPool } from '../../lib/supabase-admin.js';

// Caché en memoria para nombres de fotos (evita re-escanear disco en cada request)
let photosMapCache = null; // Map<lowerFilename, originalFilename>
let photosCacheTime = 0;
const PHOTOS_CACHE_TTL_MS = 60000; // 1 minuto

export function getLocalPhotosMap() {
  const now = Date.now();
  if (photosMapCache && (now - photosCacheTime) < PHOTOS_CACHE_TTL_MS) {
    return photosMapCache;
  }

  const map = new Map();
  const candidatePaths = [
    'F:\\',
    'C:\\Users\\ORLANDO\\Pictures\\FOTOS',
    '\\\\Servidor\\e\\FOTOS',
    process.env.PHOTOS_PATH || '',
    '/mnt/fotos',
    '/fotos',
  ].filter(Boolean);

  for (const dir of candidatePaths) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const lower = file.toLowerCase();
          if (!map.has(lower)) {
            map.set(lower, file);
          }
        }
        if (map.size > 0) {
          photosMapCache = map;
          photosCacheTime = now;
          return map;
        }
      }
    } catch (e) {
      // Probar siguiente ruta
    }
  }

  photosMapCache = map;
  photosCacheTime = now;
  return map;
}

/**
 * Obtiene el conjunto de SKUs ya publicados en MercadoLibre (desde PostgreSQL local).
 */
export async function getPublishedSkusSet() {
  if (!pgPool) return new Set();
  try {
    const res = await pgPool.query(`
      SELECT DISTINCT UPPER(TRIM(sku)) as sku 
      FROM products 
      WHERE sku IS NOT NULL AND sku != '';
    `);
    const set = new Set();
    for (const row of res.rows) {
      const parts = row.sku.split(/[, /;]+/).filter(Boolean);
      for (const p of parts) {
        set.add(p.trim().toUpperCase());
      }
    }
    return set;
  } catch (err) {
    console.error('Error obteniendo SKUs publicados de PostgreSQL:', err.message);
    return new Set();
  }
}

/**
 * Retorna el resumen consolidado de todas las sublíneas con sus faltantes.
 */
export async function getSublinesSummary({ minFaltantes = 0, search = '' } = {}) {
  // 1. Obtener SKUs publicados
  const publishedSet = await getPublishedSkusSet();

  // 2. Consultar Profit Plus (Solo Lectura con NOLOCK)
  const q = `
    SELECT 
      RTRIM(a.co_art) as sku,
      RTRIM(ISNULL(s.subl_des, 'SIN SUBLINEA')) as sublinea,
      RTRIM(ISNULL(a.co_subl, '')) as co_subl,
      RTRIM(ISNULL(a.ref, '')) as ref,
      RTRIM(ISNULL(a.campo7, '')) as campo7,
      ISNULL(st.stock_total, 0) as stock_total
    FROM art a WITH (NOLOCK)
    LEFT JOIN sub_lin s WITH (NOLOCK) ON a.co_subl = s.co_subl
    LEFT JOIN (
      SELECT co_art, SUM(stock_act) as stock_total
      FROM st_almac WITH (NOLOCK)
      GROUP BY co_art
    ) st ON a.co_art = st.co_art
    WHERE ISNULL(st.stock_total, 0) > 0 AND a.anulado = 0;
  `;

  const items = await queryProfit(q);

  // 3. Mapear categoría ML por sublínea desde category_mappings si existe
  const categoryMap = new Map();
  if (pgPool) {
    try {
      const catRes = await pgPool.query(`
        SELECT internal_name, meli_category_id 
        FROM category_mappings;
      `);
      for (const row of catRes.rows) {
        categoryMap.set(row.internal_name.trim().toUpperCase(), row.meli_category_id);
      }
    } catch (e) {
      // category_mappings opcional
    }
  }

  // 4. Agrupar por sublínea
  const sublinesMap = new Map();

  for (const item of items) {
    const skuNorm = item.sku.trim().toUpperCase();
    const refNorm = item.ref ? item.ref.trim().toUpperCase() : '';
    const subName = item.sublinea || 'SIN SUBLINEA';

    // Verificación rápida: si SKU o ref ya están en publicados
    const isPublished = publishedSet.has(skuNorm) || (refNorm && publishedSet.has(refNorm));

    if (!sublinesMap.has(subName)) {
      sublinesMap.set(subName, {
        sublinea: subName,
        co_subl: item.co_subl,
        total_con_stock: 0,
        publicados: 0,
        faltantes: 0,
        meli_category_id: categoryMap.get(subName.toUpperCase()) || null
      });
    }

    const entry = sublinesMap.get(subName);
    entry.total_con_stock++;
    if (isPublished) {
      entry.publicados++;
    } else {
      entry.faltantes++;
    }
  }

  // 5. Filtrar y ordenar de mayor a menor número de faltantes
  const searchLower = search.trim().toLowerCase();
  const filtered = Array.from(sublinesMap.values())
    .filter(x => {
      if (x.faltantes < minFaltantes) return false;
      if (searchLower && !x.sublinea.toLowerCase().includes(searchLower) && !x.co_subl.toLowerCase().includes(searchLower)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.faltantes - a.faltantes)
    .map(x => ({
      ...x,
      total_batches_50: Math.ceil(x.faltantes / 50),
      total_batches_25: Math.ceil(x.faltantes / 25),
      pct_publicado: x.total_con_stock > 0 
        ? Math.round((x.publicados / x.total_con_stock) * 100) 
        : 0
    }));

  return {
    total_sublines: filtered.length,
    total_articulos_faltantes: filtered.reduce((acc, x) => acc + x.faltantes, 0),
    total_articulos_stock: filtered.reduce((acc, x) => acc + x.total_con_stock, 0),
    total_articulos_publicados: filtered.reduce((acc, x) => acc + x.publicados, 0),
    sublines: filtered
  };
}

/**
 * Obtiene los artículos faltantes de una sublínea específica con paginación por lotes,
 * cruzando la tabla de equivalencias de SQL Server y fotos locales.
 */
export async function getMissingItemsBySubline(co_subl, { page = 1, limit = 50, search = '', photoFilter = 'all' } = {}) {
  const publishedSet = await getPublishedSkusSet();
  const photosMap = getLocalPhotosMap();

  const q = `
    SELECT 
      RTRIM(a.co_art) as sku,
      RTRIM(a.art_des) as descripcion,
      RTRIM(ISNULL(a.modelo, '')) as modelo,
      RTRIM(ISNULL(a.ref, '')) as referencia,
      RTRIM(ISNULL(a.campo6, '')) as campo6,
      RTRIM(ISNULL(a.campo7, '')) as campo7,
      ROUND(a.prec_vta1, 2) as precio,
      ROUND(ISNULL(a.cos_pro_om, a.ult_cos_om), 2) as costo_usd,
      RTRIM(ISNULL(s.subl_des, '')) as sublinea,
      RTRIM(a.co_subl) as co_subl,
      ISNULL(st.stock_total, 0) as stock_total
    FROM art a WITH (NOLOCK)
    LEFT JOIN sub_lin s WITH (NOLOCK) ON a.co_subl = s.co_subl
    LEFT JOIN (
      SELECT co_art, SUM(stock_act) as stock_total
      FROM st_almac WITH (NOLOCK)
      GROUP BY co_art
    ) st ON a.co_art = st.co_art
    WHERE RTRIM(a.co_subl) = @co_subl AND ISNULL(st.stock_total, 0) > 0 AND a.anulado = 0
    ORDER BY ISNULL(st.stock_total, 0) DESC, a.co_art ASC;
  `;

  const allItems = await queryProfit(q, { co_subl: co_subl.trim() });
  if (!allItems || allItems.length === 0) {
    return {
      co_subl: co_subl.trim(),
      sublinea: '',
      total_faltantes: 0,
      total_filtrados: 0,
      total_con_foto: 0,
      total_sin_foto: 0,
      page: 1,
      limit: typeof limit === 'number' ? limit : 50,
      total_pages: 0,
      items: []
    };
  }

  // 1. Obtener todas las equivalencias de la tabla equivalencia para estos artículos
  const skuList = allItems.map(i => i.sku.trim());
  const equivMap = new Map(); // Map<sku, Set<equivalencia>>

  // Consulta por lotes de 100 artículos para la tabla equivalencia
  const CHUNK_SIZE = 100;
  for (let i = 0; i < skuList.length; i += CHUNK_SIZE) {
    const chunk = skuList.slice(i, i + CHUNK_SIZE);
    const inParams = chunk.map((_, idx) => `@sku_${idx}`).join(', ');
    const paramsObj = {};
    chunk.forEach((sku, idx) => {
      paramsObj[`sku_${idx}`] = sku;
    });

    const eqQuery = `
      SELECT RTRIM(co_art) as co_art, RTRIM(equivalencia) as equivalencia
      FROM equivalencia WITH (NOLOCK)
      WHERE co_art IN (${inParams});
    `;

    try {
      const eqRows = await queryProfit(eqQuery, paramsObj);
      for (const r of eqRows) {
        const art = r.co_art.trim().toUpperCase();
        const eq = r.equivalencia.trim().toUpperCase();
        if (!equivMap.has(art)) equivMap.set(art, new Set());
        equivMap.get(art).add(eq);
      }
    } catch (e) {
      console.warn('Error consultando tabla equivalencia en lote:', e.message);
    }
  }

  // 2. Filtrar solo los que NO están publicados
  // Un artículo se considera publicado si su SKU o CUALQUIERA de sus equivalencias está en publishedSet
  const missingItems = [];
  const sublineName = allItems[0]?.sublinea || '';

  for (const item of allItems) {
    const skuUpper = item.sku.trim().toUpperCase();

    // Recolectar todas las equivalencias
    const equivSet = new Set();
    if (equivMap.has(skuUpper)) {
      for (const eq of equivMap.get(skuUpper)) equivSet.add(eq);
    }

    // Agregar códigos de ref, campo6 y campo7
    const extraCodes = [item.referencia, item.campo6, item.campo7]
      .filter(Boolean)
      .flatMap(str => str.split(/[, /;]+/).map(s => s.trim().toUpperCase()))
      .filter(s => s.length >= 3 && s !== skuUpper);

    for (const ec of extraCodes) equivSet.add(ec);

    // Regla de Negocio: SKUs terminados en 'E' son Genéricos / Multimarcas.
    // El SKU base sin 'E' y la variante con 'E' son equivalentes recíprocos.
    const isGenericE = skuUpper.endsWith('E') && skuUpper.length > 2;
    if (isGenericE) {
      const baseCode = skuUpper.slice(0, -1);
      equivSet.add(baseCode);
    } else {
      equivSet.add(`${skuUpper}E`);
    }

    // ¿Está publicado el SKU o alguna equivalencia?
    let isPublished = publishedSet.has(skuUpper);
    if (!isPublished) {
      for (const eq of equivSet) {
        if (publishedSet.has(eq)) {
          isPublished = true;
          break;
        }
      }
    }

    if (!isPublished) {
      missingItems.push({
        ...item,
        equivalencias: Array.from(equivSet),
      });
    }
  }

  // 3. Enriquecer con detección de fotos locales
  const enrichedItems = missingItems.map(item => {
    const skuRaw = item.sku.trim();
    const skuLower = skuRaw.toLowerCase();

    const foundPhotos = [];
    const suffixes = ['-0', '-1', '-2', '-3', '-4', ''];
    const extensions = ['.jpg', '.jpeg', '.png'];

    for (const sfx of suffixes) {
      for (const ext of extensions) {
        const candidate = `${skuLower}${sfx}${ext}`;
        if (photosMap.has(candidate)) {
          const original = photosMap.get(candidate);
          if (!foundPhotos.includes(original)) {
            foundPhotos.push(original);
          }
        }
      }
    }

    const hasPhoto = foundPhotos.length > 0;
    const primaryPhoto = foundPhotos[0] || null;

    return {
      sku: skuRaw,
      descripcion: item.descripcion,
      modelo: item.modelo,
      referencia: item.referencia,
      campo6: item.campo6,
      campo7: item.campo7,
      equivalencias: item.equivalencias,
      precio: item.precio,
      costo_usd: item.costo_usd,
      stock_total: item.stock_total,
      sublinea: item.sublinea,
      co_subl: item.co_subl,
      is_generic_e: skuRaw.toUpperCase().endsWith('E'),
      brand_suggested: skuRaw.toUpperCase().endsWith('E') ? 'Genérico / Multimarca' : 'Genérico',
      has_photo: hasPhoto,
      photos_count: foundPhotos.length,
      photos: foundPhotos,
      photo_filename: primaryPhoto,
      photo_url: primaryPhoto ? `/api/profit/photos?filename=${encodeURIComponent(primaryPhoto)}` : null,
    };
  });

  // 4. Aplicar filtros de búsqueda y foto
  let filtered = enrichedItems;

  if (photoFilter === 'with') {
    filtered = filtered.filter(it => it.has_photo);
  } else if (photoFilter === 'without') {
    filtered = filtered.filter(it => !it.has_photo);
  }

  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    filtered = filtered.filter(it => 
      it.sku.toLowerCase().includes(term) ||
      it.descripcion.toLowerCase().includes(term) ||
      it.modelo.toLowerCase().includes(term) ||
      it.referencia.toLowerCase().includes(term) ||
      it.campo7.toLowerCase().includes(term) ||
      it.equivalencias.some(eq => eq.toLowerCase().includes(term))
    );
  }

  const totalFiltered = filtered.length;
  const isAll = limit === 'all' || limit === 0 || limit >= 9999;
  const numLimit = isAll ? totalFiltered : Math.max(1, parseInt(limit, 10));
  const numPage = Math.max(1, parseInt(page, 10));
  const offset = isAll ? 0 : (numPage - 1) * numLimit;
  const paginated = isAll ? filtered : filtered.slice(offset, offset + numLimit);

  const withPhotosCount = enrichedItems.filter(i => i.has_photo).length;
  const withoutPhotosCount = enrichedItems.length - withPhotosCount;

  return {
    co_subl: co_subl.trim(),
    sublinea: sublineName,
    total_faltantes: enrichedItems.length,
    total_filtrados: totalFiltered,
    total_con_foto: withPhotosCount,
    total_sin_foto: withoutPhotosCount,
    page: numPage,
    limit: numLimit,
    total_pages: isAll ? 1 : Math.ceil(totalFiltered / numLimit),
    items: paginated
  };
}
