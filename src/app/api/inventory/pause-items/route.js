import { NextResponse } from "next/server";
import { supabaseAdmin, accountsTable } from "@/lib/supabase-admin";

export async function POST(req) {
  try {
    const { accountId, itemIds } = await req.json();

    if (!accountId || !itemIds || !Array.isArray(itemIds)) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    // 1. Obtener el token de la cuenta
    const { data: account, error: accError } = await accountsTable()
      .select("access_token")
      .eq("id", accountId)
      .single();

    if (accError || !account) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    console.log(`⏸️ Iniciando pausado masivo de ${itemIds.length} ítems...`);

    // 2. Procesar en paralelo (con límite para no saturar la API de ML)
    // Usaremos una técnica de "chunks" para no disparar 1000 peticiones al mismo tiempo
    const BATCH_SIZE = 20;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < itemIds.length; i += BATCH_SIZE) {
      const chunk = itemIds.slice(i, i + BATCH_SIZE);
      
      const promises = chunk.map(async (id) => {
        try {
          const res = await fetch(`https://api.mercadolibre.com/items/${id}`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: "paused" })
          });

          if (res.ok) {
            // Actualizar estado en nuestra base de datos también para que el dashboard esté al día
            await supabaseAdmin
              .from("products")
              .update({ status: "paused", updated_at: new Date() })
              .eq("meli_item_id", id);
            
            successCount++;
          } else {
            errorCount++;
            const errBody = await res.json();
            console.warn(`❌ No se pudo pausar ${id}:`, errBody.message);
          }
        } catch (e) {
          errorCount++;
          console.error(`❌ Error de red pausando ${id}:`, e.message);
        }
      });

      await Promise.all(promises);
      console.log(`⏳ Procesados ${Math.min(i + BATCH_SIZE, itemIds.length)} / ${itemIds.length}`);
    }

    return NextResponse.json({
      success: true,
      count: successCount,
      errors: errorCount,
      message: `Se pausaron ${successCount} publicaciones con éxito. ${errorCount} fallaron.`
    });

  } catch (error) {
    console.error("❌ Pause Items Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
