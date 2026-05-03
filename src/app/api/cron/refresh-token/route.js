// ================================================================
// src/app/api/cron/refresh-token/route.js
// Vercel Cron Job: Refresca tokens de MercadoLibre antes de expirar
// Configuración en vercel.json: "schedule": "0 */2 * * *"
// Doc oficial ML: https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion
// ================================================================
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MELI_BASE_URL = "https://api.mercadolibre.com";
const MELI_CLIENT_ID = process.env.MELI_CLIENT_ID;
const MELI_CLIENT_SECRET = process.env.MELI_CLIENT_SECRET;

/**
 * Refresca un access_token usando el refresh_token
 * Doc ML: El refresh_token es de uso único. Se recibe uno nuevo en cada respuesta.
 */
async function refreshAccessToken(refreshToken) {
    const res = await fetch(`${MELI_BASE_URL}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: MELI_CLIENT_ID,
            client_secret: MELI_CLIENT_SECRET,
            refresh_token: refreshToken,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
            `ML Refresh Error [${res.status}]: ${err.error || err.message || "Unknown"}`
        );
    }

    return res.json(); // { access_token, refresh_token, expires_in, user_id, ... }
}

/**
 * GET /api/cron/refresh-token
 * Ejecutado por Vercel Cron cada 2 horas
 */
export async function GET(request) {
    // Seguridad: solo permitir ejecución desde Vercel Cron o con secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // El header Authorization de Vercel Cron incluye el CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        // En desarrollo permitimos sin auth
        if (process.env.NODE_ENV !== "development") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const results = { refreshed: 0, errors: 0, skipped: 0, details: [] };

    try {
        // 1. Obtener todas las cuentas activas
        const { data: accounts, error: fetchError } = await supabase
            .from("meli_accounts")
            .select("id, meli_user_id, nickname, access_token, refresh_token, token_expiry")
            .order("token_expiry", { ascending: true });

        if (fetchError) throw fetchError;
        if (!accounts || accounts.length === 0) {
            return NextResponse.json({ message: "No accounts found", results });
        }

        const now = new Date();
        const THRESHOLD_MINUTES = 30; // Refrescar si expira en menos de 30 minutos

        for (const account of accounts) {
            const expiryDate = new Date(account.token_expiry);
            const diffMs = expiryDate - now;
            const diffMinutes = Math.floor(diffMs / 60000);

            // 2. Determinar si necesita refresh
            if (diffMinutes > THRESHOLD_MINUTES) {
                results.skipped++;
                results.details.push({
                    account: account.nickname,
                    meli_user_id: account.meli_user_id,
                    action: "skipped",
                    expires_in_min: diffMinutes,
                });
                continue;
            }

            try {
                // 3. Refrescar token
                const refreshed = await refreshAccessToken(account.refresh_token);
                const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);

                // 4. Guardar nuevo token en Supabase
                const { error: updateError } = await supabase
                    .from("meli_accounts")
                    .update({
                        access_token: refreshed.access_token,
                        refresh_token: refreshed.refresh_token,
                        token_expiry: newExpiry.toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", account.id);

                if (updateError) throw updateError;

                results.refreshed++;
                results.details.push({
                    account: account.nickname,
                    meli_user_id: account.meli_user_id,
                    action: "refreshed",
                    expires_at: newExpiry.toISOString(),
                });

                console.log(
                    `[Cron Refresh] Token refrescado: ${account.nickname} (${account.meli_user_id}) - Expira: ${newExpiry.toISOString()}`
                );
            } catch (err) {
                results.errors++;
                const isInvalidGrant = err.message.includes("invalid_grant");

                results.details.push({
                    account: account.nickname,
                    meli_user_id: account.meli_user_id,
                    action: "error",
                    error: err.message,
                    needs_reauth: isInvalidGrant,
                });

                // Si es invalid_grant, marcar cuenta para re-autorización
                if (isInvalidGrant) {
                    await supabase
                        .from("meli_accounts")
                        .update({
                            needs_reauth: true,
                            reauth_error: err.message,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", account.id);
                }

                console.error(
                    `[Cron Refresh] Error refrescando ${account.nickname}: ${err.message}`
                );
            }
        }

        return NextResponse.json({
            success: true,
            executed_at: new Date().toISOString(),
            results,
        });
    } catch (err) {
        console.error("[Cron Refresh] Error general:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
