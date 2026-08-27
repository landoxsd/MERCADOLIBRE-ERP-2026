import { NextResponse } from "next/server";
import { accountsTable } from "@/lib/supabase-admin";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { scraplingSerp, scraplingItem, scraplingSellerFromItem } from "@/lib/scrapling-client";

// Helper to clean and extract item ID and title slug from URL or code
function parseQueryInput(query) {
    const trimmed = query.trim();
    let itemId = null;
    let titleSlug = null;
    let sellerId = null;
    let nickname = null;

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
            } else if (pathParts[0] === "perfil" && pathParts[1]) {
                // Extract nickname from /perfil/SUMAUTOVLC
                nickname = decodeURIComponent(pathParts[1]);
            }
        }
        
        // Extract _CustId_ from url like listado.mercadolibre.com.ve/_CustId_189282699
        const custIdMatch = trimmed.match(/_CustId_(\d+)/);
        if (custIdMatch) {
            sellerId = custIdMatch[1];
        }
    } catch (e) {
        console.error("Error parseando URL en resolve:", e.message);
    }

    // 3. Si solo son números (ej 189282699) podría ser un seller_id o item_id
    // pero si es menor a 8 dígitos, seguro es un seller_id (ej 12345)
    // O si coincide con un ID de vendedor (no empieza por MLV)
    if (!itemId && !sellerId && !nickname) {
        const numbersOnly = trimmed.match(/^\d+$/);
        if (numbersOnly && trimmed.length < 10) {
            sellerId = trimmed;
        }
    }

    return { itemId, titleSlug, sellerId, nickname, originalUrl: trimmed.includes("http") ? trimmed : null };
}

