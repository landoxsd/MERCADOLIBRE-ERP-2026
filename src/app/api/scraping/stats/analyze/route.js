/**
 * src/app/api/scraping/stats/analyze/route.js
 * API Route — Análisis IA de SERP con Groq/Llama
 *
 * POST /api/scraping/stats/analyze
 * Body: { serpData: {...}, myItemIds?: string[], query: string }
 *
 * Usa llama-3.3-70b-versatile para generar un dictamen accionable
 * basado en los resultados del SERP de MLV Venezuela.
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

/**
 * Construye el prompt con los datos del SERP para el análisis IA.
 */
function buildPrompt(query, results, myPositions) {
    const top10 = results.slice(0, 10);
    const myIds = Object.keys(myPositions);
    const myItems = results.filter(r => myIds.includes(r.id?.toUpperCase()));

    const topList = top10.map(r =>
        `  #${r.position} [${r.id}] "${r.title}" | USD ${r.price_usd ?? 'N/A'} | ${r.free_shipping ? 'Envío gratis' : 'Sin envío gratis'} | ⭐${r.rating ?? 'N/A'} | Vendedor: ${r.seller}`
    ).join('\n');

    const mySection = myItems.length > 0
        ? `\nMIS PUBLICACIONES:\n${myItems.map(r =>
            `  #${r.position} [${r.id}] "${r.title}" | USD ${r.price_usd ?? 'N/A'} | ${r.free_shipping ? 'Envío gratis' : 'Sin envío gratis'}`
        ).join('\n')}`
        : '\nMIS PUBLICACIONES: No aparecen en el top 48 del SERP.';

    const pricesUSD = top10.filter(r => r.price_usd).map(r => r.price_usd);
    const avgPrice = pricesUSD.length
        ? (pricesUSD.reduce((a, b) => a + b, 0) / pricesUSD.length).toFixed(2)
        : 'N/A';
    const minPrice = pricesUSD.length ? Math.min(...pricesUSD).toFixed(2) : 'N/A';
    const maxPrice = pricesUSD.length ? Math.max(...pricesUSD).toFixed(2) : 'N/A';
    const freeShippingCount = top10.filter(r => r.free_shipping).length;

    return `Eres un experto en estrategia de ventas en MercadoLibre Venezuela (MLV), especializado en autopartes. Analiza los siguientes datos del SERP y genera un dictamen accionable y concreto en español.

BÚSQUEDA ANALIZADA: "${query}"
ESTADÍSTICAS DEL TOP 10:
  - Precio promedio: USD ${avgPrice}
  - Rango de precios: USD ${minPrice} – USD ${maxPrice}
  - Con envío gratis: ${freeShippingCount}/10 publicaciones
${mySection}

TOP 10 DEL SERP:
${topList}

RESPONDE EXCLUSIVAMENTE con un JSON válido con esta estructura exacta (sin markdown, sin texto extra):
{
  "dictamen": "Párrafo corto (2-3 oraciones) con el diagnóstico principal del mercado y por qué el #1 está ganando.",
  "precio_sugerido": "Precio USD recomendado para competir (solo número con 2 decimales, ej: 29.99)",
  "ventaja_lider": "En qué se diferencia el #1 del resto (1 oración concreta)",
  "keywords_faltantes": ["keyword1", "keyword2", "keyword3"],
  "acciones": [
    "Acción concreta #1 (Incluir siempre como regla vital llenar la Ficha Técnica/Atributos técnicos para subir el Score de Calidad de MLV)",
    "Acción concreta #2",
    "Acción concreta #3"
  ],
  "posicion_propia": "${myItems.length > 0 ? `Estás en posición #${myItems[0]?.position} de ${results.length} resultados` : 'No apareces en el top 48. Debes mejorar título y precio.'}",
  "nivel_competencia": "BAJO|MEDIO|ALTO|MUY_ALTO",
  "titulos_sugeridos": [
    "Título altamente optimizado 1",
    "Título altamente optimizado 2"
  ]
}`;
}

export async function POST(request) {
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return Response.json(
                { error: 'GROQ_API_KEY no configurada en .env.local' },
                { status: 503 }
            );
        }

        const body = await request.json();
        const { serpData, query } = body;

        if (!serpData?.results?.length) {
            return Response.json(
                { error: 'Se requieren datos del SERP (serpData.results)' },
                { status: 400 }
            );
        }

        const prompt = buildPrompt(
            query || serpData.query,
            serpData.results,
            serpData.my_positions || {}
        );

        const groqRes = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 800,
                response_format: { type: 'json_object' },
            }),
            signal: AbortSignal.timeout(25000),
        });

        if (!groqRes.ok) {
            const errText = await groqRes.text();
            console.error('[analyze] Groq error:', errText);
            return Response.json(
                { error: `Groq API error ${groqRes.status}` },
                { status: 502 }
            );
        }

        const groqData = await groqRes.json();
        const content = groqData.choices?.[0]?.message?.content;

        if (!content) {
            return Response.json({ error: 'Groq devolvió respuesta vacía' }, { status: 502 });
        }

        let analysis;
        try {
            analysis = JSON.parse(content);
        } catch {
            return Response.json({ error: 'Groq no devolvió JSON válido', raw: content }, { status: 502 });
        }

        return Response.json({
            ok: true,
            model: MODEL,
            query: query || serpData.query,
            analysis,
            tokens_used: groqData.usage?.total_tokens,
        });

    } catch (err) {
        console.error('[/api/scraping/stats/analyze] Error:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
