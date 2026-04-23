// ================================================================
// src/app/api/inventory/orphans/pause/route.js
// Endpoint para pausar masivamente las publicaciones huérfanas
// ================================================================
import { NextResponse } from "next/server";
import { supabaseAdmin, productsTable } from "@/lib/supabase-admin";
import { meliGet } from "@/lib/meli";

export async function POST(req) {
  try {
    const { accountId, itemIds } = await req.json();

    if (!accountId || !itemIds || !itemIds.length) {
      return NextResponse.json({ error: "Faltan datos para la operación" }, { status: 400 });
    }

    // 1. Obtener un TOKEN VÁLIDO (con refresco automático)
    const { getValidAccessToken } = await import("@/lib/meli-auth-helper");
    let accessToken;
    try {
      accessToken = await getValidAccessToken(accountId);
    } catch (authError) {
      console.error("❌ Error de autenticación en pausado:", authError.message);
      return NextResponse.json({ error: "Sesión expirada. Por favor, re-vincule la cuenta." }, { status: 401 });
    }

    console.log(`⏸️ Pausando ${itemIds.length} publicaciones huérfanas con token validado...`);

    // 2. Realizar las peticiones a Mercado Libre para cambiar status a 'paused'
    const results = { success: 0, failed: 0, errors: [] };

    // Procesamos uno por uno para asegurar el reporte individual
    for (const itemId of itemIds) {
      try {
        const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
          method: "PUT",
          headers: { 
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ 
            status: "paused",
            available_quantity: 0 
          })
        });

        if (res.ok) {
          // Actualizar en base de datos local
          await productsTable().update({ status: "paused" }).eq("meli_item_id", itemId);
          results.success++;
        } else {
          const errBody = await res.json().catch(() => ({}));
          const errMsg = errBody.message || res.statusText;
          console.warn(`⚠️ No se pudo pausar ${itemId}:`, errBody);
          results.failed++;
          if (results.errors.length < 5) results.errors.push(`${itemId}: ${errMsg} | Details: ${JSON.stringify(errBody.cause || [])}`);
        }
      } catch (err) {
        console.error(`❌ Error de red pausando ${itemId}:`, err.message);
        results.failed++;
        if (results.errors.length < 5) results.errors.push(`${itemId}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Proceso completado. Éxito: ${results.success}, Fallidos: ${results.failed}. Ver consola/errores para detalles.`
    });

  } catch (error) {
    console.error("❌ Pause Orphans Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
