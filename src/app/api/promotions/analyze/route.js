import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { getItemsPromotionsBatch, calculateOptimalDealPrice } from "@/lib/meli-promotions";
import { getItemsBatch } from "@/lib/meli"; // Existing function
import { scrapeMeliSearch } from "@/lib/mlv-playwright-scraper"; // Existing scraper

export async function POST(request) {
  try {
    const { accountId, itemIds, filter = "all", includeCompetitors = false } = await request.json();
    
    if (!accountId || !itemIds || itemIds.length === 0) {
        return NextResponse.json({ error: "Faltan campos requeridos (accountId, itemIds)" }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(accountId);

    // 1. Obtener estado de promociones de todos los ítems
    const promoData = await getItemsPromotionsBatch(itemIds, accessToken);

    // 2. Enriquecer con datos básicos del ítem (precio, ventas, categoría)
    const itemsData = await getItemsBatch(itemIds, accessToken);
    
    // Unir los datos
    let analysis = itemsData.map(item => {
        const itemPromo = promoData.find(p => p.id === item.id)?.promos || [];
        return {
            ...item,
            promotions: itemPromo,
        };
    });

    // Filtros de priorización básica en memoria
    if (filter === "highest_ticket") {
        analysis.sort((a, b) => b.price - a.price);
    } else if (filter === "most_sold") {
        analysis.sort((a, b) => (b.sold_quantity || 0) - (a.sold_quantity || 0));
    } else if (filter === "least_sold") {
        analysis = analysis.filter(a => (a.sold_quantity || 0) > 0);
        analysis.sort((a, b) => (a.sold_quantity || 0) - (b.sold_quantity || 0));
    } else if (filter.startsWith("by_line:")) {
        const categoryId = filter.split(":")[1];
        analysis = analysis.filter(a => a.category_id === categoryId);
    } else if (filter.startsWith("by_brand:")) {
        const brand = filter.split(":")[1].toLowerCase();
        analysis = analysis.filter(a => {
            const itemBrand = a.attributes?.find(attr => attr.id === "BRAND")?.value_name?.toLowerCase();
            return itemBrand === brand;
        });
    }

    // 3 & 4. Si includeCompetitors, lanzar Playwright scraper para cada ítem
    if (includeCompetitors) {
        // Ejecutamos scrapeo en serie para evitar matar el headless browser o sobrecargar red
        for (let i = 0; i < analysis.length; i++) {
            const item = analysis[i];
            try {
                // Generar query de búsqueda limpia (similar a sniper logic)
                const query = item.title.substring(0, 50).trim(); 
                const scrapedData = await scrapeMeliSearch(query, { maxItems: 10 });
                
                if (scrapedData && scrapedData.length > 0) {
                    const competitorPrices = scrapedData.map(c => c.price).filter(p => typeof p === 'number');
                    const targetPriceInfo = calculateOptimalDealPrice(item.price, competitorPrices);
                    
                    // Encontrar al campeón para retornar su link
                    const champion = scrapedData.reduce((min, cur) => cur.price < min.price ? cur : min, scrapedData[0]);
                    
                    // El cálculo nos puede devolver un número (en el mock lo devolvía)
                    // Ajustamos el schema si lo devolvimos estructurado en la lib o solo el numero
                    const dealPrice = typeof targetPriceInfo === 'number' ? targetPriceInfo : targetPriceInfo.deal_price;
                    
                    item.competitorAnalysis = {
                        success: true,
                        competitorPrices,
                        minCompetitorPrice: Math.min(...competitorPrices),
                        suggestedDealPrice: dealPrice,
                        championPermalink: champion?.permalink || null
                    };
                } else {
                    item.competitorAnalysis = { success: false, reason: "No competitors found" };
                }
            } catch (err) {
                console.error(`Error scraping for item ${item.id}:`, err);
                item.competitorAnalysis = { success: false, reason: err.message };
            }
        }
    }

    return NextResponse.json({ 
      analysis,
      fetchedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error en /api/promotions/analyze POST:", err.message);
    return NextResponse.json({ error: err.message || "Error del servidor" }, { status: 500 });
  }
}
