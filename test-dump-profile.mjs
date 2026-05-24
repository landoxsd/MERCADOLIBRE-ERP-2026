import { chromium } from "playwright";
import fs from "fs";

async function dumpProfile(nickname) {
    const slug = encodeURIComponent(nickname.trim()).replace(/%20/g, "-");
    const url = `https://perfil.mercadolibre.com.ve/${slug}`;
    console.log("Navigating to Profile URL:", url);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
        const html = await page.content();
        
        // Guardar el HTML completo en la carpeta del workspace para inspección
        fs.writeFileSync("./profile_dump.html", html);
        console.log("✅ HTML del perfil guardado en ./profile_dump.html (longitud:", html.length, "bytes)");

        await browser.close();
    } catch (err) {
        console.error("Error:", err.message);
        await browser.close();
    }
}

dumpProfile("LOS-CHAMOS-BRG");
