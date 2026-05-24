import { chromium } from "playwright";

async function testRedirect() {
    const url = "https://listado.mercadolibre.com.ve/MLV722271126";
    console.log("Navigating to search URL:", url);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
        console.log("Final URL in Playwright:", page.url());
        
        // Extract title slug from the final URL if it redirected
        const finalUrl = page.url();
        const slugMatch = finalUrl.match(/MLV-?\d+-([a-z0-9-]+)/i);
        if (slugMatch) {
            console.log("🎉 SUCCESS! Extracted slug:", slugMatch[1]);
        } else {
            console.log("Did not redirect or extract slug.");
        }
        await browser.close();
    } catch (e) {
        console.error("Error:", e.message);
        await browser.close();
    }
}

testRedirect();
