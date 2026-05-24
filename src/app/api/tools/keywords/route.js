// ================================================================
// POST /api/tools/keywords
// Análisis inverso de keywords: extrae términos de búsqueda
// reales del mercado MLV y calcula sus métricas de performance.
// ================================================================
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { scrapeMeliSearch } from "@/lib/mlv-playwright-scraper";

const MELI_BASE_URL = "https://api.mercadolibre.com";

// ─────────────────────────────────────────────
// Helper: Tokenizar títulos en keywords n-gram
// ─────────────────────────────────────────────
const STOP_WORDS = new Set([
    "de", "del", "para", "con", "sin", "en", "la", "el", "los", "las", "un",
    "una", "y", "o", "e", "al", "a", "por", "su", "se", "es", "lo", "que",
    "no", "si", "le", "les", "x", "the", "and", "for", "of", "to",
]);

function tokenizeTitles(titles) {
    const freq = {};
    const bigramFreq = {};
    
    for (const title of titles) {
        if (!title) continue;
        const words = title
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar tildes
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter(w => w.length > 2 && !STOP_WORDS.has(w));
        
        // Unigrams
        for (const w of words) {
            freq[w] = (freq[w] || 0) + 1;
        }
        
        // Bigrams (2 palabras consecutivas)
        for (let i = 0; i < words.length - 1; i++) {
            const bigram = `${words[i]} ${words[i + 1]}`;
            bigramFreq[bigram] = (bigramFreq[bigram] || 0) + 1;
        }
    }
    
    return { freq, bigramFreq };
}

// ─────────────────────────────────────────────
// Helper: Analizar un keyword con el scraper
// ─────────────────────────────────────────────
async function analyzeKeyword(keyword, accessToken) {
    const result = {
        keyword,
        competitors: 0,
        avg_price: 0,
        max_price: 0,
        min_price: 0,
        total_sold: 0,
        free_shipping_pct: 0,
        estimated_revenue: 0,
        conversion_score: 0, // Ventas promedio por ítem
        items: [],
        source: "no_data",
    };
    
    try {
        // Intentar búsqueda con API oficial primero
        const headers = { "Accept": "application/json" };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
        
        // Nota: /sites/MLV/search está bloqueado por ML para Venezuela
        // Usamos el scraper Playwright como fallback garantizado
        let items = [];
        
        // Intentar primero la API oficial (puede funcionar con token válido)
        try {
            const apiUrl = `${MELI_BASE_URL}/sites/MLV/search?q=${encodeURIComponent(keyword)}&limit=20`;
            const apiRes = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(5000) });
            
            if (apiRes.ok) {
                const apiData = await apiRes.json();
                items = apiData.results || [];
                result.source = "api_official";
                console.log(`✅ API oficial exitosa para "${keyword}": ${items.length} resultados`);
            }
        } catch (apiErr) {
            console.warn(`⚠️ API oficial bloqueada para "${keyword}". Usando Playwright scraper...`);
        }
        
        // Si la API falló, usar scraper Playwright
        if (items.length === 0) {
            const scrapedItems = await scrapeMeliSearch(keyword);
            if (scrapedItems && scrapedItems.length > 0) {
                items = scrapedItems;
                result.source = "playwright_scraper";
                console.log(`🕷️ Playwright exitoso para "${keyword}": ${items.length} resultados`);
            }
        }
        
        if (items.length === 0) {
            result.source = "no_results";
            return result;
        }
        
        // Calcular métricas de la muestra
        const prices = items.map(i => i.price || 0).filter(p => p > 0);
        const sales = items.map(i => i.sold_quantity || 0);
        const freeShippingCount = items.filter(i => i.shipping?.free_shipping || i.free_shipping).length;
        
        result.competitors = items.length;
        result.avg_price = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
        result.max_price = prices.length > 0 ? Math.max(...prices) : 0;
        result.min_price = prices.length > 0 ? Math.min(...prices) : 0;
        result.total_sold = sales.reduce((a, b) => a + b, 0);
        result.free_shipping_pct = items.length > 0 ? (freeShippingCount / items.length) * 100 : 0;
        result.estimated_revenue = items.reduce((sum, i) => sum + ((i.sold_quantity || 0) * (i.price || 0)), 0);
        result.conversion_score = result.competitors > 0 ? result.total_sold / result.competitors : 0;
        result.items = items.slice(0, 5).map(i => ({
            id: i.id,
            title: i.title,
            price: i.price,
            sold: i.sold_quantity || 0,
        }));
        
    } catch (err) {
        console.error(`❌ Error analizando keyword "${keyword}":`, err.message);
        result.source = "error";
    }
    
    return result;
}

