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
