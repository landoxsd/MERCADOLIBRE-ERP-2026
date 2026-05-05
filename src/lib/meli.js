// ================================================================
// lib/meli.js
// Cliente de la API de Mercado Libre + helpers de autenticación
// ================================================================
const MELI_BASE_URL = "https://api.mercadolibre.com";
const MELI_AUTH_URL = "https://auth.mercadolibre.com"; // Versión global para mayor compatibilidad

// -----------------------------------------------------------------
// redirectUri: opcional, por defecto usa el de .env
export function getMeliAuthUrl(state = "", customRedirectUri = null) {
  const redirect_uri = customRedirectUri || process.env.MELI_REDIRECT_URI;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.MELI_CLIENT_ID,
    redirect_uri,
    state,
  });

  return `${MELI_AUTH_URL}/authorization?${params.toString()}`;
}

// -----------------------------------------------------------------
// Intercambia el 'code' de OAuth por access_token + refresh_token
// -----------------------------------------------------------------
// code: el código recibido de ML
// customRedirectUri: opcional, debe coincidir con el usado en la autorización
export async function exchangeCodeForToken(code, customRedirectUri = null) {
  const redirect_uri = customRedirectUri || process.env.MELI_REDIRECT_URI;

  const res = await fetch(`${MELI_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.MELI_CLIENT_ID,
      client_secret: process.env.MELI_CLIENT_SECRET,
      code,
      redirect_uri,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`ML OAuth Error: ${err.message || res.status}`);
  }
  return res.json(); // { access_token, refresh_token, expires_in, user_id, ... }
}

// -----------------------------------------------------------------
// Refresca el access_token cuando vence (usando refresh_token)
// -----------------------------------------------------------------
export async function refreshAccessToken(refreshToken) {
  const res = await fetch(`${MELI_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.MELI_CLIENT_ID,
      client_secret: process.env.MELI_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error("No se pudo refrescar el token de ML");
  return res.json();
}

// -----------------------------------------------------------------
// Obtiene el perfil del usuario autenticado en ML
// -----------------------------------------------------------------
export async function getMeliUserProfile(accessToken) {
  const res = await fetch(`${MELI_BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("No se pudo obtener perfil de ML");
  return res.json(); // { id, nickname, email, site_id, ... }
}

// -----------------------------------------------------------------
// Helper genérico para llamar la API de ML con el token vigente
// Incluye retry con backoff exponencial para HTTP 429 (rate limit)
// -----------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function meliGet(endpoint, accessToken, retryCount = 0) {
  const res = await fetch(`${MELI_BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));

    // Retry con backoff exponencial para Rate Limit (429)
    if (res.status === 429 && retryCount < 3) {
      const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 30000);
      console.warn(`[meliGet] Rate limit en ${endpoint}. Reintentando en ${backoffMs}ms (intento ${retryCount + 1}/3)...`);
      await sleep(backoffMs);
      return meliGet(endpoint, accessToken, retryCount + 1);
    }

    throw new Error(`ML API Error [${res.status}]: ${err.message || endpoint}`);
  }

  return res.json();
}

// =================================================================
// MÓDULO: RESUMEN DE CUENTA
// Combina reputación + facturación + métricas en un solo objeto
// =================================================================

