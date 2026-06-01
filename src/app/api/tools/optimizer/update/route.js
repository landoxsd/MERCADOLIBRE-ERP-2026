import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/meli-auth-helper";

const MELI_BASE_URL = "https://api.mercadolibre.com";

export async function PUT(request) {
    try {
        const { accountId, itemId, updates } = await request.json();

        if (!accountId || !itemId || !updates) {
            return NextResponse.json({ error: "Faltan parámetros accountId, itemId o updates" }, { status: 400 });
        }

        const accessToken = await getValidAccessToken(accountId);

        // Limpiar updates para asegurar que solo enviamos campos permitidos en MLV
        // MLV no permite actualizar price en ciertos estados si tiene ventas, pero asumimos que el frontend controla eso.
        const allowedUpdates = {};
        if (updates.title) allowedUpdates.title = updates.title;
        if (updates.price) allowedUpdates.price = Number(updates.price);
        if (updates.attributes) allowedUpdates.attributes = updates.attributes;

        if (Object.keys(allowedUpdates).length === 0) {
            return NextResponse.json({ error: "No hay campos válidos para actualizar" }, { status: 400 });
        }

        const res = await fetch(`${MELI_BASE_URL}/items/${itemId}`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(allowedUpdates)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error("ML PUT Error:", errData);
            
            // Error handling detallado de ML
            const errorMsg = errData.message || "Error al actualizar en Mercado Libre";
            const causes = errData.cause?.map(c => c.message).join(', ') || '';
            
            throw new Error(`${errorMsg} ${causes ? `(${causes})` : ''}`);
        }

        const data = await res.json();

        return NextResponse.json({ 
            success: true, 
            message: "Publicación actualizada con éxito",
            item: {
                id: data.id,
                title: data.title,
                price: data.price
            }
        });

    } catch (error) {
        console.error("Error en /api/tools/optimizer/update:", error);
        return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
    }
}
