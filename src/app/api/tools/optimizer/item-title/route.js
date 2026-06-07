import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/meli-auth-helper";

const MELI_BASE_URL = "https://api.mercadolibre.com";

/**
 * GET /api/tools/optimizer/item-title?accountId=&itemId=
 * Obtiene solo el título de un ítem de ML (endpoint ultraligero para el Optimizer).
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get("accountId");
        const itemId = searchParams.get("itemId");

        if (!accountId || !itemId) {
            return NextResponse.json({ error: "Faltan parámetros accountId o itemId" }, { status: 400 });
        }

        const accessToken = await getValidAccessToken(accountId);

        const res = await fetch(`${MELI_BASE_URL}/items/${itemId}?attributes=id,title,price,thumbnail,category_id`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
            },
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `ML respondió ${res.status} para el ítem ${itemId}`);
        }

        const data = await res.json();

        return NextResponse.json({
            id: data.id,
            title: data.title,
            price: data.price,
            thumbnail: data.thumbnail,
            category_id: data.category_id,
        });
    } catch (error) {
        console.error("Error en /api/tools/optimizer/item-title:", error);
        return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
    }
}