// -----------------------------------------------------------------
// Reputación del vendedor (nivel, color, transacciones, ratings)
// Fuente: GET /users/{user_id}
// -----------------------------------------------------------------
export async function getSellerReputation(userId, accessToken) {
  const profile = await meliGet(`/users/${userId}`, accessToken);
  const rep = profile.seller_reputation || {};

  // Mapear level_id a etiqueta legible
  const LEVEL_MAP = {
    "1_red": { label: "Rojo", color: "#ef4444", emoji: "🔴" },
    "2_orange": { label: "Naranja", color: "#f97316", emoji: "🟠" },
    "3_yellow": { label: "Amarillo", color: "#eab308", emoji: "🟡" },
    "4_light_green": { label: "Verde Claro", color: "#84cc16", emoji: "🟢" },
    "5_green": { label: "Verde", color: "#10b981", emoji: "🟢" },
  };

  const levelInfo = LEVEL_MAP[rep.level_id] || { label: "Sin color", color: "#64748b", emoji: "⚪" };

  return {
    levelId: rep.level_id || null,
    levelLabel: levelInfo.label,
    levelColor: levelInfo.color,
    levelEmoji: levelInfo.emoji,
    powerSeller: rep.power_seller_status || null, // "silver" | "gold" | "platinum" | null
    transactions: {
      total: rep.transactions?.total || 0,
      completed: rep.transactions?.completed || 0,
      canceled: rep.transactions?.canceled || 0,
      ratings: {
        positive: rep.transactions?.ratings?.positive || 0,
        negative: rep.transactions?.ratings?.negative || 0,
        neutral: rep.transactions?.ratings?.neutral || 0,
      }
    },
    siteStatus: profile.site_status || "unknown",
    permalink: profile.permalink || null, // URL de "Mi Página"
    thumbnail: profile.thumbnail || null,
    points: profile.points || 0,
    nickname: profile.nickname,
  };
}

// -----------------------------------------------------------------
// Facturación: Resumen del mes actual + estimación de deuda
// Fuente: GET /billing/integration/periods/key/{key}/summary/details
// -----------------------------------------------------------------
export async function getBillingSummary(userId, accessToken) {
  // Calcular la clave del período actual (YYYY-MM-01)
  const now = new Date();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  try {
    const summary = await meliGet(
      `/billing/integration/periods/key/${periodKey}/summary/details?caller.id=${userId}&group=ML`,
      accessToken
    );

    // Calcular deuda estimada = total de cargos - total de pagos
    const totalCharges = summary?.total_amount || 0;
    const totalPaid = summary?.total_paid || 0;
    const estimatedDebt = Math.max(0, totalCharges - totalPaid);

    return {
      periodKey,
      totalCharges,
      totalPaid,
      estimatedDebt,
      isUpToDate: estimatedDebt === 0,
      currency: summary?.currency_id || "USD",
      details: summary,
    };
  } catch {
    // Si no hay datos de facturación (cuenta nueva o sin cargos)
    return {
      periodKey,
      totalCharges: 0,
      totalPaid: 0,
      estimatedDebt: 0,
      isUpToDate: true,
      currency: "USD",
      details: null,
      note: "Sin cargos en el período actual",
    };
  }
}

// -----------------------------------------------------------------
// Métricas de ventas del período (últimos 7 días por defecto)
// Fuente: GET /users/{user_id}/classifiedads/views
//         GET /seller-report (ML no tiene endpoint directo de ventas simples)
//         Usamos /orders filtrado por fecha
// -----------------------------------------------------------------
export async function getSalesSummary(userId, accessToken, days = 7) {
  const dateTo = new Date();
  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const fmt = (d) => d.toISOString().split("T")[0] + "T00:00:00.000-00:00";

  try {
    const data = await meliGet(
      `/orders/search?seller=${userId}&order.status=paid` +
      `&order.date_created.from=${encodeURIComponent(fmt(dateFrom))}` +
      `&order.date_created.to=${encodeURIComponent(fmt(dateTo))}` +
      `&limit=50`,
      accessToken
    );

    const orders = data?.results || [];
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalUnits = orders.reduce((sum, o) =>
      sum + o.order_items?.reduce((s, i) => s + i.quantity, 0), 0
    );

    return {
      period: `${days} días`,
      totalOrders: data?.paging?.total || orders.length,
      totalRevenue,
      totalUnits,
      averageTicket: orders.length ? (totalRevenue / orders.length) : 0,
    };
  } catch {
    return {
      period: `${days} días`,
      totalOrders: 0,
      totalRevenue: 0,
      totalUnits: 0,
      averageTicket: 0,
    };
  }
}

