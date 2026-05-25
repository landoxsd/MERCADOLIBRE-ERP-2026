import { NextResponse } from "next/server";
import { chromium } from "playwright";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const maxDuration = 60;

// ─────────────────────────────────────────────
// Helper: hacer scraping con una query en DDG
// Reutiliza la page ya abierta (evita re-abrir browser)
// ─────────────────────────────────────────────
async function scrapeImages(page, query, limit, strategyName) {
    const fullQuery = `${query} autopart catalog white background`;
    const encodedQuery = encodeURIComponent(fullQuery);

    await page.goto(
        `https://duckduckgo.com/?q=${encodedQuery}&t=h_&iar=images&iax=images&ia=images`,
        { waitUntil: 'networkidle', timeout: 25000 }
    );
    await page.waitForSelector('[data-id]', { timeout: 8000 }).catch(() => {});

    const images = await page.evaluate((maxResults) => {
        const tiles = document.querySelectorAll('[data-id]');
        const results = [];
        for (let i = 0; i < Math.min(tiles.length, maxResults); i++) {
            const tile = tiles[i];
            try {
                const rawDataId = tile.getAttribute('data-id');
                if (!rawDataId) continue;
                const parsed = JSON.parse(decodeURIComponent(rawDataId));
                const hdUrl = parsed.image || parsed.url || null;
                const thumbUrl = parsed.thumbnail || null;
                const width = parsed.width || 0;
                const height = parsed.height || 0;
                const title = parsed.title || '';
                let domain = '';
                try { if (hdUrl) domain = new URL(hdUrl).hostname.replace('www.', ''); } catch(e) {}
                if (hdUrl) {
                    results.push({ hd_url: hdUrl, thumbnail: thumbUrl || hdUrl, width, height, title, domain, is_hd: width >= 800 || height >= 800 });
                }
            } catch(e) { continue; }
        }
        return results;
    }, limit);

    return images.map(img => ({ ...img, strategy: strategyName }));
}

// IDs exactos de atributos en la API de MercadoLibre Venezuela
const OEM_ATTR_IDS = ['OEM', 'PART_NUMBER', 'EAN', 'GTIN'];
const BRAND_ATTR_ID = 'BRAND';

// ─────────────────────────────────────────────
// Helper: obtener datos del producto de Supabase
// Usa internal_inventory para catálogo maestro y products como fallback
// ─────────────────────────────────────────────
async function getProductData(sku) {
    try {
        let title = '';
        let marca = '';
        let equivalencias = [];

        // 1. Consultar el maestro (internal_inventory) primero
        const { data: invData } = await supabaseAdmin
            .from('internal_inventory')
            .select('title, brand, oem')
            .eq('sku', sku)
            .limit(1)
            .single();

        if (invData) {
            title = invData.title || '';
            marca = invData.brand || '';
            if (invData.oem) equivalencias.push(invData.oem);
        }

        // 2. Consultar lo publicado en ML (products) para atributos extras si existe
        const { data: prodData } = await supabaseAdmin
            .from('products')
            .select('title, attributes, raw_data')
            .eq('sku', sku)
            .limit(1)
            .single();

        if (prodData) {
            // Si el maestro no tenia titulo, usar el de ML
            if (!title) title = prodData.title || prodData.raw_data?.title || '';
            
            const attributes = (prodData.raw_data?.attributes || prodData.attributes || []);
            
            // Extraer equivalencias OEM usando IDs exactos de ML
            const oemAttrs = attributes
                .filter(attr => OEM_ATTR_IDS.includes(attr.id) && attr.value_name)
                .map(attr => attr.value_name);
            equivalencias = [...equivalencias, ...oemAttrs];

            // Si no teníamos marca, sacarla de ML
            if (!marca) {
                const brandAttr = attributes.find(a => a.id === BRAND_ATTR_ID);
                marca = brandAttr?.value_name || '';
            }
        }

        if (!title && !equivalencias.length && !marca) return null;

        // Limpiar y deduplicar equivalencias
        equivalencias = equivalencias
            .filter(v => v && v !== 'null' && v !== sku)
            .filter((v, i, arr) => arr.indexOf(v) === i);

        return { title, equivalencias, marca };
    } catch(e) {
        console.error('Error consultando Supabase:', e.message);
        return null;
    }
}


