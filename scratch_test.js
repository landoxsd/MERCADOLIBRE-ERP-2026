const { chromium } = require("playwright");

(async () => {
    console.log("Launching browser...");
    const browser = await chromium.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled",
        ],
    });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const page = await context.newPage();
    const url = "https://articulo.mercadolibre.com.ve/MLV-817488516-rodamientos-delanteros-y-traseros-aveo-_JM";
    console.log("Navigating to " + url);
    
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    
    // Wait for the main UI to render (or bypass Captcha)
    try {
        await page.waitForSelector('.ui-pdp-subtitle', { timeout: 15000 });
        console.log("Page loaded!");
    } catch (e) {
        console.log("Timeout waiting for .ui-pdp-subtitle. Current HTML:");
        const title = await page.title();
        console.log("Title: ", title);
    }

    // Attempt to read sold_quantity
    const subtitle = await page.evaluate(() => {
        const el = document.querySelector('.ui-pdp-subtitle');
        return el ? el.innerText : null;
    });
    console.log("Subtitle text:", subtitle);

    // Attempt to read category
    const category = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.andes-breadcrumb__link'));
        if (links.length === 0) return null;
        return links.map(l => l.innerText).join(" > ");
    });
    console.log("Category:", category);

    await browser.close();
})();
