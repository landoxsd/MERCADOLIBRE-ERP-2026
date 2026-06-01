import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/meli-auth-helper";

const MELI_BASE_URL = "https://api.mercadolibre.com";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');
        const categoryId = searchParams.get('categoryId');

        if (!accountId || !categoryId) {
            return NextResponse.json({ error: "Faltan parámetros accountId e categoryId" }, { status: 400 });
        }

        const accessToken = await getValidAccessToken(accountId);

        const res = await fetch(`${MELI_BASE_URL}/categories/${categoryId}/attributes`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || `Error obteniendo atributos de ${categoryId}`);
        }

        const data = await res.json();
        
        // Filtrar y organizar los atributos
        const required = [];
        const optional = [];

        data.forEach(attr => {
            if (attr.tags?.hidden) return; // Ignorar ocultos

            const cleanAttr = {
                id: attr.id,
                name: attr.name,
                type: attr.value_type,
                values: attr.values || [],
                tooltip: attr.tooltip || ''
            };

            if (attr.tags?.required) {
                required.push(cleanAttr);
            } else {
                optional.push(cleanAttr);
            }
        });

        return NextResponse.json({ 
            success: true, 
            categoryId,
            attributes: {
                required,
                optional
            }
        });

    } catch (error) {
        console.error("Error en /api/tools/optimizer/attributes:", error);
        return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
    }
}
