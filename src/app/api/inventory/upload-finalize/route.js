import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import fs from "fs";
import path from "path";

export const maxDuration = 300; 

export async function POST(req) {
  try {
    const { accountId, mode, totalExcelCount } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: "Falta accountId" }, { status: 400 });
    }

    // 1. Obtener TODO el inventario interno para comparación (Solo SKUs para no saturar memoria)
    const { data: internalItems, error: internalError } = await supabaseAdmin
      .from("internal_inventory")
      .select("sku, title, price, cost, stock, brand, oem, subcategory");

    if (internalError) throw internalError;

    // 2. Obtener productos de ML (Paginado)
    let mlProducts = [];
    let fetchMore = true;
    let rangeStart = 0;
    const rangeStep = 1000;

    while (fetchMore) {
      const { data: chunk, error: mlError } = await supabaseAdmin
        .from("products")
        .select("id, meli_item_id, sku, title, status, permalink, price")
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

    const orphans = [];
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
          // Si matchea, guardamos la info para mostrarla
          const itemInfo = internalItems.find(i => i.sku === s);
          if (itemInfo && !matchedItems.find(mi => mi.sku === s)) {
            matchedItems.push({ ...p, sku: s });
          }
        }
      });

      if (isMatched) {
        matchedMeliIds.add(p.meli_item_id);
      } else {
        orphans.push(p);
      }
    });

    const missing = internalItems.filter(i => !matchedExcelSkus.has(i.sku));

    const outputPayload = {
      success: true,
      mode: mode,
      summary: {
        totalExcel: internalItems.length,
        totalML: mlProducts.length,
        matched: matchedMeliIds.size,
        orphansCount: orphans.length,
        missingCount: missing.length,
      },
      matchedItems: matchedItems.slice(0, 500),
      orphans: orphans.slice(0, 3000),
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
