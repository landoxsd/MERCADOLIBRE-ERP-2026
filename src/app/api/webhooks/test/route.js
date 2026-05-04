// ================================================================
// src/app/api/webhooks/test/route.js
// Endpoint de PRUEBA para simular notificaciones de MercadoLibre
// NO usar en producción — no valida IP
// ================================================================
import { NextResponse } from "next/server";
import { supabaseAdmin, accountsTable, productsTable, ordersTable, questionsTable } from "@/lib/supabase-admin";

const MELI_BASE_URL = "https://api.mercadolibre.com";

async function getAccountToken(meliUserId) {
    const { data, error } = await accountsTable()
        .select("id, access_token, nickname")
        .eq("meli_user_id", String(meliUserId))
        .single();
    if (error || !data) return null;
    return data;
}

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

async function processItemNotification(resource, account, payload) {
    const itemData = await fetchResource(resource, account.access_token);
    const { error } = await productsTable().upsert({
        meli_item_id: itemData.id,
        meli_account_id: account.id,
        title: itemData.title,
        status: itemData.status,
        price: itemData.price,
        available_qty: itemData.available_quantity,
        permalink: itemData.permalink,
        thumbnail: itemData.thumbnail,
        category_id: itemData.category_id,
        domain_id: itemData.domain_id,
        sku: itemData.seller_custom_field || null,
        attributes: itemData.attributes || null,
        last_updated_meli: itemData.last_updated,
    }, { onConflict: "meli_item_id" });
    if (error) throw new Error(`Error upsert producto: ${error.message}`);
    return { action: "product_updated", item_id: itemData.id };
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { resource, user_id, topic } = body;

        if (!topic || !resource || !user_id) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Guardar notificación
        const { data: notification, error: insertError } = await supabaseAdmin
            .from("ml_notifications")
            .insert({
                topic,
                resource,
                user_id: BigInt(user_id).toString(),
                payload: body,
                status: "pending",
            })
            .select("id")
            .single();

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        // Procesar
        const account = await getAccountToken(user_id);
        if (!account) {
            await supabaseAdmin.from("ml_notifications").update({ status: "error", error_message: "Cuenta no encontrada" }).eq("id", notification.id);
            return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
        }

        if (topic === "items") {
            const result = await processItemNotification(resource, account, body);
            await supabaseAdmin.from("ml_notifications").update({ status: "completed", processed_at: new Date().toISOString() }).eq("id", notification.id);
            return NextResponse.json({ success: true, result });
        }

        await supabaseAdmin.from("ml_notifications").update({ status: "completed", processed_at: new Date().toISOString() }).eq("id", notification.id);
        return NextResponse.json({ success: true, message: `Topic ${topic} recibido (procesamiento básico)` });

    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        status: "ok",
        message: "Endpoint de prueba para webhooks. Usa POST con un payload de ML para simular.",
        example: {
            topic: "items",
            resource: "/items/MLV123456789",
            user_id: 248086934,
        }
    });
}
