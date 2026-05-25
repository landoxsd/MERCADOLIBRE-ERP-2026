import { NextResponse } from "next/server";
import { chromium } from "playwright";

export const maxDuration = 60; // Max execution time

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        
        if (!query) {
            return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
        }

        console.log(`🔍 Buscando imágenes para: ${query}`);

        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        const page = await context.newPage();
        
        // Vamos a DuckDuckGo Images
        const encodedQuery = encodeURIComponent(query);
        await page.goto(`https://duckduckgo.com/?q=${encodedQuery}&t=h_&iar=images&iax=images&ia=images`, { waitUntil: 'networkidle' });

        // Esperar a que carguen las imágenes
        await page.waitForSelector('img.tile--img__img', { timeout: 10000 }).catch(() => {});

        // Extraer las URLs
        const images = await page.evaluate(() => {
            const imgElements = document.querySelectorAll('img.tile--img__img');
            const results = [];
            
            for (let i = 0; i < Math.min(imgElements.length, 10); i++) {
                const img = imgElements[i];
                // Intentar obtener la URL original de alta calidad, o usar el src si no está
                let src = img.getAttribute('src');
                if (src && src.startsWith('//')) src = 'https:' + src;
                
                // DuckDuckGo guarda la URL original en un parametro
                const parent = img.closest('.tile');
                let originalUrl = src;
                
                results.push({
                    thumbnail: src,
                    source: originalUrl,
                    title: img.getAttribute('alt') || 'Imagen'
                });
            }
            return results;
        });

        await browser.close();

        return NextResponse.json({ success: true, query, images });

    } catch (error) {
        console.error("❌ Error en Image Hunt:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
