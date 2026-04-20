// ================================================================
// lib/meli.js
// Cliente de la API de Mercado Libre + helpers de autenticación
// ================================================================
const MELI_BASE_URL = "https://api.mercadolibre.com";
const MELI_AUTH_URL = "https://auth.mercadolibre.com.ve"; // MLV = Venezuela

// -----------------------------------------------------------------
// Genera la URL de autorización OAuth (para el botón "Iniciar Sesión")
// Modo: 'login' (abre navegador) | 'delegate' (genera link para compartir)
// -----------------------------------------------------------------
export function getMeliAuthUrl(state = "") {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.MELI_CLIENT_ID,
    redirect_uri: process.env.MELI_REDIRECT_URI,
    state, // Puede llevar info sobre el "tenant" que autorizó
  });

  return `${MELI_AUTH_URL}/authorization?${params.toString()}`;
}

// -----------------------------------------------------------------
// Intercambia el 'code' de OAuth por access_token + refresh_token
// -----------------------------------------------------------------
export async function exchangeCodeForToken(code) {
  const res = await fetch(`${MELI_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.MELI_CLIENT_ID,
      client_secret: process.env.MELI_CLIENT_SECRET,
      code,
      redirect_uri: process.env.MELI_REDIRECT_URI,
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
// -----------------------------------------------------------------
export async function meliGet(endpoint, accessToken) {
  const res = await fetch(`${MELI_BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
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
    "1_red":    { label: "Rojo",        color: "#ef4444", emoji: "🔴" },
    "2_orange": { label: "Naranja",     color: "#f97316", emoji: "🟠" },
    "3_yellow": { label: "Amarillo",    color: "#eab308", emoji: "🟡" },
    "4_light_green": { label: "Verde Claro", color: "#84cc16", emoji: "🟢" },
    "5_green":  { label: "Verde",       color: "#10b981", emoji: "🟢" },
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