// ─────────────────────────────────────────────
// POST handler principal
// ─────────────────────────────────────────────
export async function POST(request) {
    try {
        const { category_id, seed_keyword, account_id, max_keywords = 20 } = await request.json();
        
        if (!category_id && !seed_keyword) {
            return NextResponse.json({ error: "Se requiere category_id o seed_keyword" }, { status: 400 });
        }
        
        // 1. Obtener token
        let accessToken = null;
        let resolvedAccountId = account_id;
        
        if (!resolvedAccountId) {
            const { data: firstAccount } = await supabaseAdmin
                .from("meli_accounts")
                .select("id")
                .limit(1)
                .single();
            if (firstAccount) resolvedAccountId = firstAccount.id;
        }
        
        if (resolvedAccountId) {
            try {
                accessToken = await getValidAccessToken(resolvedAccountId);
            } catch (e) {
                console.warn("⚠️ No se pudo obtener token:", e.message);
            }
        }
        
        // 2. Recopilar keywords semilla desde nuestra propia DB de productos
        const candidateKeywords = new Set();
        
        if (seed_keyword) {
            candidateKeywords.add(seed_keyword.trim().toLowerCase());
            // Generar variaciones de la keyword semilla
            const parts = seed_keyword.trim().toLowerCase().split(/\s+/);
            if (parts.length > 1) {
                parts.forEach(p => p.length > 3 && candidateKeywords.add(p));
            }
        }
        
        // Extraer keywords de los títulos de nuestro catálogo en Supabase
        let catalogQuery = supabaseAdmin
            .from("products")
            .select("title, category_id")
            .not("title", "is", null)
            .limit(500);
        
        if (category_id) {
            catalogQuery = catalogQuery.eq("category_id", category_id);
        }
        
        const { data: catalogItems } = await catalogQuery;
        
        if (catalogItems && catalogItems.length > 0) {
            const titles = catalogItems.map(i => i.title);
            const { freq, bigramFreq } = tokenizeTitles(titles);
            
            // Tomar los unigrams más frecuentes (aparecen en ≥3 títulos)
            Object.entries(freq)
                .filter(([, count]) => count >= 2)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 15)
                .forEach(([word]) => candidateKeywords.add(word));
            
            // Tomar los bigrams más frecuentes
            Object.entries(bigramFreq)
                .filter(([, count]) => count >= 2)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .forEach(([bigram]) => candidateKeywords.add(bigram));
        }
        
        // También buscar keywords guardadas previamente en DB para esta categoría
        if (category_id) {
            const { data: savedKeywords } = await supabaseAdmin
                .from("category_keywords")
                .select("keyword")
                .eq("category_id", category_id)
                .order("search_volume", { ascending: false })
                .limit(10);
            
            if (savedKeywords) {
                savedKeywords.forEach(row => candidateKeywords.add(row.keyword));
            }
        }
        
        // Limitar keywords a analizar
        const keywordsToAnalyze = [...candidateKeywords].slice(0, max_keywords);
        
        if (keywordsToAnalyze.length === 0) {
            return NextResponse.json({ 
                error: "No se encontraron keywords para analizar. Prueba ingresando un seed_keyword." 
            }, { status: 404 });
        }
        
        // 3. Analizar cada keyword en paralelo (lotes de 5 para no sobrecargar)
        const results = [];
        const batchSize = 5;
        
        for (let i = 0; i < keywordsToAnalyze.length; i += batchSize) {
            const batch = keywordsToAnalyze.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(kw => analyzeKeyword(kw, accessToken))
            );
            results.push(...batchResults);
            
            // Pequeño delay entre lotes
            if (i + batchSize < keywordsToAnalyze.length) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
        
        // Filtrar sólo las que obtuvieron datos
        const validResults = results.filter(r => r.competitors > 0);
        
        // 4. Normalizar conversion_score para calcular heatmap %
        const maxConversion = Math.max(...validResults.map(r => r.conversion_score), 1);
        const maxRevenue = Math.max(...validResults.map(r => r.estimated_revenue), 1);
        
        const enrichedResults = validResults.map(r => ({
            ...r,
            avg_price: parseFloat(r.avg_price.toFixed(2)),
            max_price: parseFloat(r.max_price.toFixed(2)),
            min_price: parseFloat(r.min_price.toFixed(2)),
            estimated_revenue: parseFloat(r.estimated_revenue.toFixed(2)),
            conversion_score: parseFloat(r.conversion_score.toFixed(2)),
            free_shipping_pct: parseFloat(r.free_shipping_pct.toFixed(1)),
            // % normalizado para heatmap (0–100)
            conversion_heat: parseFloat(((r.conversion_score / maxConversion) * 100).toFixed(1)),
            revenue_heat: parseFloat(((r.estimated_revenue / maxRevenue) * 100).toFixed(1)),
        }));
        
        // Ordenar por conversión (ventas/ítem) descendente
        enrichedResults.sort((a, b) => b.conversion_score - a.conversion_score);
        
        // 5. Persistir en category_keywords (upsert por keyword+category)
        if (category_id && enrichedResults.length > 0) {
            const toUpsert = enrichedResults.map(r => ({
                category_id,
                keyword: r.keyword,
                search_volume: r.total_sold, // Proxy de volumen
                conversion_items: r.competitors,
                scanned_at: new Date().toISOString(),
            }));
            
            await supabaseAdmin
                .from("category_keywords")
                .upsert(toUpsert, { onConflict: "category_id,keyword" })
                .select();
        }
        
        // 6. Calcular estadísticas globales para el resumen
        const globalStats = {
            total_keywords_analyzed: keywordsToAnalyze.length,
            valid_with_data: validResults.length,
            top_keyword: enrichedResults[0]?.keyword || null,
            avg_market_price: validResults.length > 0
                ? parseFloat((validResults.reduce((s, r) => s + r.avg_price, 0) / validResults.length).toFixed(2))
                : 0,
            total_market_revenue: parseFloat(validResults.reduce((s, r) => s + r.estimated_revenue, 0).toFixed(2)),
            high_conversion_keywords: enrichedResults.filter(r => r.conversion_heat >= 70).length,
            opportunities: enrichedResults.filter(r => r.competitors < 10 && r.total_sold > 5).length,
        };
        
        return NextResponse.json({
            success: true,
            category_id: category_id || null,
            seed_keyword: seed_keyword || null,
            global_stats: globalStats,
            keywords: enrichedResults,
        });
        
    } catch (err) {
        console.error("❌ Keywords analysis error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
