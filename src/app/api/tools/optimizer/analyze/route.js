import { NextResponse } from "next/server";
import { meliGet } from "@/lib/meli";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { cookies } from "next/headers";
import { accountsTable } from "@/lib/supabase-admin";

export const maxDuration = 60;

// Extrae palabras clave del titulo para buscar competidores (quita año, marca generica)
function extractSearchQuery(title) {
    return title
        .replace(/\b(20\d\d|19\d\d)\b/g, '')   // quitar años
        .replace(/\b(ORIGINAL|GENUINO|NUEVO|NEW|OEM)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 80); // ML acepta queries de max 100 chars
}

export async function POST(request) {
    try {
        const { item_id } = await request.json();
        if (!item_id) return NextResponse.json({ error: "item_id requerido" }, { status: 400 });

        // Obtener la cuenta activa
        const cookieStore = await cookies();
        const activeAccountId = cookieStore.get('meli_erp_account')?.value;
        if (!activeAccountId) return NextResponse.json({ error: "No hay cuenta activa" }, { status: 401 });

        const { data: account } = await accountsTable().select('*').eq('id', activeAccountId).single();
        if (!account) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });

        const token = await getValidAccessToken(account);

        // PASO 1: Obtener datos de NUESTRA publicacion
        const myItem = await meliGet(`/items/${item_id}`, token);
        let myDescription = '';
        try {
            const descData = await meliGet(`/items/${item_id}/description`, token);
            myDescription = (descData.plain_text || descData.text || '').substring(0, 500);
        } catch(e) {}

        // PASO 2: Buscar competidores en MLV
        const searchQuery = extractSearchQuery(myItem.title);
        const searchData = await meliGet(`/sites/MLV/search?q=${encodeURIComponent(searchQuery)}&limit=20`);

        const competitors = (searchData.results || [])
            .filter(r => r.seller?.id !== myItem.seller_id)
            .slice(0, 5);

        // Enriquecer cada competidor con sus atributos completos
        const enrichedCompetitors = await Promise.all(
            competitors.map(async (comp) => {
                try {
                    const detail = await meliGet(`/items/${comp.id}`);
                    return {
                        id: comp.id,
                        title: comp.title,
                        price: comp.price,
                        currency_id: comp.currency_id,
                        shipping_free: comp.shipping?.free_shipping || false,
                        pictures_count: detail.pictures?.length || 0,
                        attributes: (detail.attributes || []).slice(0, 10).map(a => `${a.name}: ${a.value_name}`),
                        seller_nickname: comp.seller?.nickname || ''
                    };
                } catch(e) {
                    return {
                        id: comp.id,
                        title: comp.title,
                        price: comp.price,
                        currency_id: comp.currency_id,
                        shipping_free: comp.shipping?.free_shipping || false,
                        pictures_count: 0,
                        attributes: [],
                        seller_nickname: ''
                    };
                }
            })
        );

        // PASO 3: Construir prompt y llamar a la IA
        const myData = {
            title: myItem.title,
            price: myItem.price,
            currency: myItem.currency_id,
            shipping_free: myItem.shipping?.free_shipping || false,
            pictures_count: myItem.pictures?.length || 0,
            attributes: (myItem.attributes || []).slice(0, 10).map(a => `${a.name}: ${a.value_name}`),
            description: myDescription,
            condition: myItem.condition,
        };

        const competitorsText = enrichedCompetitors.map((c, i) =>
            `#${i+1} | Titulo: ${c.title} | Precio: ${c.price} ${c.currency_id} | Envio gratis: ${c.shipping_free ? 'SI' : 'NO'} | Fotos: ${c.pictures_count} | Atributos: [${c.attributes.join(', ')}]`
        ).join('\n');

        const prompt = `
=== NUESTRA PUBLICACION ===
Titulo: ${myData.title}
Precio: ${myData.price} ${myData.currency}
Envio Gratis: ${myData.shipping_free ? 'SI' : 'NO'}
Imagenes: ${myData.pictures_count} fotos
Condicion: ${myData.condition}
Atributos: [${myData.attributes.join(', ')}]
Descripcion (primeros 500 chars): ${myData.description}

=== COMPETENCIA (Top ${enrichedCompetitors.length} en MLV) ===
${competitorsText}

=== INSTRUCCION ===
Eres un experto en e-commerce de autopartes venezolano. Analiza la situacion y responde UNICAMENTE con este JSON sin ningun texto adicional:
{
  "score": 0,
  "resumen_ejecutivo": "",
  "precio": { "posicion": "", "delta_promedio_pct": 0, "recomendacion": "" },
  "titulo": { "palabras_clave_faltantes": [], "titulo_sugerido": "" },
  "descripcion": { "gaps_detectados": [], "descripcion_sugerida": "" },
  "imagenes": { "cantidad_nuestra": 0, "promedio_competencia": 0, "recomendacion": "" },
  "atributos_faltantes": [],
  "prioridades": ["", "", ""]
}
`;

        // Llamada a Groq
        if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
            // Modo demo sin IA: retornar analisis basico sin LLM
            const avgPrice = enrichedCompetitors.reduce((s, c) => s + c.price, 0) / (enrichedCompetitors.length || 1);
            const priceDelta = myData.price > 0 ? Math.round(((myData.price - avgPrice) / avgPrice) * 100) : 0;
            const dictamen = {
                score: 50,
                resumen_ejecutivo: "Analisis basico (sin clave de IA configurada). Configura GROQ_API_KEY para dictamen completo.",
                precio: { posicion: priceDelta > 5 ? "por encima del mercado" : priceDelta < -5 ? "por debajo del mercado" : "en linea con el mercado", delta_promedio_pct: priceDelta, recomendacion: `Precio promedio competencia: ${avgPrice.toFixed(2)} ${myData.currency}` },
                titulo: { palabras_clave_faltantes: [], titulo_sugerido: myData.title },
                descripcion: { gaps_detectados: ["Configura API KEY para analisis completo"], descripcion_sugerida: myData.description },
                imagenes: { cantidad_nuestra: myData.pictures_count, promedio_competencia: Math.round(enrichedCompetitors.reduce((s,c) => s + c.pictures_count, 0) / (enrichedCompetitors.length || 1)), recomendacion: "" },
                atributos_faltantes: [],
                prioridades: ["Configura API KEY para obtener prioridades de IA"]
            };
            return NextResponse.json({ success: true, myItem: myData, competitors: enrichedCompetitors, dictamen, demo_mode: true });
        }

        let dictamen;
        if (process.env.GROQ_API_KEY) {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' },
                    max_tokens: 1500,
                    temperature: 0.3
                })
            });
            const groqData = await groqRes.json();
            if (groqData.error) {
                 throw new Error("GROQ Error: " + JSON.stringify(groqData.error));
            }
            dictamen = JSON.parse(groqData.choices[0].message.content);
        } else if (process.env.OPENAI_API_KEY) {
            const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' },
                    max_tokens: 1500,
                    temperature: 0.3
                })
            });
            const openaiData = await openaiRes.json();
            dictamen = JSON.parse(openaiData.choices[0].message.content);
        }

        return NextResponse.json({ success: true, myItem: myData, competitors: enrichedCompetitors, dictamen });

    } catch (error) {
        console.error("Error en optimizer analyze:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
