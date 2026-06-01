import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { fetchItemPerformance } from "@/lib/sniper-helpers";

// Helper to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');
        const idsStr = searchParams.get('itemIds');

        if (!accountId || !idsStr) {
            return NextResponse.json({ error: "Faltan parámetros accountId e itemIds" }, { status: 400 });
        }

        const accessToken = await getValidAccessToken(accountId);
        const itemIds = idsStr.split(',').map(id => id.trim()).filter(id => id);

        if (itemIds.length === 0) {
            return NextResponse.json({ results: [] });
        }

        const concurrency = 5;
        const results = [];

        for (let i = 0; i < itemIds.length; i += concurrency) {
            const chunk = itemIds.slice(i, i + concurrency);
            
            const chunkPromises = chunk.map(async (itemId) => {
                const perf = await fetchItemPerformance(itemId, accessToken);
                return {
                    id: itemId,
                    score: perf.score,
                    level: perf.level,
                    buckets: perf.buckets
                };
            });

            const chunkResults = await Promise.allSettled(chunkPromises);
            
            chunkResults.forEach((res, idx) => {
                if (res.status === 'fulfilled') {
                    results.push(res.value);
                } else {
                    results.push({
                        id: chunk[idx],
                        score: null,
                        level: null,
                        buckets: [],
                        error: res.reason?.message
                    });
                }
            });

            if (i + concurrency < itemIds.length) {
                await sleep(200); // Rate limiting: 5 reqs per 200ms
            }
        }

        return NextResponse.json({ results, success: true });

    } catch (error) {
        console.error("Error en /api/tools/optimizer/performance:", error);
        return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
    }
}
