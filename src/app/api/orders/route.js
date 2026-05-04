// ================================================================
// app/api/orders/route.js
// Lista de órdenes reales desde Mercado Libre
// ================================================================
import { NextResponse } from "next/server";
import { accountsTable } from "@/lib/supabase-admin";
import { meliGet } from "@/lib/meli";
import { cookies } from "next/headers";

export async function GET(request) {
    try {
        const cookieStore = await cookies();
        const activeAccountId = cookieStore.get("meli_erp_account")?.value;

        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get("accountId") || activeAccountId;
        const limit = parseInt(searchParams.get("limit") || "10", 10);
        const status = searchParams.get("status") || ""; // paid, pending, cancelled

        if (!accountId) {
            return NextResponse.json({ error: "No hay cuenta activa" }, { status: 401 });
        }

        // Buscar la cuenta en Supabase
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

        // Construir query a la API de ML
        let endpoint = `/orders/search?seller=${account.meli_user_id}&sort=date_desc&limit=${limit}`;
        if (status) {
            endpoint += `&order.status=${status}`;
        }

        const data = await meliGet(endpoint, account.access_token);

        const orders = (data.results || []).map((order) => ({
            id: order.id,
            status: order.status,
            statusDetail: order.status_detail,
            dateCreated: order.date_created,
            dateClosed: order.date_closed,
            totalAmount: order.total_amount,
            currencyId: order.currency_id,
            buyer: {
                id: order.buyer?.id,
                nickname: order.buyer?.nickname,
                firstName: order.buyer?.first_name,
                lastName: order.buyer?.last_name,
                email: order.buyer?.email,
            },
            items: (order.order_items || []).map((item) => ({
                id: item.item?.id,
                title: item.item?.title,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                variationId: item.item?.variation_id,
            })),
            shipping: {
                id: order.shipping?.id,
                status: order.shipping?.status,
                substatus: order.shipping?.substatus,
            },
            payments: (order.payments || []).map((p) => ({
                id: p.id,
                status: p.status,
                amount: p.transaction_amount,
            })),
        }));

        return NextResponse.json({
            account: { id: account.id, nickname: account.nickname },
            orders,
            paging: {
                total: data.paging?.total || orders.length,
                offset: data.paging?.offset || 0,
                limit,
            },
            fetchedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error("Error en /api/orders:", err.message);
        return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
    }
}