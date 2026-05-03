import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req) {
  try {
    const { title, categoryId, accountId } = await req.json();

    if (!title || !accountId) {
      return NextResponse.json({ error: "Faltan datos (title, accountId)" }, { status: 400 });
    }

    // 1. Obtener Token de la cuenta para usar la API
    const { data: account } = await supabaseAdmin
      .from('meli_accounts')
      .select('access_token')
      .eq('id', accountId)
      .single();

    if (!account) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    const token = account.access_token;

    // 2. Buscar en Mercado Libre la competencia para este título
    // Filtramos por categoría si está disponible para mayor precisión
    let searchUrl = `https://api.mercadolibre.com/sites/MLV/search?q=${encodeURIComponent(title)}&limit=3`;
    if (categoryId) searchUrl += `&category=${categoryId}`;

    let searchRes = await fetch(searchUrl);
    let searchData = await searchRes.json();

    // FALLBACK 1: Si no hay resultados con categoría, buscar globalmente
    if ((!searchData.results || searchData.results.length === 0) && categoryId) {
      console.log("Fallback 1: Buscando sin categoría...");
      searchUrl = `https://api.mercadolibre.com/sites/MLV/search?q=${encodeURIComponent(title)}&limit=3`;
      searchRes = await fetch(searchUrl);
      searchData = await searchRes.json();
    }

    // FALLBACK 2: Si sigue sin haber resultados, simplificar el título (primeras 6 palabras)
    if (!searchData.results || searchData.results.length === 0) {
      console.log("Fallback 2: Simplificando título...");
      const simplifiedTitle = title.split(' ').slice(0, 6).join(' ');
      searchUrl = `https://api.mercadolibre.com/sites/MLV/search?q=${encodeURIComponent(simplifiedTitle)}&limit=3`;
      searchRes = await fetch(searchUrl);
      searchData = await searchRes.json();
    }

    if (!searchData.results || searchData.results.length === 0) {
      return NextResponse.json({ error: "No se encontraron competidores ni siquiera con búsqueda simplificada." }, { status: 404 });
    }

    // 3. Obtener el detalle del mejor posicionado (el primero)
    const bestCompetitorId = searchData.results[0].id;
    const itemRes = await fetch(`https://api.mercadolibre.com/items/${bestCompetitorId}`);
    const itemData = await itemRes.json();

    // 4. Extraer atributos útiles (evitando IDs internos como SKU o Condición que son propios)
    const blacklistedIds = ['SELLER_SKU', 'ITEM_CONDITION', 'PRICE', 'STOCK'];
    const suggestedAttributes = (itemData.attributes || [])
      .filter(attr => !blacklistedIds.includes(attr.id))
      .map(attr => ({
        id: attr.id,
        name: attr.name,
        value_name: attr.value_name
      }));

    return NextResponse.json({
      success: true,
      competitorItem: {
        id: itemData.id,
        title: itemData.title,
        permalink: itemData.permalink
      },
      attributes: suggestedAttributes
    });

  } catch (error) {
    console.error("❌ Suggest Attributes Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
