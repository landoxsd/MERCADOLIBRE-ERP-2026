import { NextResponse } from "next/server";
import { accountsTable } from "@/lib/supabase-admin";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { scrapeMeliSearch } from "@/lib/mlv-playwright-scraper";
import { chromium } from "playwright";

// Helper to clean and extract item ID and title slug from URL or code
function parseQueryInput(query) {
    const trimmed = query.trim();
    let itemId = null;
    let titleSlug = null;

    // 1. Matches like MLV-123456789 or MLV123456789 (case insensitive)
    const itemMatch = trimmed.match(/(MLV-?\d+)/i);
    if (itemMatch) {
        itemId = itemMatch[1].toUpperCase().replace("-", "");
    } else {
        // Just numbers of 8 to 11 digits (raw item ID)
        const rawNumberMatch = trimmed.match(/^\d{8,11}$/);
        if (rawNumberMatch) {
            itemId = `MLV${rawNumberMatch[0]}`;
        }
    }

    // 2. Extract title slug if it's a URL
    try {
        if (trimmed.includes("http")) {
            const url = new URL(trimmed);
            // Paths are usually /MLV-123456-title-slug-_JM or /vendedor/nickname
            const pathParts = url.pathname.split("/").filter(Boolean);
            const pdpPart = pathParts.find(p => p.startsWith("MLV-") || p.startsWith("MLV"));
            if (pdpPart) {
                // E.g., MLV-722271126-spark-matiz-wagon-r...
                const parts = pdpPart.split("-");
                if (parts.length > 2) {
                    titleSlug = parts.slice(2).join("-");
                }
            }
        }
    } catch (e) {
        console.error("Error parseando URL en resolve:", e.message);
    }

    return { itemId, titleSlug };
}

// Resolves CustId using Playwright Search + Items API (Bypass 403 Profiles)
async function resolveCustIdFromNickname(nickname, accessToken) {
    try {
        console.log(`[Resolver] Buscando nickname en listado: "${nickname}"`);
        const searchResults = await scrapeMeliSearch(nickname, { maxItems: 10 });
        if (searchResults && searchResults.length > 0) {
            const items = searchResults.filter(r => !nickname || (r.seller_nickname && r.seller_nickname.toLowerCase() === nickname.toLowerCase()));
            const targets = items.length > 0 ? items : searchResults;

            for (const item of targets.slice(0, 5)) {
                const itemId = item.id;
                console.log(`[Resolver] Consultando item ${itemId} para extraer seller_id...`);
                
                // Estrategia 1: API de ítems usando multiget y Token (Funciona a través de Akamai)
                if (accessToken) {
                    try {
                        const iRes = await fetch(`https://api.mercadolibre.com/items?ids=${itemId}&attributes=seller_id`, {
                            headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" }
                        });
                        if (iRes.ok) {
                            const iData = await iRes.json();
                            if (iData && iData.length > 0 && iData[0].code === 200 && iData[0].body && iData[0].body.seller_id) {
                                const sellerId = String(iData[0].body.seller_id);
                                console.log(`[Resolver] 🎉 CustId resuelto usando Items API en item ${itemId}: ${sellerId}`);
                                return sellerId;
                            }
                        }
                    } catch (iErr) {
                        console.error("[Resolver] Falló la API de Items en resolve:", iErr.message);
                    }
                }

                // Estrategia 2: Fallback API de Preguntas (Pública)
                const qRes = await fetch(`https://api.mercadolibre.com/questions/search?item=${itemId}`, { headers: { "Accept": "application/json" } });
                if (qRes.ok) {
                    const qData = await qRes.json();
                    if (qData.questions && qData.questions.length > 0 && qData.questions[0].seller_id) {
                        const sellerId = String(qData.questions[0].seller_id);
                        console.log(`[Resolver] 🎉 CustId resuelto usando Questions API en item ${itemId}: ${sellerId}`);
                        return sellerId;
                    }
                }
            }
        }
    } catch (err) {
        console.error("[Resolver] Error en resolveCustIdFromNickname:", err.message);
    }
    return null;
}

