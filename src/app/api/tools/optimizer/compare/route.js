import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/meli-auth-helper";

const MELI_BASE_URL = "https://api.mercadolibre.com";

export async function POST(request) {
    try {
        const { accountId, ourItemId, competitorItemId } = await request.json();

        if (!accountId || !ourItemId || !competitorItemId) {
            return NextResponse.json({ error: "Faltan parámetros accountId, ourItemId o competitorItemId" }, { status: 400 });
        }

        const accessToken = await getValidAccessToken(accountId);

        // Fetch our item and competitor item simultaneously
        const [ourItemRes, compItemRes] = await Promise.all([
            fetch(`${MELI_BASE_URL}/items/${ourItemId}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
            fetch(`${MELI_BASE_URL}/items/${competitorItemId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
        ]);

        if (!ourItemRes.ok || !compItemRes.ok) {
            throw new Error("No se pudieron obtener los datos de los ítems especificados");
        }

        const ourItem = await ourItemRes.json();
        const compItem = await compItemRes.json();

        // 1. GAP DE ATRIBUTOS
        const ourAttrsIds = ourItem.attributes.map(a => a.id);
        const attrGap = compItem.attributes
            .filter(a => a.value_name && !ourAttrsIds.includes(a.id))
            .map(a => ({
                id: a.id,
                name: a.name,
                competitorValue: a.value_name,
                group: a.attribute_group_name
            }));

        // 2. GAP DE FOTOS
        const photoGap = {
            ourCount: ourItem.pictures.length,
            compCount: compItem.pictures.length,
            difference: compItem.pictures.length - ourItem.pictures.length,
            ourPhotos: ourItem.pictures.map(p => ({ url: p.secure_url, size: p.size })),
            compPhotos: compItem.pictures.map(p => ({ url: p.secure_url, size: p.size }))
        };

        // 3. ANÁLISIS DE TÍTULO (Simple keyword match)
        const getWords = (str) => str.toLowerCase().replace(/[^a-z0-9áéíóúñ\s]/g, '').split(/\s+/).filter(w => w.length > 2);
        const ourWords = getWords(ourItem.title);
        const compWords = getWords(compItem.title);
        
        const missingKeywords = compWords.filter(w => !ourWords.includes(w));

        const titleAnalysis = {
            ourTitle: ourItem.title,
            compTitle: compItem.title,
            ourLength: ourItem.title.length,
            compLength: compItem.title.length,
            missingKeywords
        };

        // 4. BRECHA DE PRECIO
        const priceGap = {
            ourPrice: ourItem.price,
            compPrice: compItem.price,
            difference: ourItem.price - compItem.price,
            percentageDiff: ((ourItem.price - compItem.price) / compItem.price) * 100
        };

        return NextResponse.json({
            success: true,
            ourItem: {
                id: ourItem.id,
                title: ourItem.title,
                price: ourItem.price,
                thumbnail: ourItem.thumbnail,
                permalink: ourItem.permalink,
                attributes: ourItem.attributes
            },
            compItem: {
                id: compItem.id,
                title: compItem.title,
                price: compItem.price,
                thumbnail: compItem.thumbnail,
                permalink: compItem.permalink,
                sold_quantity: compItem.sold_quantity
            },
            analysis: {
                attrGap,
                photoGap,
                titleAnalysis,
                priceGap
            }
        });

    } catch (error) {
        console.error("Error en /api/tools/optimizer/compare:", error);
        return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
    }
}
