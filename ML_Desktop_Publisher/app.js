const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// CONFIGURACIÓN DE SUPABASE (Extraída de tu .env.local)
const SUPABASE_URL = "https://zqxesjcchykncxpekmbz.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZMzOEp7m4QlwTUQOqZcmrA_cwu-Yk0U"; // Usamos la key pública por defecto

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. MONKEY PATCH CRÍTICO PARA EXCELJS
try {
    const CellXform = require('exceljs/lib/xlsx/xform/sheet/cell-xform.js');
    if (CellXform && CellXform.prototype && CellXform.prototype.render) {
        const originalRender = CellXform.prototype.render;
        CellXform.prototype.render = function(xmlStream, model, options) {
            if (model.sharedFormula) {
                const formulae = options.formulae || {};
                const master = formulae[model.sharedFormula];
                if (!master) {
                    delete model.sharedFormula;
                }
            }
            return originalRender.call(this, xmlStream, model, options);
        };
    }
} catch (e) {
    console.error("Error aplicando parche crítico:", e.message);
}

const ABBREVIATIONS = {
    "AMORTIGUADOR": "AMORT",
    "DELANTERO": "DEL",
    "DELANTERA": "DEL",
    "TRASERO": "TRAS",
    "TRASERA": "TRAS",
    "IZQUIERDO": "IZQ",
    "IZQUIERDA": "IZQ",
    "DERECHO": "DER",
    "DERECHA": "DER",
    "SUPERIOR": "SUP",
    "INFERIOR": "INF",
    "ARTICULACION": "ARTIC",
    "SUSPENSION": "SUSP",
    "EQUIVALENTE": "EQ"
};

const NOISE_WORDS = ["NUEVO", "ORIGINAL", "REEMPLAZO", "OFERTA", "CALIDAD", "PRECIO"];

function generateSEO(text) {
    if (!text) return "";
    let clean = text.toUpperCase();
    NOISE_WORDS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        clean = clean.replace(regex, '');
    });
    clean = clean.replace(/[.,:;()\-]/g, ' ');
    Object.entries(ABBREVIATIONS).forEach(([full, short]) => {
        const regex = new RegExp(`\\b${full}\\b`, 'g');
        clean = clean.replace(regex, short);
    });
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean.substring(0, 60);
}

