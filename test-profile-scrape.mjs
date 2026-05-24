import { chromium } from "playwright";

async function testTienda(nickname) {
    const slug = nickname.toLowerCase().replace(/ /g, "-");
    const urls = [
        `https://tienda.mercadolibre.com.ve/${slug}`,
        `https://tiendas.mercadolibre.com.ve/${slug}`,
        `https://www.mercadolibre.com.ve/tienda/${slug}`
    ];

    const browser = await chromium.launch({ headless: true });
    
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
            console.log(`Probando Tienda: ${url}`);
            const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
            const title = await page.title();
            const text = await page.evaluate(() => document.body.innerText);
            const isError = text.includes("Hubo un error") || text.includes("Página no encontrada");
            console.log(`  -> Status: ${res.status()} | Title: "${title}" | ¿Es Error?: ${isError}`);
            if (res.status() === 200 && !isError) {
                console.log(`🎉 ¡TIENDA ENCONTRADA!: ${url}`);
                const html = await page.content();
                const custIdMatch = html.match(/_CustId_(\d+)/i) || 
                                    html.match(/custId=(\d+)/i) || 
                                    html.match(/cust_id\s*[:=]\s*["']?(\d+)["']?/i) ||
                                    html.match(/"seller_id"\s*:\s*(\d+)/i) ||
                                    html.match(/"official_store_id"\s*:\s*(\d+)/i);
                console.log("  CustId extraído:", custIdMatch ? custIdMatch[1] : "No match");
            }
        } catch (e) {
            console.log(`  -> Error: ${e.message}`);
        } finally {
            await page.close();
        }
    }
    await browser.close();
}

testTienda("Los Chamos BRG");
