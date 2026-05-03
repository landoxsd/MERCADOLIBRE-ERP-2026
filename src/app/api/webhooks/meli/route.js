// ================================================================
// src/app/api/webhooks/meli/route.js
// Receptor de Notificaciones Push de MercadoLibre (Vercel)
// Doc oficial: https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones
// ================================================================
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// IPs oficiales de MercadoLibre que envían notificaciones
const ML_IP_WHITELIST = [
    "54.88.218.97",
    "18.215.140.160",
    "18.213.114.129",
    "18.206.34.84",
];

/**
 * Extrae la IP real del cliente, considerando proxies de Vercel
 */
function getClientIp(req) {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Valida si la IP de origen pertenece a MercadoLibre
 */
function isAllowedIp(ip) {
    // En desarrollo/local o si usas ngrok, puedes desactivar esto
    if (process.env.NODE_ENV === "development") return true;
    return ML_IP_WHITELIST.includes(ip);
}

/**
 * POST /api/webhooks/meli
 * Recibe notificaciones de MercadoLibre y las encola en Supabase
 */
export async function POST(request) {
    const startTime = Date.now();
    const clientIp = getClientIp(request);

    // 1. Validar IP de origen (seguridad)
    if (!isAllowedIp(clientIp)) {
        console.warn(`[Webhook ML] IP no autorizada: ${clientIp}`);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 2. Parsear el payload de ML
        const body = await request.json();

        const {
            _id,
            resource,
            user_id,
            topic,
            application_id,
            attempts,
            sent,
            received,
        } = body;

        if (!topic || !resource || !user_id) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // 3. Guardar inmediatamente en Supabase (fire-and-forget rápido)
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        const { error: insertError } = await supabase
            .from("ml_notifications")
            .insert({
                topic,
                resource,
                user_id: BigInt(user_id).toString(),
                application_id: application_id ? BigInt(application_id).toString() : null,
                attempts: attempts || 1,
                payload: body,
                status: "pending",
                ml_sent_at: sent ? new Date(sent) : null,
                ml_received_at: received ? new Date(received) : null,
            });

        if (insertError) {
            console.error("[Webhook ML] Error insertando en Supabase:", insertError);
            // Aún así respondemos 200 para que ML no reintente innecesariamente
            // pero loggeamos el error para monitoreo
        } else {
            console.log(
                `[Webhook ML] Notificación encolada: topic=${topic} resource=${resource} user=${user_id} ip=${clientIp} tiempo=${Date.now() - startTime}ms`
            );
        }

        // 4. Responder HTTP 200 inmediatamente (< 500ms es obligatorio para ML)
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (err) {
        console.error("[Webhook ML] Error procesando notificación:", err);
        // Respondemos 200 para evitar que ML desactive el topic,
        // pero la notificación se perdió. Monitorear logs.
        return NextResponse.json({ success: true }, { status: 200 });
    }
}

/**
 * GET /api/webhooks/meli
 * Health check para verificar que el endpoint está vivo
 */
export async function GET() {
    return NextResponse.json({
        status: "ok",
        service: "mercadolibre-webhook-receiver",
        timestamp: new Date().toISOString(),
    });
}
