// ================================================================
// app/api/webhooks/subscribe/route.js
// INFO: MercadoLibre NO tiene API para suscribir webhooks.
//       Se configura manualmente desde: https://applications.mercadolibre.com/
// Doc: https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones
// ================================================================
import { NextResponse } from "next/server";
import { accountsTable } from "@/lib/supabase-admin";

const MELI_BASE_URL = "https://api.mercadolibre.com";

const WEBHOOK_TOPICS = [
    { id: "items", label: "Publicaciones", desc: "Cambios en precio, stock, título o estado" },
    { id: "orders_v2", label: "Ventas / Órdenes", desc: "Nueva compra, pago confirmado, orden cancelada" },
    { id: "questions", label: "Preguntas", desc: "Preguntas de compradores en publicaciones" },
    { id: "shipments", label: "Envíos", desc: "Cambio de estado en envíos" },
    { id: "payments", label: "Pagos", desc: "Pago aprobado, rechazado o reembolsado" },
];

/**
 * GET /api/webhooks/subscribe
 * Verifica las suscripciones actuales de la app en MercadoLibre
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get("accountId");

        if (!accountId) {
            return NextResponse.json({ error: "Se requiere accountId" }, { status: 400 });
        }

        const { data: account, error } = await accountsTable()
            .select("id, meli_user_id, nickname, access_token")
            .eq("id", accountId)
            .single();

        if (error || !account) {
            return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
        }

        // Verificar suscripciones actuales
        const res = await fetch(
            `${MELI_BASE_URL}/users/${account.meli_user_id}/applications?access_token=${account.access_token}`
        );

        let subscriptions = [];
        if (res.ok) {
            const data = await res.json();
            subscriptions = data.subscriptions || data || [];
        }

        return NextResponse.json({
            account: { id: account.id, nickname: account.nickname },
            subscriptions,
            manualSetupRequired: true,
            instructions: {
                url: "https://applications.mercadolibre.com/",
                steps: [
                    "Inicia sesión en applications.mercadolibre.com con tu cuenta de desarrollador",
                    `Busca tu aplicación (Client ID: ${process.env.MELI_CLIENT_ID})`,
                    "Ve a la sección 'Notificaciones' o 'Notifications'",
                    `Configura la Callback URL: https://mercadolibre-erp.vercel.app/api/webhooks/ml`,
                    "Selecciona los topics: items, orders_v2, questions, shipments, payments",
                    "Guarda los cambios"
                ],
                callbackUrl: "https://mercadolibre-erp.vercel.app/api/webhooks/ml",
                topics: WEBHOOK_TOPICS,
            },
        });
    } catch (err) {
        console.error("Error verificando suscripciones:", err);
        return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
    }
}

/**
 * POST /api/webhooks/subscribe
 * Ahora solo verifica y devuelve instrucciones (ML no permite suscribir por API)
 */
export async function POST(request) {
    try {
        const { accountId } = await request.json().catch(() => ({}));

        if (!accountId) {
            return NextResponse.json({ error: "Se requiere accountId" }, { status: 400 });
        }

        const { data: account, error } = await accountsTable()
            .select("id, meli_user_id, nickname, access_token")
            .eq("id", accountId)
            .single();

        if (error || !account) {
            return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
        }

        // ML no permite suscribir webhooks por API; se configura manualmente
        return NextResponse.json({
            account: { id: account.id, nickname: account.nickname },
            subscribed: 0,
            total: WEBHOOK_TOPICS.length,
            manualSetupRequired: true,
            message: "MercadoLibre requiere configuración manual de webhooks",
            instructions: {
                url: "https://applications.mercadolibre.com/",
                steps: [
                    "Inicia sesión en applications.mercadolibre.com",
                    `Busca tu aplicación (Client ID: ${process.env.MELI_CLIENT_ID})`,
                    "Ve a la sección 'Notificaciones'",
                    `Configura la Callback URL: https://mercadolibre-erp.vercel.app/api/webhooks/ml`,
                    "Selecciona los topics: items, orders_v2, questions, shipments, payments",
                    "Guarda los cambios"
                ],
                callbackUrl: "https://mercadolibre-erp.vercel.app/api/webhooks/ml",
                topics: WEBHOOK_TOPICS,
            },
        });
    } catch (err) {
        console.error("Error en suscripción:", err);
        return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
    }
}
