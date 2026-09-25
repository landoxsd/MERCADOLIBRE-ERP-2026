// src/lib/meli-auth-helper.js
import { accountsTable } from "./supabase-admin";
import { refreshAccessToken } from "./meli";

/**
 * Obtiene un access_token válido para la cuenta especificada.
 * Si el token ha expirado, lo refresca automáticamente con Mercado Libre
 * y actualiza la base de datos de Supabase.
 */
export async function getValidAccessToken(accountId) {
  // 1. Buscar la cuenta en la base de datos
  const { data: account, error } = await accountsTable()
    .select("id, access_token, refresh_token, token_expiry, nickname")
    .eq("id", accountId)
    .single();

  if (error || !account) {
    throw new Error(`No se encontró la cuenta con ID: ${accountId}`);
  }

  const { access_token, refresh_token, token_expiry } = account;

  // 2. Verificar si el token ha expirado (o está a punto de expirar)
  // Añadimos un margen de seguridad de 5 minutos (300,000 ms)
  const expiryTime = new Date(token_expiry).getTime();
  const now = Date.now();
  const isExpired = now > (expiryTime - 300000);

  if (!isExpired) {
    // El token aún es válido, lo devolvemos
    return access_token;
  }

  // 3. El token ha expirado, procedemos a refrescarlo
  console.log(`🔄 El token de ${account.nickname} ha expirado. Refrescando...`);
  
  try {
    const freshData = await refreshAccessToken(refresh_token);
    const { access_token: newAccessToken, refresh_token: newRefreshToken, expires_in, user_id } = freshData;

    // Calcular nueva fecha de expiración
    const newTokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString();

    // 4. Actualizar la base de datos con los nuevos tokens
    const { error: updateError } = await accountsTable()
      .update({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_expiry: newTokenExpiry,
        updated_at: new Date().toISOString()
      })
      .eq("id", accountId);

    if (updateError) {
      throw new Error(`Error actualizando tokens en DB: ${updateError.message}`);
    }

    console.log(`✅ Token refrescado exitosamente para ${account.nickname}`);
    return newAccessToken;

  } catch (err) {
    console.error(`❌ Falló el refresco automático para ${account.nickname}:`, err.message);
    throw new Error(`Error de autenticación: El refresh_token podría haber expirado o la App fue desvinculada. Re-vincule la cuenta en /auth.`);
  }
}