// -----------------------------------------------------------------
// Resumen completo: combina los 3 anteriores en 1 sola llamada
// Optimizado para el widget principal del Dashboard
// -----------------------------------------------------------------
export async function getAccountOverview(userId, accessToken) {
  const [reputation, billing, sales7d, sales30d] = await Promise.allSettled([
    getSellerReputation(userId, accessToken),
    getBillingSummary(userId, accessToken),
    getSalesSummary(userId, accessToken, 7),
    getSalesSummary(userId, accessToken, 30),
  ]);

  return {
    reputation: reputation.status === "fulfilled" ? reputation.value : null,
    billing: billing.status === "fulfilled" ? billing.value : null,
    sales7d: sales7d.status === "fulfilled" ? sales7d.value : null,
    sales30d: sales30d.status === "fulfilled" ? sales30d.value : null,
  };
}

// =================================================================
// MÓDULO: GESTIÓN DE PUBLICACIONES (ITEMS)
// Soporte para volumen masivo (18k+) y Autopartes
// =================================================================

/**
 * Obtiene todos los IDs de publicaciones de un usuario (paginado).
 * ML permite hasta 1000 IDs via búsqueda simple, para más de 1000
 * se requiere scroll o filtrado por estado.
 */
/**
 * Obtiene todos los IDs de publicaciones de un usuario usando Scroll API.
 * Indispensable para catálogos masivos (> 1000 items).
 */
export async function getAllItemIds(userId, accessToken, status = "active") {
  let statusesToFetch = [status];

  if (status === "all") {
    statusesToFetch = ["active", "paused", "closed"];
  } else if (status && status.includes(",")) {
    statusesToFetch = status.split(",").map(s => s.trim()).filter(Boolean);
  }

  let allIds = [];

  for (const currentStatus of statusesToFetch) {
    let scrollId = null;
    let hasMore = true;

    console.log(`📡 Iniciando Scroll para usuario ${userId} [Estado: ${currentStatus}]...`);

    while (hasMore) {
      const url = new URL(`${MELI_BASE_URL}/users/${userId}/items/search`);

      // Pasar siempre el status para evitar que ML omita estados ocultos por defecto
      url.searchParams.set("status", currentStatus);
      url.searchParams.set("search_type", "scan");
      url.searchParams.set("limit", "1000");
      if (scrollId) url.searchParams.set("scroll_id", scrollId);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn(`🚧 Scroll interrumpido o API sin resultados para estado ${currentStatus} [${res.status}]: ${err.message || 'Unknown'}`);
        break;
      }

      const data = await res.json();
      const ids = data.results || [];
      allIds = [...allIds, ...ids];

      scrollId = data.scroll_id;
      hasMore = ids.length > 0 && !!scrollId;

      if (allIds.length % 5000 === 0 && allIds.length > 0) {
        console.log(`  🔹 Progreso IDs: ${allIds.length}...`);
      }
    }
  }

  console.log(`✅ Scroll finalizado. Total IDs recuperados para todos los estados solicitados: ${allIds.length}`);
  return Array.from(new Set(allIds));
}

/**
 * Obtiene detalles de varios ítems en una sola llamada (Multiget).
 * Máximo 20 IDs por llamada (límite de ML).
 */
export async function getItemsBatch(itemIds, accessToken) {
  if (!itemIds.length) return [];

  // Dividir en grupos de 20
  const chunks = [];
  for (let i = 0; i < itemIds.length; i += 20) {
    chunks.push(itemIds.slice(i, i + 20));
  }

  const allItems = [];
  for (const chunk of chunks) {
    const idsParam = chunk.join(",");
    const res = await meliGet(`/items?ids=${idsParam}`, accessToken);
    // ML devuelve un array de objetos { code, body }
    const items = res.map(r => r.body).filter(b => b.id);
    allItems.push(...items);
  }

  return allItems;
}

/**
 * Obtiene el puntaje de salud y consejos de mejora de una publicación.
 * Fuente: GET /items/{item_id}/health
 */
export async function getItemHealth(itemId, accessToken) {
  try {
    return await meliGet(`/items/${itemId}/health`, accessToken);
  } catch {
    return null;
  }
}

/**
 * Obtiene la lista de compatibilidades (vehículos) para una autoparte.
 * Fuente: GET /items/{item_id}/compatibility
 */
