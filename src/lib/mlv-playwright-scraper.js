// ================================================================
// src/lib/mlv-playwright-scraper.js
// Scraper híbrido: Playwright descarga el DOM de
// listado.mercadolibre.com.ve y extrae los IDs MLV.
// Luego el route.js enriquece via multiget con el token.
//
// Entornos:
//  - LOCAL (NODE_ENV=development): usa playwright completo instalado con
//    `npx playwright install chromium`
//  - PRODUCCIÓN (Vercel): usa playwright-core + @sparticuz/chromium-min
// ================================================================

const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.VERCEL;

/**
 * Lanza el browser correcto según el entorno.
 */
async function launchBrowser() {
    if (IS_PRODUCTION) {
        // Vercel: browser serverless ligero (<50MB)
        const chromium = (await import("@sparticuz/chromium-min")).default;
        const { chromium: playwrightChromium } = await import("playwright-core");

        const executablePath = await chromium.executablePath(
            // URL del binario de Chromium para Sparticuz (se descarga en runtime)
            `https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar`
        );

        return playwrightChromium.launch({
            args: chromium.args,
            executablePath,
            headless: chromium.headless,
        });
    } else {
        // Local: playwright completo con Chromium instalado
        const { chromium } = await import("playwright");
        return chromium.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        });
    }
}

/**
 * Función principal: abre Chromium real, navega a mercadolibre.com.ve,
 * espera que carguen los resultados, descarga los datos del DOM y los parsea.
 *
 * @param {string} query - Término de búsqueda (ej. "amortiguador delantero")
 * @param {object} options
 * @param {number} [options.maxItems=20]   - Máximo de IDs a retornar
 * @param {number} [options.timeout=35000] - Timeout máximo en ms
 * @returns {Promise<Array>} - Array de objetos {id, title, price, currency, permalink, free_shipping}
 */
export async function scrapeMeliSearch(query, { maxItems = 20, timeout = 35000 } = {}) {
    const slug = encodeURIComponent(query.trim()).replace(/%20/g, "-");
    const url = `https://listado.mercadolibre.com.ve/${slug}`;

    console.log(`[Playwright] Iniciando scraper para: "${query}"`);
    console.log(`[Playwright] Entorno: ${IS_PRODUCTION ? "producción (serverless)" : "local"}`);
    console.log(`[Playwright] URL: ${url}`);

    let browser = null;

    try {
        browser = await launchBrowser();
        const context = await browser.newContext({
            userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            locale: "es-VE",
            timezoneId: "America/Caracas",
            viewport: { width: 1280, height: 900 },
            extraHTTPHeaders: {
                "Accept-Language": "es-VE,es;q=0.9,en-US;q=0.8",
            },
        });

        // Ocultar webdriver para evitar detección de bot
        await context.addInitScript(() => {
            Object.defineProperty(navigator, "webdriver", { get: () => undefined });
            Object.defineProperty(navigator, "languages", { get: () => ["es-VE", "es", "en-US"] });
            Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
            window.chrome = { runtime: {} };
        });

        const page = await context.newPage();

        // Navegar a la URL de búsqueda
        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout,
        });

        // Estrategia de espera: intentar con selector específico de ML,
        // o caer al networkidle si no aparece en 12s
        try {
            await page.waitForSelector(
                ".ui-search-results, .poly-card, [class*='search-result'], [class*='polycard']",
                { timeout: 12000 }
            );
            console.log(`[Playwright] ✅ Resultados cargados via selector`);
        } catch {
            console.log(`[Playwright] ⏳ Selector no encontrado, esperando networkidle...`);
            await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        }

        // Pequeño delay para permitir hydration JS
        await page.waitForTimeout(1500);

        // Extraer datos directamente del DOM con page.evaluate()
        const items = await page.evaluate(() => {
            const results = [];
            const cards = document.querySelectorAll(
                'li.ui-search-layout__item, .poly-card, [data-testid="polycard"], .ui-search-result__wrapper'
            );

            cards.forEach(card => {
                try {
                    const link = card.querySelector('a[href*="mercadolibre.com.ve"]') ||
                                 card.querySelector('a[href*="MLV"]') ||
                                 card.querySelector('a.poly-component__title') ||
                                 card.querySelector('a');

                    const href = link?.href || '';
                    const idMatch = href.match(/MLV\d{6,12}/i) || href.match(/\/MLV(\d+)/i);
                    const id = idMatch ? idMatch[0].toUpperCase() : null;

                    if (!id) return;

                    const titleEl = card.querySelector(
                        '.poly-component__title, h2.poly-box, h2, .ui-search-item__title, [class*="title"]'
                    );
                    const title = titleEl?.textContent?.trim() || '';

                    const priceEl = card.querySelector(
                        '.andes-money-amount__fraction, [class*="price__fraction"], .price-tag-fraction, meta[itemprop="price"]'
                    );
                    const priceStr = priceEl?.textContent?.trim() || priceEl?.getAttribute('content') || '0';
                    const price = parseFloat(priceStr.replace(/[.,]/g, m => m === '.' ? '' : '.')) || 0;

                    const currencyEl = card.querySelector('.andes-money-amount__currency-symbol, [class*="currency"]');
                    const currency = currencyEl?.textContent?.trim() || 'USD';

                    const freeShipping = !!card.querySelector(
                        '[class*="shipping--free"], [class*="free-shipping"], .poly-component__shipping'
                    )?.textContent?.toLowerCase().includes('gratis');
                    
                    const imgEl = card.querySelector('img.poly-component__picture, img.ui-search-result-image__element, [class*="picture"] img, img');
                    let thumbnail = imgEl?.getAttribute('data-src') || imgEl?.src || null;
                    if (thumbnail && thumbnail.startsWith('data:image')) {
                        thumbnail = imgEl?.getAttribute('src-fallback') || null; // fallback or null if only base64 exists
                    }
                    
                    const sellerEl = card.querySelector('.poly-component__seller, .ui-search-item__group__element--seller, [class*="seller"]');
                    const sellerNickname = sellerEl ? sellerEl.textContent.replace('Por', '').trim() : null;

                    // Extract sold_quantity from review/visually hidden text like "Más de 100 productos vendidos."
                    let soldQuantity = 0;
                    const hiddenTextEl = card.querySelector('.andes-visually-hidden');
                    const reviewsEl = card.querySelector('.poly-reviews__total');
                    
                    const soldText = (hiddenTextEl?.textContent || reviewsEl?.textContent || '').toLowerCase();
                    const soldMatch = soldText.match(/(?:más de|\+)?\s*(\d+)\s*(?:productos\s+)?vendidos/i);
                    if (soldMatch && soldMatch[1]) {
                        soldQuantity = parseInt(soldMatch[1], 10);
                    }

                    results.push({ 
                        id, 
                        title, 
                        price, 
                        currency_id: currency, 
                        permalink: href, 
                        free_shipping: freeShipping,
                        thumbnail,
                        seller_nickname: sellerNickname || 'Competidor',
                        sold_quantity: soldQuantity
                    });
                } catch {}
            });

            return results;
        });

        await browser.close();
        browser = null;

        // Eliminar duplicados (por id)
        const uniqueItemsMap = new Map();
        for (const item of items) {
             if (!uniqueItemsMap.has(item.id)) {
                 uniqueItemsMap.set(item.id, item);
             }
        }
        const uniqueItems = Array.from(uniqueItemsMap.values());

        console.log(`[Playwright] ✅ Items extraídos: ${uniqueItems.length}`);

        return uniqueItems.slice(0, maxItems);

    } catch (err) {
        console.error(`[Playwright] ❌ Error en scraper:`, err.message);
        if (browser) {
            await browser.close().catch(() => {});
        }
        return [];
    }
}

