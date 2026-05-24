import { chromium } from "playwright";

async function scrapeItem(itemId) {
    const url = `https://articulo.mercadolibre.com.ve/${itemId}`;
    console.log("Navigating to:", url);

    const browser = await chromium.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
        ]
    });

    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        locale: "es-VE",
        timezoneId: "America/Caracas",
        viewport: { width: 1280, height: 900 }
    });

    // Hide webdriver
    await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const page = await context.newPage();

    try {
        const res = await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
        console.log("Response status:", res.status());
        console.log("Final URL:", page.url());
        console.log("Page Title:", await page.title());

        // Check if there is an Akamai / challenge page
        const html = await page.content();
        console.log("HTML length:", html.length);
        if (html.includes("challenge") || html.includes("captcha") || html.includes("robot")) {
            console.log("⚠️ ¡ATENCIÓN! Se detectó un reto antibot / captcha / desafío.");
        }

        // Buscar enlaces de perfil
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => ({
                href: a.href,
                text: a.textContent.trim()
            })).filter(a => a.href.includes("perfil") || a.href.includes("vendedor") || a.href.includes("profile"));
        });
        console.log("Enlaces de vendedor encontrados:", links);

        // Buscar scripts que contengan CustId
        const scriptMatch = html.match(/CustId\s*[:=]\s*(\d+)/i) || html.match(/"sellerId"\s*:\s*(\d+)/i) || html.match(/"seller_id"\s*:\s*(\d+)/i);
        console.log("Búsqueda regex de SellerID en HTML:", scriptMatch ? scriptMatch[0] : "No match");

        await browser.close();
    } catch (err) {
        console.error("Error:", err.message);
        await browser.close();
    }
}

scrapeItem("MLV722271126");
