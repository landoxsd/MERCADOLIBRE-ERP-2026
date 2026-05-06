// ================================================================
// src/app/api/inventory/upload/route.js
// Endpoint para procesar el Excel de inventario local y realizar auditoría
// ================================================================
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/lib/supabase-admin";
import fs from "fs";
import path from "path";

export const maxDuration = 300; // 5 minutos para procesar 27k+ registros
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const accountId = formData.get("accountId");
    const mode = formData.get("mode") || "master";

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
      if (row && row.some(cell => {
        const val = String(cell).toUpperCase();
        return val.includes("CODIGO") || val.includes("CÓDIGO") || val.includes("ARTICULO");
      })) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json({ error: "No se encontró una columna de identificación (CODIGO) en las primeras 50 filas" }, { status: 400 });
    }

    // 3. Detectar índices dinámicamente desde la fila de cabecera
    const headers = rawRows[headerRowIndex].map(h => String(h || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

    const idxSku = headers.findIndex(h => h === "CODIGO" || h === "CODIGO" || h === "ARTICULO" || h === "ARTÍCULO");
    const idxTitle = headers.findIndex(h => h === "DESCRIPCION" || h === "DESCRIPCIÓN" || h === "DESCRIPCION1");
    const idxBrand = headers.findIndex(h => h === "MARCA");
    const idxOem = headers.findIndex(h => h === "CAMPO7" || h === "CODIGO ALTERNO" || h === "OEM");
    const idxStock = headers.findIndex(h => h === "STOCK" || h === "CANTIDAD" || h === "EXISTENCIA");
    const idxCost = headers.findIndex(h => h === "COSTO" || h === "PRECIO" || h === "COSTO ACTUAL");
    const idxSubcategory = headers.findIndex(h => h.includes("SUB") && (h.includes("LINEA") || h.includes("LÍNEA") || h.includes("CATEG")));

    // Fallback a índices fijos si no se detectan
    const finalIdxSku = idxSku >= 0 ? idxSku : 0;
    const finalIdxTitle = idxTitle >= 0 ? idxTitle : 1;
    const finalIdxBrand = idxBrand >= 0 ? idxBrand : 3;
    const finalIdxOem = idxOem >= 0 ? idxOem : 18;
    const finalIdxStock = idxStock >= 0 ? idxStock : 19;
    const finalIdxCost = idxCost >= 0 ? idxCost : 25;
    const finalIdxSubcategory = idxSubcategory >= 0 ? idxSubcategory : 4; // Columna 4 en Profit Maestro

    // Helper para normalizar SKUs (Mayúsculas y sin espacios)
    const normalize = (s) => String(s || "").trim().toUpperCase();

    const internalItems = rawRows.slice(headerRowIndex + 1)
      .filter(row => row[finalIdxSku])
      .map(row => ({
        sku: normalize(row[finalIdxSku]),
        title: String(row[finalIdxTitle] || "").trim(),
        price: parseFloat(row[finalIdxCost] || 0),
        cost: parseFloat(row[finalIdxCost] || 0),
        stock: parseFloat(row[finalIdxStock] || 0),
        brand: String(row[finalIdxBrand] || "").trim(),
        oem: String(row[finalIdxOem] || "").trim(),
        subcategory: finalIdxSubcategory >= 0 ? String(row[finalIdxSubcategory] || "").trim().toUpperCase() : null
      }))
      .filter(item => item.sku && item.sku !== "CODIGO");

    if (internalItems.length === 0) {
      return NextResponse.json({ error: "No se encontraron SKUs válidos en el archivo" }, { status: 400 });
    }

    // 4. Guardar/Actualizar inventario interno en Supabase por LOTES (evita timeouts)
    const BATCH_SIZE = 2000;
    for (let i = 0; i < internalItems.length; i += BATCH_SIZE) {
      const batch = internalItems.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabaseAdmin
        .from("internal_inventory")
        .upsert(batch, { onConflict: "sku" });

      if (upsertError) {
        console.error(`Error en lote ${i}-${i + BATCH_SIZE}:`, upsertError);
        throw upsertError;
      }
    }

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
      mode: mode,
      summary: {
        totalExcel: internalItems.length,
        totalML: mlProducts.length,
        matched: matchedMeliIds.size,
        orphansCount: orphans.length,
        missingCount: missing.length,
      },
      orphans: orphans.slice(0, 3000),
      missing: missing.slice(0, 3000),
      timestamp: new Date().toLocaleString()
    };

    // Guardar una "fotografía" separada por modo para no sobreescribir
    try {
      const cachePath = path.join(process.cwd(), `.audit_cache_${mode}_${accountId}.json`);
      fs.writeFileSync(cachePath, JSON.stringify(outputPayload));
    } catch (e) {
      console.warn("No se pudo cachear la auditoría local:", e.message);
    }

    return NextResponse.json(outputPayload);

  } catch (error) {
    console.error("❌ Inventory Upload Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