async function run() {
    console.log("==========================================");
    console.log("   ML DESKTOP PUBLISHER PRO - BY ANTIGRAVITY ");
    console.log("==========================================");

    try {
        // --- PASO 1: SINCRONIZAR CON LA NUBE ---
        console.log("☁️  Conectando con Supabase para obtener inventario publicado...");
        
        // Paginación para traer todos los productos (18k+)
        let allPublishedSkus = new Set();
        let photoMap = {};
        let oemMap = {};
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            console.log(`... Descargando datos (offset ${offset})`);
            const { data, error } = await supabase
                .from('products')
                .select('sku, photos, oem')
                .range(offset, offset + limit - 1);

            if (error) throw error;
            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                data.forEach(p => {
                    if (p.sku) {
                        allPublishedSkus.add(String(p.sku).trim().toUpperCase());
                        photoMap[String(p.sku).trim().toUpperCase()] = p.photos || [];
                        oemMap[String(p.sku).trim().toUpperCase()] = p.oem || "";
                    }
                });
                offset += limit;
                if (data.length < limit) hasMore = false;
            }
        }
        console.log(`✅ Base de datos sincronizada. ${allPublishedSkus.size} SKUs detectados.`);

        // --- PASO 2: LEER ARCHIVOS LOCALES ---
        const inputProfitDir = path.join(__dirname, 'Input_Profit');
        const inputTemplateDir = path.join(__dirname, 'Input_Template');
        const outputDir = path.join(__dirname, 'Output');

        const profitFiles = fs.readdirSync(inputProfitDir).filter(f => f.endsWith('.xlsx'));
        const templateFiles = fs.readdirSync(inputTemplateDir).filter(f => f.endsWith('.xlsx'));

        if (profitFiles.length === 0 || templateFiles.length === 0) {
            console.log("❌ ERROR: Debes poner al menos un archivo en Input_Profit e Input_Template.");
            process.exit(1);
        }

        const profitFile = path.join(inputProfitDir, profitFiles[0]);
        const templateFile = path.join(inputTemplateDir, templateFiles[0]);

        const profitBuffer = fs.readFileSync(profitFile);
        const profitWb = xlsx.read(profitBuffer);
        const profitSheet = profitWb.Sheets[profitWb.SheetNames[0]];
        const profitRows = xlsx.utils.sheet_to_json(profitSheet, {header: 1});

        const dataStartIdx = profitRows.findIndex(row => row[0] && !isNaN(row[0]) && String(row[0]).length > 2);
        if (dataStartIdx === -1) {
            console.log("❌ ERROR: No se detectaron datos válidos en el archivo de Profit.");
            process.exit(1);
        }
        
        const rawItems = profitRows.slice(dataStartIdx).filter(row => row[0]);
        console.log(`📊 Ítems en Profit: ${rawItems.length}`);

        // --- PASO 3: FILTRAR NO PUBLICADOS ---
        const internalItems = rawItems.filter(row => {
            const sku = String(row[0] || '').trim().toUpperCase();
            return !allPublishedSkus.has(sku);
        });
        console.log(`🎯 Ítems POR PUBLICAR (No están en ML): ${internalItems.length}`);

        if (internalItems.length === 0) {
            console.log("⚠️  Todos los productos ya están publicados. No hay nada que hacer.");
            process.exit(0);
        }

        // --- PASO 4: RELLENAR PLANTILLA ---
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templateFile);
        const worksheet = workbook.worksheets.find(ws => ws.name !== 'Ayuda' && ws.name !== 'extra info');

        const headerRow = worksheet.getRow(3);
        const columns = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            columns.push({ name: String(cell.value || '').toLowerCase(), index: colNumber });
        });

        let currentRow = 5;
        for (const item of internalItems) {
            const row = worksheet.getRow(currentRow);
            
            const sku = String(item[0] || '').trim();
            const skuUpper = sku.toUpperCase();
            const descrip = String(item[1] || '');
            const price = item[15] || 0;
            const stock = item[9] || 0;
            const oem = oemMap[skuUpper] || item[18] || '';
            const brand = item[3] || 'Genérico';
            const photos = (photoMap[skuUpper] || []).join(',');

            columns.forEach(col => {
                const header = col.name;
                const colIdx = col.index;
                
                if (header.includes('título')) row.getCell(colIdx).value = generateSEO(descrip);
                else if (header.includes('sku')) row.getCell(colIdx).value = sku;
                else if (header.includes('stock')) row.getCell(colIdx).value = stock;
                else if (header.includes('precio')) row.getCell(colIdx).value = price;
                else if (header.includes('condición')) row.getCell(colIdx).value = 'Nuevo';
                else if (header.includes('marca')) row.getCell(colIdx).value = brand;
                else if (header.includes('número de pieza')) row.getCell(colIdx).value = oem || sku;
                else if (header.includes('fotos')) row.getCell(colIdx).value = photos;
            });
            
            row.commit();
            currentRow++;
            if (currentRow % 100 === 0) console.log(`... Procesando ${currentRow - 5} items`);
        }

        const totalRows = worksheet.rowCount;
        if (totalRows >= currentRow) {
            worksheet.spliceRows(currentRow, totalRows - currentRow + 1);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputName = `PLANTILLA_RELLENA_${timestamp}.xlsx`;
        const outputPath = path.join(outputDir, outputName);

        console.log("💾 Guardando archivo final...");
        await workbook.xlsx.writeFile(outputPath);
        
        console.log("==========================================");
        console.log("✨ ¡ÉXITO! Archivo generado.");
        console.log(`📝 Total Publicables: ${internalItems.length}`);
        console.log(`📁 Ubicación: Output/${outputName}`);
        console.log("==========================================");

    } catch (err) {
        console.error("💥 ERROR CRÍTICO:", err.message);
    }
}

run();
