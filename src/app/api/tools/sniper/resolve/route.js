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
                    titleSlug = parts.slice(2).join(" ");
                }
            }
        }
    } catch (e) {
        console.error("Error parseando URL en resolve:", e.message);
    }

    return { itemId, titleSlug };
}

// Scrape a profile or Tienda Oficial using Playwright to get the CustId
async function resolveCustIdFromProfile(nickname) {
    const slug = nickname.toLowerCase().trim().replace(/ /g, "-");
    const urls = [
        `https://www.mercadolibre.com.ve/tienda/${slug}`,
        `https://perfil.mercadolibre.com.ve/vendedor/${slug}`,
        `https://perfil.mercadolibre.com.ve/${slug}`
    ];

    console.log(`[Playwright] Intentando resolver CustId para el nickname: "${nickname}"...`);
    let browser = null;

    try {
        const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.VERCEL;
        if (IS_PRODUCTION) {
            const chromiumServerless = (await import("@sparticuz/chromium-min")).default;
            const { chromium: playwrightChromium } = await import("playwright-core");
            const executablePath = await chromiumServerless.executablePath(
                `https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar`
            );
            browser = await playwrightChromium.launch({
                args: chromiumServerless.args,
                executablePath,
                headless: chromiumServerless.headless,
            });
        } else {
            browser = await chromium.launch({
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
            });
        }

        for (const url of urls) {
            const context = await browser.newContext({
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                locale: "es-VE",
                timezoneId: "America/Caracas",
                viewport: { width: 1280, height: 900 }
            });
            await context.addInitScript(() => {
                Object.defineProperty(navigator, "webdriver", { get: () => undefined });
            });
            const page = await context.newPage();
            
            try {
                console.log(`[Playwright] Accediendo a: ${url}`);
                const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
                const text = await page.evaluate(() => document.body.innerText);
                const isError = text.includes("Hubo un error") || text.includes("Página no encontrada") || text.includes("error accediendo");
                
                if (res.status() === 200 && !isError) {
                    const html = await page.content();
                    const custIdMatch = html.match(/_CustId_(\d+)/i) || 
                                        html.match(/custId=(\d+)/i) || 
                                        html.match(/cust_id\s*[:=]\s*["']?(\d+)["']?/i) ||
                                        html.match(/"seller_id"\s*:\s*(\d+)/i) ||
                                        html.match(/"official_store_id"\s*:\s*(\d+)/i);
                                        
                    if (custIdMatch && custIdMatch[1]) {
                        console.log(`[Playwright] 🎉 CustId resuelto para "${nickname}": ${custIdMatch[1]}`);
                        await browser.close();
                        return custIdMatch[1];
                    }
                }
            } catch (err) {
                console.warn(`[Playwright] Falló consulta a ${url}: ${err.message}`);
            } finally {
                await page.close();
            }
        }
        if (browser) await browser.close();
    } catch (e) {
        console.error("[Playwright] Error global en resolveCustIdFromProfile:", e.message);
        if (browser) await browser.close().catch(() => {});
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
            
            // MÉTODO A: Bypass de questions/search (INFALIBLE SI HAY PREGUNTAS)
            try {
                const qRes = await fetch(`https://api.mercadolibre.com/questions/search?item=${itemId}`, { headers });
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
                        const sellerId = await resolveCustIdFromProfile(nickname);
                        if (sellerId) {
                            return NextResponse.json({
                                success: true,
                                seller_id: sellerId,
                                resolved_via: "playwright_search_and_profile",
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
            const sellerId = await resolveCustIdFromProfile(nickname);
            if (sellerId) {
                return NextResponse.json({
                    success: true,
                    seller_id: sellerId,
                    resolved_via: "playwright_profile_direct",
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