export async function getItemCompatibility(itemId, accessToken) {
  try {
    return await meliGet(`/items/${itemId}/compatibility`, accessToken);
  } catch {
    return null;
  }
}

/**
 * Obtiene los atributos obligatorios para una categoría específica.
 * Filtra aquellos que tienen tags.required = true.
 */
export async function getCategoryAttributes(categoryId) {
  try {
    const res = await fetch(`${MELI_BASE_URL}/categories/${categoryId}/attributes`);
    if (!res.ok) return [];
    const attributes = await res.json();
    
    // Filtramos atributos que son obligatorios de forma general o para catalogo
    return attributes.filter(a => 
      (a.tags && a.tags.required) || 
      (a.tags && a.tags.catalog_required)
    );
  } catch (err) {
    console.error("Error obteniendo atributos de categoría:", err);
    return [];
  }
}

/**
 * Sube una imagen a los servidores de ML.
 * Devuelve un objeto con el ID de la imagen para asociar al ítem.
 */
export async function uploadPicture(fileBuffer, filename, accessToken) {
  const boundary = '----MercadoLibreFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';

  const ext = filename.split('.').pop().toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const partHeader = Buffer.from(
    `--${boundary}${crlf}` +
    `Content-Disposition: form-data; name="file"; filename="image.jpg"${crlf}` +
    `Content-Type: ${mimeType}${crlf}${crlf}`
  );

  const partFooter = Buffer.from(`${crlf}--${boundary}--${crlf}`);
  const body = Buffer.concat([partHeader, fileBuffer, partFooter]);

  const res = await fetch(`${MELI_BASE_URL}/pictures/items/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": body.length.toString()
    },
    body: body,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("❌ ML Picture Upload Error:", errorBody);
    throw new Error(`Error al subir imagen a ML: ${errorBody}`);
  }
  return res.json();
}

/**
 * Obtiene las visitas de varios items en una sola llamada.
 * ML permite consultar varios IDs separados por coma.
 */
export async function getItemsVisitsBatch(itemIds, accessToken) {
  if (!itemIds.length) return {};
  try {
    const idsParam = itemIds.join(",");
    const res = await meliGet(`/items/visits?ids=${idsParam}`, accessToken);
    // ML devuelve un objeto donde las llaves son los item_ids
    return res || {};
  } catch (err) {
    console.error("Error al obtener visitas batch:", err);
    return {};
  }
}

/**
 * Extrae el SKU Real (Primary Key del usuario).
 * Prioriza el seller_custom_field que es el que coincide con el sistema local.
 */
export function extractSku(item) {
  if (!item) return null;

  // 1. Prioridad Máxima: seller_custom_field (Es el SKU que el usuario ve en la ficha de stock)
  if (item.seller_custom_field) return item.seller_custom_field;

  // 2. Segunda opción: Buscar en variaciones (si existen)
  if (item.variations && item.variations.length > 0) {
    // Buscamos el primero que tenga seller_custom_field
    const withCustom = item.variations.find(v => v.seller_custom_field);
    if (withCustom) return withCustom.seller_custom_field;

    // Si no, buscamos SELLER_SKU en atributos de variación
    for (const v of item.variations) {
      const vSku = v.attributes?.find(a => a.id === 'SELLER_SKU')?.value_name;
      if (vSku) return vSku;
    }
  }

  // 3. Tercera opción: Atributo SELLER_SKU en la raíz
  const rootSellerSku = item.attributes?.find(a => a.id === 'SELLER_SKU')?.value_name;
  if (rootSellerSku) return rootSellerSku;

  // 4. Último recurso: PART_NUMBER (Solo si no hay nada más)
  const partNumber = item.attributes?.find(a => a.id === 'PART_NUMBER')?.value_name;

  return partNumber || null;
}

/**
 * Crea una nueva publicación en Mercado Libre.
 * itemData: el JSON con la estructura requerida por ML.
 */
export async function publishItem(itemData, accessToken) {
  const res = await fetch(`${MELI_BASE_URL}/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    body: JSON.stringify(itemData),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Error al publicar en ML: ${JSON.stringify(err)}`);
  }

  return res.json();
}

