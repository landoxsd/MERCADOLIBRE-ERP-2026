import { NextResponse } from "next/server";
import { accountsTable } from "@/lib/supabase-admin";
import { getValidAccessToken } from "@/lib/meli-auth-helper";

// Helper to clean and extract item ID from URL or code
function extractItemId(query) {
    // 1. Matches like MLV-123456789 or MLV123456789 (case insensitive)
    const itemMatch = query.match(/(MLV-?\d+)/i);
    if (itemMatch) {
        return itemMatch[1].toUpperCase().replace("-", "");
    }
    
    // 2. Just numbers of 8 to 11 digits (probably raw item ID)
    const rawNumberMatch = query.match(/^\d{8,11}$/);
    if (rawNumberMatch) {
        return `MLV${rawNumberMatch[0]}`;
    }
    
    return null;
}

// Helper to extract nickname from seller profile URL
function extractNicknameFromUrl(query) {
    try {
        if (!query.includes("http")) return null;
        const url = new URL(query);
        if (url.hostname.includes("mercadolibre")) {
            // E.g. perfil.mercadolibre.com.ve/SOME-NICKNAME
            const pathParts = url.pathname.split("/").filter(Boolean);
            if (pathParts.includes("perfil") || pathParts.includes("vendedor")) {
                const idx = pathParts.findIndex(p => p === "perfil" || p === "vendedor");
                if (idx !== -1 && pathParts[idx + 1]) {
                    return decodeURIComponent(pathParts[idx + 1]).replace(/-/g, " ");
                }
            }
            // E.g. perfil.mercadolibre.com.ve/nickname
            if (pathParts.length > 0) {
                return decodeURIComponent(pathParts[pathParts.length - 1]).replace(/-/g, " ");
            }
        }
    } catch (e) {
        console.error("Error al parsear URL de perfil:", e);
    }
    return null;
}

export async function POST(request) {
    try {
        const { query } = await request.json();

        if (!query || typeof query !== "string") {
            return NextResponse.json({ error: "Búsqueda vacía o inválida." }, { status: 400 });
        }

        const trimmed = query.trim();

        // 1. Intentar resolver por ID de publicación o Link de producto
        const itemId = extractItemId(trimmed);
        if (itemId) {
            console.log(`Resolviendo por ítem ID: ${itemId}`);
            const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`);
            if (itemRes.ok) {
                const itemData = await itemRes.json();
                if (itemData.seller_id) {
                    return NextResponse.json({
                        success: true,
                        seller_id: String(itemData.seller_id),
                        resolved_via: "item_id",
                        item_title: itemData.title
                    });
                }
            }
        }

        // 2. Intentar resolver por Link de perfil de vendedor
        let nickname = extractNicknameFromUrl(trimmed);
        if (!nickname && !trimmed.includes("http")) {
            // Si no es URL, es el nickname directamente
            nickname = trimmed;
        }

        if (nickname) {
            console.log(`Resolviendo por nickname: ${nickname}`);
            
            // Intentar buscar de forma pública primero usando search por nickname
            const searchRes = await fetch(`https://api.mercadolibre.com/sites/MLV/search?nickname=${encodeURIComponent(nickname)}`);
            if (searchRes.ok) {
                const searchData = await searchRes.json();
                if (searchData.results && searchData.results.length > 0 && searchData.results[0].seller) {
                    return NextResponse.json({
                        success: true,
                        seller_id: String(searchData.results[0].seller.id),
                        resolved_via: "nickname_search",
                        nickname: searchData.results[0].seller.nickname || nickname
                    });
                }
            }

            // Fallback: Usar la API de usuarios de Mercado Libre con nuestro token del ERP
            // para encontrar al usuario por nickname directamente.
            const { data: accounts } = await accountsTable().select("id").limit(1);
            if (accounts && accounts.length > 0) {
                try {
                    const token = await getValidAccessToken(accounts[0].id);
                    const userRes = await fetch(`https://api.mercadolibre.com/users/search?nickname=${encodeURIComponent(nickname)}`, {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    if (userRes.ok) {
                        const userData = await userRes.json();
                        if (userData.id) {
                            return NextResponse.json({
                                success: true,
                                seller_id: String(userData.id),
                                resolved_via: "user_search_api",
                                nickname: userData.nickname
                            });
                        }
                    }
                } catch (err) {
                    console.error("Error al usar token para resolver usuario:", err.message);
                }
            }
        }

        // 3. Si todo lo anterior falla y es un número, asumimos que ya era el Seller ID directamente
        if (/^\d+$/.test(trimmed)) {
            return NextResponse.json({
                success: true,
                seller_id: trimmed,
                resolved_via: "direct_seller_id"
            });
        }

        return NextResponse.json({
            error: "No pudimos encontrar al vendedor. Verifica el enlace, nickname o ID de publicación."
        }, { status: 404 });

    } catch (error) {
        console.error("Error en resolutor de vendedor:", error);
        return NextResponse.json({ error: "Error interno al procesar la búsqueda." }, { status: 500 });
    }
}
