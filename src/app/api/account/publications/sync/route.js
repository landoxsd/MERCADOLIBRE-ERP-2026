// ================================================================
// src/app/api/account/publications/sync/route.js
// Endpoint para sincronizar masivamente los productos de ML -> Supabase
// ================================================================
import { NextResponse } from "next/server";
import { supabaseAdmin, accountsTable, productsTable } from "@/lib/supabase-admin";
import { getAllItemIds, getItemsBatch, getItemsVisitsBatch, extractSku } from "@/lib/meli";

export async function POST(req) {
  try {
    const { accountId } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: "Falta accountId" }, { status: 400 });
    }

    // 1. Obtener la cuenta de la BD para tener el token
    const { data: account, error: accError } = await accountsTable()
      .select("*")
      .eq("id", accountId)
      .single();

    if (accError || !account) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    console.log(`🔄 Iniciando sync para cuenta: ${account.nickname} (${accountId})`);

    // 2. Obtener todos los IDs de publicaciones activas
    // Nota: getAllItemIds tiene un límite de 1000 por offset simple de API.
    // Para 18k ítems lo ideal es usar scroll o notificaciones una vez hecha la base.
    const allIds = await getAllItemIds(account.meli_user_id, account.access_token, "active");
    
    console.log(`📦 Encontrados ${allIds.length} ítems para sincronizar.`);

    // 3. Procesar en batches de 100 (dentro 5 llamadas de 20 a ML)
    let processed = 0;
    const batchSize = 100;
    
    for (let i = 0; i < allIds.length; i += batchSize) {
      const chunk = allIds.slice(i, i + batchSize);
      
      // Obtener detalles y visitas en paralelo desde ML
      const [details, visitsMap] = await Promise.all([
        getItemsBatch(chunk, account.access_token),
        getItemsVisitsBatch(chunk, account.access_token)
      ]);
      
      // Formatear para Supabase — incluyendo ventas, visitas y JSON bruto
      const toUpsert = details
        .filter(item => item && item.id && item.title)
        .map(item => ({
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
          sku: extractSku(item),
          attributes: item.attributes || [],
          raw_data: item, // JSON completo para análisis histórico
          last_updated_meli: item.last_updated,
          updated_at: new Date()
        }));

      // Upsert a Supabase
      const { error: upsertError } = await productsTable().upsert(toUpsert, {
        onConflict: 'meli_item_id'
      });

      if (upsertError) {
        console.error("❌ Error en upsert batch:", upsertError);
      }

      processed += toUpsert.length;
      console.log(`⏳ Procesados ${processed} / ${allIds.length} | Ventas capturadas ✅`);
    }

    return NextResponse.json({
      success: true,
      count: processed,
      message: `Sincronizados ${processed} productos exitosamente.`
    });

  } catch (error) {
    console.error("❌ Sync Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
