// ================================================================
// src/app/api/inventory/upload/route.js
// Endpoint para procesar el Excel de inventario local y realizar auditoría
// ================================================================
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const accountId = formData.get("accountId"); 

    if (!file) return NextResponse.json({ error: "No se subió archivo" }, { status: 400 });

    // 1. Leer el archivo Excel (Modo RAW para detectar cabeceras dinámicas)
    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // 2. Localizar la fila de cabecera (buscamos "CODIGO")
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(rawRows.length, 50); i++) {
      const row = rawRows[i];
      if (row && row.some(cell => String(cell).toUpperCase().includes("CODIGO"))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json({ error: "No se encontró la columna 'CODIGO' en las primeras 50 filas del archivo" }, { status: 400 });
    }

    // 3. Mapear datos a partir de la cabecera encontrada
    // Buscamos los índices de las columnas necesarias
    const activeHeaders = rawRows[headerRowIndex].map(h => String(h).toUpperCase());
    const idxSku = activeHeaders.findIndex(h => h.includes("CODIGO"));
    const idxTitle = activeHeaders.findIndex(h => h.includes("DESCRIPCION") || h.includes("TITULO"));
    const idxPrice = activeHeaders.findIndex(h => h.includes("PRECIO") || h.includes("TOTAL"));
    const idxStock = activeHeaders.findIndex(h => h.includes("EXISTENCIA") || h.includes("STOCK"));

    // Helper para normalizar SKUs (Mayúsculas y sin espacios)
    const normalize = (s) => String(s || "").trim().toUpperCase();

    const internalItems = rawRows.slice(headerRowIndex + 1)
      .filter(row => row[idxSku]) 
      .map(row => ({
        sku: normalize(row[idxSku]),
        title: String(row[idxTitle] || "").trim(),
        price: parseFloat(row[idxPrice] || 0),
        stock: parseFloat(row[idxStock] || 0)
      }))
      .filter(item => item.sku && item.sku !== "CODIGO");

    if (internalItems.length === 0) {
      return NextResponse.json({ error: "No se encontraron SKUs válidos en el archivo" }, { status: 400 });
    }

    // 4. Guardar/Actualizar inventario interno en Supabase
    const { error: upsertError } = await supabaseAdmin
      .from("internal_inventory")
      .upsert(internalItems, { onConflict: "sku" });

    if (upsertError) throw upsertError;

    // 5. Realizar la Auditoría Inteligente (Comparación con Soporte Masivo > 1000 items)
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

    const excelSkusSet = new Set(internalItems.map(i => i.sku));
    
    const orphans = [];
    const matchedMeliIds = new Set();
    const matchedExcelSkus = new Set();

    mlProducts.forEach(p => {
      const pSkus = String(p.sku || "").split(/[, /]+/).map(s => normalize(s)).filter(Boolean);
      
      let isMatched = false;
      pSkus.forEach(s => {
        if (excelSkusSet.has(s)) {
          isMatched = true;
          matchedExcelSkus.add(s);
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
      summary: {
        totalExcel: internalItems.length,
        totalML: mlProducts.length,
        matched: matchedMeliIds.size,
        orphansCount: orphans.length,
        missingCount: missing.length,
      },
      orphans: orphans.slice(0, 3000), 
      missing: missing.slice(0, 100),
      timestamp: new Date().toLocaleString()
    };

    // Guardar una "fotografía" en el servidor para retomarla después
    try {
      const fs = require('fs');
      const path = require('path');
      fs.writeFileSync(path.join(process.cwd(), `.audit_cache_${accountId}.json`), JSON.stringify(outputPayload));
    } catch(e) {
      console.warn("No se pudo cachear la auditoría local:", e.message);
    }

    return NextResponse.json(outputPayload);

  } catch (error) {
    console.error("❌ Inventory Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