export async function POST(request) {
    try {
        const { query } = await request.json();

        if (!query || typeof query !== "string") {
            return NextResponse.json({ error: "Búsqueda vacía o inválida." }, { status: 400 });
        }

        const { itemId, titleSlug } = parseQueryInput(query);
        let accessToken = null;

        // Intentar obtener un access token de alguna cuenta vinculada del ERP
        try {
            const { data: accounts } = await accountsTable().select("id").limit(1);
            if (accounts && accounts.length > 0) {
                accessToken = await getValidAccessToken(accounts[0].id);
            }
        } catch (authErr) {
            console.error("Error al obtener token para resolver:", authErr.message);
        }

        const headers = { "Accept": "application/json" };
        if (accessToken) {
            headers["Authorization"] = `Bearer ${accessToken}`;
        }

        // --- CASO 1: Tenemos un ID de publicación ---
        if (itemId) {
            console.log(`[Resolver] Intentando resolver publicación: ${itemId}`);
            
            // MÉTODO A.1: Items API con token (Infalible y rápido)
            if (accessToken) {
                try {
                    const iRes = await fetch(`https://api.mercadolibre.com/items?ids=${itemId}&attributes=seller_id`, {
                        headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" }
                    });
                    if (iRes.ok) {
                        const iData = await iRes.json();
                        if (iData && iData.length > 0 && iData[0].code === 200 && iData[0].body && iData[0].body.seller_id) {
                            const sellerId = String(iData[0].body.seller_id);
                            console.log(`[Resolver] 🎉 Seller ID resuelto vía Items API: ${sellerId}`);
                            return NextResponse.json({
                                success: true,
                                seller_id: sellerId,
                                resolved_via: "items_api"
                            });
                        }
                    }
                } catch (iErr) {
                    console.error("[Resolver] Error en Items API:", iErr.message);
                }
            }

            // MÉTODO A.2: Bypass de questions/search (Fallback público)
            try {
                const qRes = await fetch(`https://api.mercadolibre.com/questions/search?item=${itemId}`, { headers: { "Accept": "application/json" } }); // No Authorization header
                if (qRes.ok) {
                    const qData = await qRes.json();
                    if (qData.questions && qData.questions.length > 0 && qData.questions[0].seller_id) {
                        const sellerId = String(qData.questions[0].seller_id);
                        console.log(`[Resolver] 🎉 Seller ID resuelto vía Questions API: ${sellerId}`);
                        return NextResponse.json({
                            success: true,
                            seller_id: sellerId,
                            resolved_via: "questions_api"
                        });
                    }
                }
            } catch (qErr) {
                console.error("[Resolver] Error en Questions API:", qErr.message);
            }

            // MÉTODO B: Buscar la publicación por su título/slug en el listado público
            if (titleSlug) {
                console.log(`[Resolver] Buscando publicación en listados con título: "${titleSlug}"`);
                try {
                    const searchResults = await scrapeMeliSearch(titleSlug);
                    const matchedItem = searchResults.find(r => r.id === itemId);
                    if (matchedItem && matchedItem.seller_nickname) {
                        const nickname = matchedItem.seller_nickname;
                        console.log(`[Resolver] Encontrado nickname del vendedor en listado: "${nickname}"`);
                        
                        // Traducir nickname a seller_id usando Playwright Perfil
                        const sellerId = await resolveCustIdFromNickname(nickname, accessToken);
                        if (sellerId) {
                            return NextResponse.json({
                                success: true,
                                seller_id: sellerId,
                                resolved_via: "playwright_search_and_items",
                                nickname
                            });
                        }
                    }
                } catch (sErr) {
                    console.error("[Resolver] Error en bypass de búsqueda y perfil:", sErr.message);
                }
            }
        }

        // --- CASO 2: El input es directamente un nickname ---
        const isNotUrl = !query.trim().includes("http");
        const isNotId = !itemId;
        if (isNotUrl && isNotId) {
            const nickname = query.trim();
            console.log(`[Resolver] Resolviendo nickname directo: "${nickname}"`);
            const sellerId = await resolveCustIdFromNickname(nickname, accessToken);
            if (sellerId) {
                return NextResponse.json({
                    success: true,
                    seller_id: sellerId,
                    resolved_via: "playwright_items_direct",
                    nickname
                });
            }
        }

        // --- CASO 3: Si todo falla y el query es puramente numérico, asumimos que es el ID directo ---
        const rawNumeric = query.trim();
        if (/^\d+$/.test(rawNumeric)) {
            return NextResponse.json({
                success: true,
                seller_id: rawNumeric,
                resolved_via: "direct_numeric"
            });
        }

        return NextResponse.json({
            error: "No pudimos encontrar al vendedor. Verifica el enlace, nickname o ID de publicación."
        }, { status: 404 });

    } catch (error) {
        console.error("Error crítico en resolver:", error);
        return NextResponse.json({ error: "Error interno al procesar la búsqueda." }, { status: 500 });
    }
}
