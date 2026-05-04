// ================================================================
// app/api/webhooks/subscribe/route.js
// Suscribe una cuenta de ML a los webhooks/notificaciones push
// Doc: https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones
// ================================================================
import { NextResponse } from "next/server";
import { accountsTable } from "@/lib/supabase-admin";

const MELI_BASE_URL = "https://api.mercadolibre.com";

const WEBHOOK_TOPICS = [
    "items",         // Cambios en publicaciones (precio, stock, estado)
    "orders_v2",     // Órdenes nuevas, pagos, cancelaciones
    "questions",     // Preguntas de compradores
    "shipments",     // Cambios en envíos
    "payments",      // Pagos aprobados/rechazados
];

/**
 * Suscribe un user_id de ML a un topic específico
 */
async function subscribeTopic(userId, topic, accessToken, callbackUrl) {
    const res = await fetch(`${MELI_BASE_URL}/users/${userId}/applications?access_token=${accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            resource: callbackUrl,
            topic: topic,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Si ya está suscrito, no es error
        if (err.message?.includes("already exists") || err.error?.includes("already")) {
            return { success: true, already: true, topic };
        }
        return { success: false, error: err.message || `HTTP ${res.status}`, topic };
    }

    return { success: true, already: false, topic };
}

/**
 * POST /api/webhooks/subscribe
 * Suscribe la cuenta activa a todos los webhooks de ML
 */
export async function POST(request) {
    try {
        const { accountId } = await request.json().catch(() => ({}));

        if (!accountId) {
            return NextResponse.json({ error: "Se requiere accountId" }, { status: 400 });
        }

        // Obtener cuenta de Supabase
        const { data: account, error } = await accountsTable()
            .select("id, meli_user_id, nickname, access_token, token_expiry")
            .eq("id", accountId)
            .single();

        if (error || !account) {
            return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
        }

        // Verificar token
        if (new Date(account.token_expiry) < new Date()) {
            return NextResponse.json(
                { error: "Token expirado, reconectar cuenta", code: "TOKEN_EXPIRED" },
                { status: 401 }
            );
        }

        // URL de callback (webhook) - usar la URL de producción
        const callbackUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}/api/webhooks/meli`
            : (process.env.WEBHOOK_CALLBACK_URL || "https://mercadolibre-erp.vercel.app/api/webhooks/meli");

        // Suscribir a todos los topics
        const results = [];
        for (const topic of WEBHOOK_TOPICS) {
            const result = await subscribeTopic(
                account.meli_user_id,
                topic,
                account.access_token,
                callbackUrl
            );
            results.push(result);
        }

        const successCount = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success);

        return NextResponse.json({
            account: { id: account.id, nickname: account.nickname },
            callbackUrl,
            subscribed: successCount,
            total: WEBHOOK_TOPICS.length,
            results,
            failed: failed.length > 0 ? failed : undefined,
        });
    } catch (err) {
        console.error("Error suscribiendo webhooks:", err);
        return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
    }
}