/**
 * Función para raspar individualmente una página de producto (Detalle).
 * Esto es necesario porque la API multiget está bloqueada y la lista no tiene ventas.
 * Retorna Ventas (+50 vendidos) y Categoría.
 */
export async function scrapeItemDetail(url) {
    console.log(`[Playwright Detail] Iniciando scraper para: ${url}`);
    let browser = null;

    try {
        browser = await launchBrowser();
        const context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            locale: "es-VE",
            timezoneId: "America/Caracas",
        });

        // Ocultar webdriver
        await context.addInitScript(() => {
            Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        });

        const page = await context.newPage();
        
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
        
        try {
            await page.waitForSelector('.ui-pdp-subtitle', { timeout: 15000 });
        } catch {
            console.log(`[Playwright Detail] Timeout esperando selector principal, procediendo con evaluación del DOM actual...`);
        }

        // Evaluar datos de ventas
        const subtitle = await page.evaluate(() => {
            const el = document.querySelector('.ui-pdp-subtitle');
            return el ? el.innerText : null;
        });

        let soldQuantity = 0;
        if (subtitle) {
            const soldMatch = subtitle.match(/(?:más de|\+)?\s*(\d+)\s*(?:productos\s+)?vendidos/i);
            if (soldMatch && soldMatch[1]) {
                soldQuantity = parseInt(soldMatch[1], 10);
            }
        }

        // Evaluar breadcrumbs para categorías
        const category = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('.andes-breadcrumb__link'));
            if (links.length === 0) return null;
            return links.map(l => l.innerText).join(" > ");
        });

        await browser.close();
        browser = null;

        console.log(`[Playwright Detail] ✅ Éxito: Ventas=${soldQuantity}, Categoria=${category}`);

        return {
            sold_quantity: soldQuantity,
            category_name: category,
            category_id: null // No tenemos el ID interno exacto, solo el nombre
        };

    } catch (err) {
        console.error(`[Playwright Detail] ❌ Error en scraper individual:`, err.message);
        if (browser) {
            await browser.close().catch(() => {});
        }
        return { sold_quantity: 0, category_name: null };
    }
}
