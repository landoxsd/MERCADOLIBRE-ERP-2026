// ================================================================
// src/app/api/webhooks/meli/route.js
// Receptor + Procesador de Notificaciones Push de MercadoLibre (Vercel)
// Doc oficial: https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones
// ================================================================
import { NextResponse } from "next/server";
import { supabaseAdmin, accountsTable, productsTable, ordersTable, questionsTable } from "@/lib/supabase-admin";

const MELI_BASE_URL = "https://api.mercadolibre.com";

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
    if (process.env.NODE_ENV === "development") return true;
    if (process.env.VERCEL === "1") return true;
    return ML_IP_WHITELIST.includes(ip);
}

/**
 * Obtiene el access_token de una cuenta por su meli_user_id
 */
async function getAccountToken(meliUserId) {
    const { data, error } = await accountsTable()
        .select("id, access_token, nickname")
        .eq("meli_user_id", String(meliUserId))
        .single();

    if (error || !data) {
        console.warn(`[Webhook] No se encontró cuenta para meli_user_id=${meliUserId}`);
        return null;
    }
    return data;
}

/**
 * Llama a la API de MercadoLibre con el resource recibido
 */
async function fetchResource(resource, accessToken) {
    const url = resource.startsWith("http") ? resource : `${MELI_BASE_URL}${resource}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`ML API Error [${res.status}]: ${err}`);
    }
    return res.json();
}

// =================================================================
// PROCESADORES POR TOPIC
// =================================================================

/**
 * Procesa notificación de tipo 'items'
 * Actualiza el producto en la base de datos
 */
async function processItemNotification(resource, account, payload) {
    const itemData = await fetchResource(resource, account.access_token);

    const { error } = await productsTable()
        .upsert({
            meli_item_id: itemData.id,
            meli_account_id: account.id,
            title: itemData.title,
            status: itemData.status,
            price: itemData.price,
            sold_quantity: itemData.sold_quantity || 0,    // ✅ Ventas acumuladas
            available_qty: itemData.available_quantity,
            permalink: itemData.permalink,
            thumbnail: itemData.thumbnail,
            category_id: itemData.category_id,
            domain_id: itemData.domain_id,
            sku: itemData.seller_custom_field || null,
            attributes: itemData.attributes || null,
            raw_data: itemData,                             // ✅ JSON completo archivado
            last_updated_meli: itemData.last_updated,
            updated_at: new Date(),
        }, { onConflict: "meli_item_id" });

    if (error) throw new Error(`Error upsert producto: ${error.message}`);
    return { action: "product_updated", item_id: itemData.id };
}

/**
 * Procesa notificación de tipo 'orders_v2'
 * Crea o actualiza la orden en la base de datos
 */
async function processOrderNotification(resource, account, payload) {
    const orderData = await fetchResource(resource, account.access_token);

    // Buscar si ya existe
    const { data: existing } = await ordersTable()
        .select("id")
        .eq("meli_order_id", String(orderData.id))
        .single();

    const orderPayload = {
        meli_order_id: String(orderData.id),
        meli_account_id: account.id,
        status: orderData.status,
        total_amount: orderData.total_amount,
        currency: orderData.currency_id,
        buyer_meli_id: String(orderData.buyer?.id || ""),
        buyer_nickname: orderData.buyer?.nickname || "",
        buyer_first_name: orderData.buyer?.first_name || "",
        buyer_last_name: orderData.buyer?.last_name || "",
    };

    let orderId;
    if (existing) {
        const { error } = await ordersTable()
            .update(orderPayload)
            .eq("id", existing.id);
        if (error) throw new Error(`Error actualizando orden: ${error.message}`);
        orderId = existing.id;
    } else {
        const { data, error } = await ordersTable()
            .insert(orderPayload)
            .select("id")
            .single();
        if (error) throw new Error(`Error insertando orden: ${error.message}`);
        orderId = data.id;
    }

    // Procesar items de la orden
    if (orderData.order_items && orderData.order_items.length > 0) {
        for (const item of orderData.order_items) {
            await supabaseAdmin.from("order_items").upsert({
                order_id: orderId,
                meli_item_id: item.item.id,
                title: item.item.title,
                quantity: item.quantity,
                unit_price: item.unit_price,
            }, { onConflict: "order_id, meli_item_id" });
        }
    }

    return { action: existing ? "order_updated" : "order_created", order_id: orderData.id };
}

/**
 * Procesa notificación de tipo 'questions'
 * Crea o actualiza la pregunta
 */
async function processQuestionNotification(resource, account, payload) {
    const questionData = await fetchResource(resource, account.access_token);

    const { error } = await questionsTable().upsert({
        meli_question_id: String(questionData.id),
        meli_account_id: account.id,
        item_id: String(questionData.item_id),
        text: questionData.text,
        status: questionData.status,
        buyer_nickname: questionData.from?.nickname || "",
        answer_text: questionData.answer?.text || null,
        answered_at: questionData.answer?.date_created || null,
    }, { onConflict: "meli_question_id" });

    if (error) throw new Error(`Error upsert pregunta: ${error.message}`);
    return { action: "question_processed", question_id: questionData.id };
}

/**
 * Procesa notificación de tipo 'shipments'
 * Actualiza el estado de envío de la orden relacionada
 */
async function processShipmentNotification(resource, account, payload) {
    const shipmentData = await fetchResource(resource, account.access_token);

    // Buscar la orden por shipping_id si existe relación
    // ML no siempre incluye el order_id directamente en el shipment, pero podemos buscar
    const { data: order, error: findError } = await ordersTable()
        .select("id, meli_order_id")
        .eq("meli_order_id", String(shipmentData.order_id || ""))
        .single();

    if (order) {
        const { error } = await ordersTable()
            .update({ status: `shipping_${shipmentData.status}` })
            .eq("id", order.id);
        if (error) throw new Error(`Error actualizando envío: ${error.message}`);
    }

    return { action: "shipment_processed", shipment_id: shipmentData.id, order_found: !!order };
}

/**
 * Procesa notificación de tipo 'payments'
 * Actualiza el estado de pago de la orden relacionada
 */
async function processPaymentNotification(resource, account, payload) {
    const paymentData = await fetchResource(resource, account.access_token);

    // Buscar orden por external_reference o order_ids
    const orderId = paymentData.order_ids?.[0] || paymentData.external_reference;
    if (orderId) {
        const { data: order } = await ordersTable()
            .select("id")
            .eq("meli_order_id", String(orderId))
            .single();

        if (order) {
            const statusMap = {
                approved: "paid",
                rejected: "payment_rejected",
                refunded: "refunded",
                in_process: "pending",
            };
            const newStatus = statusMap[paymentData.status] || paymentData.status;

            await ordersTable()
                .update({ status: newStatus })
                .eq("id", order.id);
        }
    }

    return { action: "payment_processed", payment_id: paymentData.id, status: paymentData.status };
}

/**
 * Router de procesamiento según el topic
 */
async function processNotification(topic, resource, account, payload) {
    switch (topic) {
        case "items":
            return await processItemNotification(resource, account, payload);
        case "orders_v2":
            return await processOrderNotification(resource, account, payload);
        case "questions":
            return await processQuestionNotification(resource, account, payload);
        case "shipments":
            return await processShipmentNotification(resource, account, payload);
        case "payments":
            return await processPaymentNotification(resource, account, payload);
        default:
            return { action: "ignored", reason: "topic_not_handled" };
    }
}

// =================================================================
// ENDPOINT PRINCIPAL
// =================================================================

/**
 * POST /api/webhooks/meli
 * Recibe notificaciones de MercadoLibre, las guarda y las procesa
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
        const { data: notification, error: insertError } = await supabaseAdmin
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
            })
            .select("id")
            .single();

        if (insertError) {
            console.error("[Webhook ML] Error insertando en Supabase:", insertError);
            // Aún respondemos 200 para que ML no reintente innecesariamente
        } else {
            console.log(
                `[Webhook ML] Notificación encolada: topic=${topic} resource=${resource} user=${user_id} ip=${clientIp} tiempo=${Date.now() - startTime}ms`
            );
        }

        const notificationId = notification?.id;

        // 4. PROCESAR LA NOTIFICACIÓN (async, no bloquea la respuesta 200)
        if (notificationId) {
            (async () => {
                try {
                    const account = await getAccountToken(user_id);
                    if (!account) {
                        await supabaseAdmin
                            .from("ml_notifications")
                            .update({ status: "error", error_message: "Cuenta no encontrada para este user_id" })
                            .eq("id", notificationId);
                        return;
                    }

                    const result = await processNotification(topic, resource, account, body);

                    await supabaseAdmin
                        .from("ml_notifications")
                        .update({
                            status: "completed",
                            processed_at: new Date().toISOString(),
                            error_message: null,
                        })
                        .eq("id", notificationId);

                    console.log(`[Webhook ML] Procesado: ${topic} → ${JSON.stringify(result)}`);
                } catch (processErr) {
                    console.error(`[Webhook ML] Error procesando ${topic}:`, processErr);
                    await supabaseAdmin
                        .from("ml_notifications")
                        .update({
                            status: "error",
                            error_message: processErr.message,
                            processed_at: new Date().toISOString(),
                        })
                        .eq("id", notificationId);
                }
            })();
        }

        // 5. Responder HTTP 200 inmediatamente (< 500ms es obligatorio para ML)
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (err) {
        console.error("[Webhook ML] Error procesando notificación:", err);
        // Respondemos 200 para evitar que ML desactive el topic
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
        version: "2.0",
        features: ["items", "orders_v2", "questions", "shipments", "payments"],
        timestamp: new Date().toISOString(),
    });
}
