// src/app/api/account/publications/sync/batch/route.js
import { NextResponse } from "next/server";
import { productsTable, accountsTable } from "@/lib/supabase-admin";
import { getItemsBatch } from "@/lib/meli";

export async function POST(req) {
  try {
    const { accountId, itemIds } = await req.json();

    if (!accountId || !itemIds || !itemIds.length) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    // 1. Obtener un TOKEN VÁLIDO (con refresco automático)
    const { getValidAccessToken } = await import("@/lib/meli-auth-helper");
    let accessToken;
    try {
      accessToken = await getValidAccessToken(accountId);
    } catch (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    // Obtener nickname para logs
    const { data: account } = await accountsTable().select("nickname").eq("id", accountId).single();

    // 2. Obtener detalles desde ML (getItemsBatch ya maneja chunks de 20)
    console.log(`📥 Procesando lote de ${itemIds.length} ítems para ${account?.nickname}...`);
    const [details, visitsMap] = await Promise.all([
      getItemsBatch(itemIds, accessToken),
      import("@/lib/meli").then(m => m.getItemsVisitsBatch(itemIds, accessToken))
    ]);

    // 3. Formatear para Supabase y FILTRAR NULOS
    const { extractSku } = await import("@/lib/meli");
    const toUpsert = details
      .filter(item => item && item.id && item.title) // <--- FILTRO DE SEGURIDAD
      .map(item => {
        const skuValue = extractSku(item);

        return {
          meli_item_id: item.id,
          meli_account_id: accountId,
          title: item.title,
          status: item.status,
          price: item.price,
          sold_quantity: item.sold_quantity || 0,
          visits_count: visitsMap[item.id] || 0,
          available_qty: item.available_quantity,
          permalink: item.permalink,
          thumbnail: item.thumbnail,
          category_id: item.category_id,
          domain_id: item.domain_id,
          sku: skuValue,
          attributes: item.attributes || [],
          raw_data: item, // <--- ADICIÓN CLAVE: Archivo Histórico Bruto de todo el JSON de la API
          last_updated_meli: item.last_updated,
          updated_at: new Date()
        };
      });

    if (toUpsert.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: "Lote vacío o con errores ignorados" });
    }

    // 4. Upsert masivo a Supabase
    const { error: upsertError } = await productsTable().upsert(toUpsert, {
      onConflict: 'meli_item_id'
    });

    if (upsertError) {
      console.error("❌ Error en Upsert Supabase:", upsertError);
      throw new Error(`DB Error: ${upsertError.message}`);
    }

    return NextResponse.json({
      success: true,
      count: toUpsert.length,
      message: `Procesados ${toUpsert.length} productos.`
    });

  } catch (error) {
    console.error("❌ Sync Batch Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