// ─────────────────────────────────────────────
// GET /api/images/hunt?q=38002&sku=38002&limit=12
// ─────────────────────────────────────────────
export async function GET(request) {
    let browser = null;
    try {
        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q');
        const sku = searchParams.get('sku') || q; // sku puro para consulta Supabase
        const limit = parseInt(searchParams.get('limit') || '12');
        const MIN_HD_RESULTS = 3; // umbral para activar fallback

        if (!q) {
            return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
        }

        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage']
        });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 900 }
        });
        const page = await context.newPage();

        let images = [];
        const strategies_tried = [];
        let strategy_used = null;
        let productData = null;
        let product_found = false;

        // ── ESTRATEGIA 1: SKU Directo ──────────────────────────
        strategies_tried.push('sku_directo');
        images = await scrapeImages(page, q, limit, 'sku_directo');
        const hdCount1 = images.filter(i => i.is_hd).length;

        if (hdCount1 >= MIN_HD_RESULTS) {
            strategy_used = 'sku_directo';
        } else {
            // Consultar Supabase para estrategias de fallback
            productData = await getProductData(sku);
            product_found = !!productData;

            // ── ESTRATEGIA 2: Descripción del Producto (título de ML) ──
            if (productData?.title && productData.title.length > 5) {
                strategies_tried.push('descripcion');
                const descImages = await scrapeImages(page, productData.title, limit, 'descripcion');
                const hdCount2 = descImages.filter(i => i.is_hd).length;
                images = [...images, ...descImages];

                if (hdCount2 >= MIN_HD_RESULTS) {
                    strategy_used = 'descripcion';
                } else if (productData.equivalencias?.length > 0) {
                    // ── ESTRATEGIA 3: Equivalencias OEM ───────────────────
                    strategies_tried.push('equivalencias');
                    const oemQuery = `${sku} ${productData.equivalencias.join(' ')}`;
                    const oemImages = await scrapeImages(page, oemQuery, limit, 'equivalencias');
                    const hdCount3 = oemImages.filter(i => i.is_hd).length;
                    images = [...images, ...oemImages];

                    if (hdCount3 >= MIN_HD_RESULTS) {
                        strategy_used = 'equivalencias';
                    } else {
                        // ── ESTRATEGIA 4: Tipo Genérico (primeras palabras del título) ──
                        strategies_tried.push('tipo_generico');
                        // Quitar el SKU del título si aparece, tomar primeras 5 palabras útiles
                        const shortDesc = productData.title
                            .replace(new RegExp(sku, 'gi'), '')
                            .trim()
                            .split(' ')
                            .slice(0, 5)
                            .join(' ');
                        const genericQuery = shortDesc || productData.title.substring(0, 40);
                        const genericImages = await scrapeImages(page, genericQuery, limit, 'tipo_generico');
                        images = [...images, ...genericImages];
                        strategy_used = genericImages.length > 0 ? 'tipo_generico' : null;
                    }
                } else if (productData.marca || productData.modelo) {
                    // ── ESTRATEGIA 4 alternativa: Marca + Modelo ──────────
                    strategies_tried.push('tipo_generico');
                    const genericQuery = [productData.titulo?.split(' ').slice(0,3).join(' '), productData.marca, productData.modelo]
                        .filter(Boolean).join(' ');
                    const genericImages = await scrapeImages(page, genericQuery, limit, 'tipo_generico');
                    images = [...images, ...genericImages];
                    strategy_used = genericImages.length > 0 ? 'tipo_generico' : 'descripcion';
                } else {
                    strategy_used = hdCount2 > 0 ? 'descripcion' : null;
                }
            } else if (images.length > 0) {
                strategy_used = 'sku_directo';
            }
        }

        // Deduplicar por hd_url
        const seen = new Set();
        const uniqueImages = images.filter(img => {
            if (seen.has(img.hd_url)) return false;
            seen.add(img.hd_url);
            return true;
        });

        return NextResponse.json({
            success: true,
            sku,
            query: q,
            count: uniqueImages.length,
            hd_count: uniqueImages.filter(i => i.is_hd).length,
            strategy_used,
            strategies_tried,
            product_found,
            product_title: productData?.title || null,
            images: uniqueImages
        });

    } catch (error) {
        console.error("Error en Image Hunt:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (browser) await browser.close();
    }
}