// Resolves CustId from seller nickname using Camoufox profile scraping
async function resolveCustIdFromNickname(nickname, accessToken) {
    try {
        console.log(`[Resolver] Resolviendo nickname \u2192 seller_id: "${nickname}"`);
        
        // ESTRATEGIA PRIMARIA: Camoufox scraping del perfil del vendedor
        // Abre mercadolibre.com.ve/perfil/{nickname} y extrae _CustId_
        // Validado: funciona en ~5s sin tocar la API de ML
        try {
            const SCRAPLING_BASE = process.env.SCRAPLING_SERVICE_URL || 'http://127.0.0.1:8765';
            const nickRes = await fetch(`${SCRAPLING_BASE}/resolve-nickname`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname }),
                signal: AbortSignal.timeout(60000),
            });
            if (nickRes.ok) {
                const nickData = await nickRes.json();
                if (nickData.status === 'found' && nickData.seller_id) {
                    console.log(`[Resolver] \u2705 seller_id=${nickData.seller_id} via Camoufox perfil`);
                    return String(nickData.seller_id);
                }
            }
        } catch (camoErr) {
            console.error("[Resolver] Error en /resolve-nickname:", camoErr.message);
        }
        
        // FALLBACK: Buscar items del vendedor en SERP \u2192 intentar API con token
        console.log(`[Resolver] Fallback SERP para "${nickname}"...`);
        const resp = await scraplingSerp({ query: nickname, maxResults: 10 });
        if (resp.ok && resp.results && resp.results.length > 0) {
            const items = resp.results.filter(r => r.seller && r.seller.toLowerCase() === nickname.toLowerCase());
            const targets = items.length > 0 ? items : resp.results;
            for (const item of targets.slice(0, 3)) {
                const itemId = item.id;
                if (!itemId || !accessToken) continue;
                try {
                    const iRes = await fetch(`https://api.mercadolibre.com/items?ids=${itemId}&attributes=seller_id`, {
                        headers: { "Authorization": `Bearer ${accessToken}`, "Accept": "application/json" }
                    });
                    if (iRes.ok) {
                        const iData = await iRes.json();
                        if (iData && iData.length > 0 && iData[0].code === 200 && iData[0].body?.seller_id) {
                            const sellerId = String(iData[0].body.seller_id);
                            console.log(`[Resolver] \u2705 seller_id via SERP+API: ${sellerId}`);
                            return sellerId;
                        }
                    }
                } catch (iErr) {
                    console.error("[Resolver] SERP+API error:", iErr.message);
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
        const { query, accountId } = await request.json();

        if (!query || typeof query !== "string") {
            return NextResponse.json({ error: "Búsqueda vacía o inválida." }, { status: 400 });
        }

        const { itemId, titleSlug, sellerId, nickname, originalUrl } = parseQueryInput(query);
        
        // Si la URL o input ya contenía el _CustId_ directamente, lo devolvemos rápido
        if (sellerId) {
            return NextResponse.json({
                success: true,
                seller_id: sellerId,
                resolved_via: "direct_input",
                nickname: `Vendedor ${sellerId}`
            });
        }

        // Si se extrajo un nickname del perfil de la URL, reescribimos el query para que se busque directo
        let effectiveQuery = nickname || query;
        let accessToken = null;

        // Intentar obtener un access token de la cuenta enviada por el frontend, o la primera vinculada
        try {
            if (accountId) {
                accessToken = await getValidAccessToken(accountId);
            } else {
                const { data: accounts } = await accountsTable().select("id").limit(1);
                if (accounts && accounts.length > 0) {
                    accessToken = await getValidAccessToken(accounts[0].id);
                }
            }
        } catch (authErr) {
            console.error("Error al obtener token para resolver:", authErr.message);
        }

        const headers = { "Accept": "application/json" };
        if (accessToken) {
            headers["Authorization"] = `Bearer ${accessToken}`;
        }

        let sellerIdFound = null;
        // --- CASO 1: Tenemos un ID de publicación ---
        if (itemId) {
            console.log(`[Resolver] Intentando resolver publicación: ${itemId}`);
            
            // MÉTODO A.1: Items API (Solo si hay token, sino ML da 403)
            if (accessToken) {
                try {
                    const reqHeaders = { 
                        "Accept": "application/json",
                        "Authorization": `Bearer ${accessToken}`
                    };
                    const iRes = await fetch(`https://api.mercadolibre.com/items/${itemId}?attributes=seller_id`, {
                        headers: reqHeaders
                    });
                    if (iRes.ok) {
                        const iData = await iRes.json();
                        if (iData && iData.seller_id) sellerIdFound = iData.seller_id;
                    }
                } catch (iErr) {
                    console.error("[Resolver] Error en Items API:", iErr.message);
                }
            }

            // MÉTODO A.2: Bypass vía Camoufox SERP (más confiable para páginas de artículo)
            // Si hay slug del título en la URL (ej: /MLV-824681578-amortiguador-trasero-kia...)
            // usamos el SERP para encontrar al vendedor directamente.
            if (!sellerIdFound && originalUrl && titleSlug) {
                console.log(`[Resolver] Buscando seller vía SERP con slug: "${titleSlug}"`);
                try {
                    const sellerData = await scraplingSellerFromItem(originalUrl);
                    if (sellerData && sellerData.ok && sellerData.nickname) {
                        const nickname = sellerData.nickname;
                        console.log(`[Resolver] ✅ Nickname encontrado vía SERP: "${nickname}"`);
                        // Convertir nickname a seller_id
                        const resolvedId = await resolveCustIdFromNickname(nickname, accessToken);
                        if (resolvedId) {
                            return NextResponse.json({
                                success: true,
                                seller_id: resolvedId,
                                resolved_via: "serp_slug",
                                nickname
                            });
                        }
                    } else {
                        console.error("[Resolver] SERP slug no encontró seller:", sellerData?.error);
                    }
                } catch (sErr) {
                    console.error("[Resolver] Excepción en SERP slug:", sErr.message);
                }
            }

            // MÉTODO A.3: Bypass vía Camoufox /item (fallback para artículo sin slug)
            if (!sellerIdFound) {
                console.log(`[Resolver] Bypass vía Camoufox /item para ${itemId}`);
                try {
                    const itemData = await scraplingItem(itemId);
                    if (itemData && itemData.ok && itemData.seller_id) {
                        sellerIdFound = itemData.seller_id;
                        console.log(`[Resolver] ✅ Seller ID encontrado vía Camoufox /item: ${sellerIdFound}`);
                    } else {
                        console.error("[Resolver] Camoufox /item no encontró seller_id:", itemData?.error || "null");
                    }
                } catch (sErr) {
                    console.error("[Resolver] Excepción en Camoufox /item:", sErr.message);
                }
            }

            if (sellerIdFound) {
                return NextResponse.json({
                    success: true,
                    seller_id: sellerIdFound,
                    resolved_via: accessToken ? "items_api_with_token" : "scrapling_item",
                    nickname: `Competidor ${sellerIdFound}`
                });
            }

            // MÉTODO B: Buscar la publicación en el listado público vía Scrapling
            const queryForSerp = titleSlug || itemId;
            if (queryForSerp) {
                console.log(`[Resolver] Buscando publicación en listados vía Scrapling con query: "${queryForSerp}"`);
                try {
                    const resp = await scraplingSerp({ query: queryForSerp, maxResults: 10 });
                    if (resp.ok && resp.results) {
                        const matchedItem = resp.results.find(r => r.id === itemId) || resp.results[0];
                        if (matchedItem && matchedItem.seller) {
                            const nickname = matchedItem.seller;
                            console.log(`[Resolver] Encontrado nickname del vendedor en Scrapling: "${nickname}"`);
                            
                            // Traducir nickname a seller_id
                            const resolvedSellerId = await resolveCustIdFromNickname(nickname, accessToken);
                            if (resolvedSellerId) {
                                return NextResponse.json({
                                    success: true,
                                    seller_id: resolvedSellerId,
                                    resolved_via: "scrapling_search_and_items",
                                    nickname
                                });
                            }
                        }
                    } else {
                        console.error("[Resolver] Scrapling Service error:", resp.error);
                    }
                } catch (sErr) {
                    console.error("[Resolver] Error en bypass de búsqueda vía Scrapling:", sErr.message);
                }
            }
        }

        // --- CASO 2: Tenemos un Nickname explícito o TitleSlug que podría ser el nombre ---
        // Y no encontramos sellerIdFound todavía
        if (!sellerIdFound && !itemId && !titleSlug) {
            console.log(`[Resolver] Tratando query como Nickname genérico: "${effectiveQuery}"`);
            try {
                const resolvedSellerId = await resolveCustIdFromNickname(effectiveQuery, accessToken);
                if (resolvedSellerId) {
                    return NextResponse.json({
                        success: true,
                        seller_id: resolvedSellerId,
                        resolved_via: "nickname_direct",
                        nickname: effectiveQuery
                    });
                }
            } catch (err) {
                console.error("[Resolver] Error al resolver nickname directo:", err.message);
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
