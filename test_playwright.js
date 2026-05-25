const { chromium } = require("playwright");
(async () => {
    const urls = [
        "https://www.mercadolibre.com.ve/perfil/LOS+CHAMOS+BRG",
        "https://perfil.mercadolibre.com.ve/LOS+CHAMOS+BRG"
    ];
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    for (const url of urls) {
        console.log("Playwright visiting", url);
        const res = await page.goto(url);
        console.log("Status:", res.status());
        const html = await page.content();
        console.log("Length:", html.length);
        const custIdMatch = html.match(/_CustId_(\d+)/i) || 
                            html.match(/custId=(\d+)/i) || 
                            html.match(/cust_id\s*[:=]\s*["']?(\d+)["']?/i) ||
                            html.match(/"seller_id"\s*:\s*(\d+)/i) ||
                            html.match(/"official_store_id"\s*:\s*(\d+)/i);
        console.log("ID Match:", custIdMatch ? custIdMatch[1] : null);
    }
    await browser.close();
})();
