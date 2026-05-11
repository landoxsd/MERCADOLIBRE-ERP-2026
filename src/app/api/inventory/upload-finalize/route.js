import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import fs from "fs";
import path from "path";

export const maxDuration = 300; 

export async function POST(req) {
  try {
    const { accountId, mode, totalExcelCount } = await req.json();

    // Esperar 2 segundos para asegurar que Supabase haya terminado de indexar los últimos lotes
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!accountId) {
      return NextResponse.json({ error: "Falta accountId" }, { status: 400 });
    }

    // 1. Obtener TODO el inventario interno para comparación (Paginado para evitar límite de 1000)
    let internalItems = [];
    let fetchMoreInternal = true;
    let internalStart = 0;
    const internalStep = 1000;

    while (fetchMoreInternal) {
      const { data: chunk, error: internalError } = await supabaseAdmin
        .from("internal_inventory")
        .select("sku, title, price, cost, stock, brand, oem, subcategory, category")
        .range(internalStart, internalStart + internalStep - 1);

      if (internalError) throw internalError;

      if (chunk && chunk.length > 0) {
        internalItems = [...internalItems, ...chunk];
        internalStart += internalStep;
      } else {
        fetchMoreInternal = false;
      }
    }

    // 2. Obtener productos de ML (Paginado)
    let mlProducts = [];
    let fetchMore = true;
    let rangeStart = 0;
    const rangeStep = 1000;

    while (fetchMore) {
      const { data: chunk, error: mlError } = await supabaseAdmin
        .from("products")
        .select("id, meli_item_id, sku, title, status, permalink, price, available_qty, thumbnail, last_updated_meli, attributes")
        .eq("meli_account_id", accountId)
        .range(rangeStart, rangeStart + rangeStep - 1);

      if (mlError) throw mlError;

      if (chunk && chunk.length > 0) {
        mlProducts = [...mlProducts, ...chunk];
        rangeStart += rangeStep;
      } else {
        fetchMore = false;
      }
    }

    // 3. Auditoría Inteligente
    const normalize = (s) => String(s || "").trim().toUpperCase();
    const excelSkusSet = new Set(internalItems.map(i => i.sku));

    const orphansRaw = [];
    const matchedMeliIds = new Set();
    const matchedExcelSkus = new Set();
    const matchedItems = [];

    mlProducts.forEach(p => {
      const pSkus = String(p.sku || "").split(/[, /]+/).map(s => normalize(s)).filter(Boolean);

      let isMatched = false;
      pSkus.forEach(s => {
        if (excelSkusSet.has(s)) {
          isMatched = true;
          matchedExcelSkus.add(s);
          const itemInfo = internalItems.find(i => i.sku === s);
          if (itemInfo && !matchedItems.find(mi => mi.sku === s)) {
            matchedItems.push({ ...p, sku: s });
          }
        }
      });

      if (isMatched) {
        matchedMeliIds.add(p.meli_item_id);
      } else {
        orphansRaw.push(p);
      }
    });

    // 4. Enriquecer Huérfanos con Ventas (Solo los primeros 100 para no tardar demasiado)
    // Nota: Para una cuenta de 18k ítems, esto se debería hacer paginado o bajo demanda.
    // Traeremos ventas para los huérfanos detectados.
    const account = await accountsTable().select("access_token").eq("id", accountId).single();
    const orphans = await Promise.all(orphansRaw.slice(0, 1000).map(async (o) => {
      try {
        // Consultar ventas en vivo desde la API de ML
        const res = await fetch(`https://api.mercadolibre.com/items/${o.meli_item_id}?attributes=sold_quantity,health,visits`, {
          headers: { Authorization: `Bearer ${account.data.access_token}` }
        });
        const extra = await res.json();
        return { ...o, sold_quantity: extra.sold_quantity || 0, health: extra.health || 0 };
      } catch (e) {
        return { ...o, sold_quantity: 0 };
      }
    }));

    const missing = internalItems.filter(i => !matchedExcelSkus.has(i.sku));

    const outputPayload = {
      success: true,
      mode: mode,
      summary: {
        totalExcel: internalItems.length,
        totalML: mlProducts.length,
        matched: matchedMeliIds.size,
        orphansCount: orphansRaw.length,
        missingCount: missing.length,
      },
      matchedItems: matchedItems.slice(0, 500),
      orphans: orphans, // Ya enriquecidos con ventas
      missing: missing.slice(0, 3000),
      timestamp: new Date().toLocaleString()
    };

    // Guardar caché local
    try {
      const cachePath = path.join(process.cwd(), `.audit_cache_${mode}_${accountId}.json`);
      fs.writeFileSync(cachePath, JSON.stringify(outputPayload));
    } catch (e) {
      console.warn("No se pudo cachear la auditoría local:", e.message);
    }

    return NextResponse.json(outputPayload);

  } catch (error) {
    console.error("❌ Upload Finalize Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
