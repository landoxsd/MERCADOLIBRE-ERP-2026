import { NextResponse } from "next/server";
import { chromium } from "playwright";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const maxDuration = 60;

// ─────────────────────────────────────────────
// Helper: hacer scraping con una query en DDG
// Reutiliza la page ya abierta (evita re-abrir browser)
// ─────────────────────────────────────────────
async function scrapeImages(page, query, limit, strategyName) {
    // Si la query es muy corta o parece solo un SKU, le damos algo de contexto, pero no demasiado
    const isPureSku = /^[A-Z0-9-]+$/i.test(query) && query.length < 15;
    const fullQuery = isPureSku ? `${query} autopart` : query;
    const encodedQuery = encodeURIComponent(fullQuery);

    await page.goto(
        `https://images.search.yahoo.com/search/images?p=${encodedQuery}`,
        { waitUntil: 'networkidle', timeout: 25000 }
    );
    await page.waitForTimeout(2000); // Espera explicita por carga dinamica de Yahoo

    const html = await page.content();
    
    // Yahoo guarda la url original en la URL de redireccion y en metadata json embebido
    // Extraemos todas las URLs validas de imagenes en el codigo fuente
    const urlRegex = /https?:\/\/[^\s"'<>]+?(?:\.jpg|\.jpeg|\.png|\.webp)/gi;
    const matches = [...html.matchAll(urlRegex)].map(m => m[0]);
    
    // Limpiamos dominios basura o de thumbnails de buscadores
    const cleanUrls = matches.filter(u => 
        !u.includes('yahoo.com') && 
        !u.includes('yimg.com') && 
        !u.includes('bing.net') && 
        !u.includes('tse') &&
        !u.includes('w3.org')
    ).map(u => {
        try { return decodeURIComponent(u); } catch(e) { return u; }
    });

    // Removemos duplicados
    const uniqueImages = [...new Set(cleanUrls)].slice(0, limit);

    const formattedImages = uniqueImages.map(src => {
        let domain = '';
        try { domain = new URL(src).hostname.replace('www.', ''); } catch(e) {}
        return {
            hd_url: src,
            thumbnail: src,
            width: 800, // asumiendo HD
            height: 800,
            title: query,
            domain: domain,
            is_hd: true,
            strategy: strategyName
        };
    });

    return formattedImages;
}

// ─────────────────────────────────────────────
// Helper: buscar en Mercado Libre directamente
// Extrae la imagen en HD reemplazando -I por -O
// ─────────────────────────────────────────────
async function searchMercadoLibre(query, limit, accessToken) {
    try {
        const headers = {};
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }
        
        const res = await fetch(`https://api.mercadolibre.com/sites/MLV/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
            headers
        });
        
        if (!res.ok) {
            console.error("ML API Error in Search:", await res.text());
            return [];
        }
        const data = await res.json();
        const results = [];
        for (const item of (data.results || [])) {
            if (!item.thumbnail) continue;
            // thumbnail: "http://http2.mlstatic.com/D_711610-MLV72363694956_102023-I.jpg"
            const thumbUrl = item.thumbnail.replace('http://', 'https://');
            const hdUrl = thumbUrl.replace('-I.jpg', '-O.jpg').replace('-I.webp', '-O.webp');
            
            results.push({
                hd_url: hdUrl,
                thumbnail: thumbUrl,
                width: 1000,
                height: 1000,
                title: item.title,
                domain: 'mercadolibre.com.ve',
                is_hd: true,
                strategy: 'mercadolibre_global'
            });
        }
        return results;
    } catch(e) {
        console.error("Error en fallback de ML:", e);
        return [];
    }
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
                    const genericQuery = [productData.title?.split(' ').slice(0,3).join(' '), productData.marca, productData.modelo]
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

        // ── ESTRATEGIA 5: MercadoLibre Global API (ULTIMATE FALLBACK) ──
        // Si no tenemos suficientes imagenes y el SKU es puro o numerico (como 92100961), ML siempre tiene la razon.
        const currentHdCount = images.filter(i => i.is_hd).length;
        if (currentHdCount < MIN_HD_RESULTS) {
            strategies_tried.push('mercadolibre_global');
            // Buscar por SKU + descripcion corta si la tenemos
            let mlQuery = q;
            if (productData && productData.title) {
                 // Tomar el SKU + las primeras 5 palabras de la descripcion para no saturar el buscador de ML
                 const shortDesc = productData.title
                     .replace(new RegExp(sku, 'gi'), '')
                     .trim()
                     .split(' ')
                     .slice(0, 5)
                     .join(' ');
                 mlQuery = `${q} ${shortDesc}`.trim();
            }

            // Obtener token para la API de ML
            const { data: accounts } = await supabaseAdmin
                .from('meli_accounts')
                .select('access_token')
                .not('access_token', 'is', null)
                .limit(1);
            const token = accounts?.[0]?.access_token;

            const mlImages = await searchMercadoLibre(mlQuery, limit, token);
            if (mlImages.length > 0) {
                images = [...images, ...mlImages];
                strategy_used = 'mercadolibre_global';
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
