const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// 1. MONKEY PATCH EXACTAMENTE COMO EN LA API
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
} catch (e) {}

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
        clean = clean.replace(regex, '');
    });
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean.substring(0, 60);
}

async function runRealLocalTest() {
    console.log("🚀 Generando ARCHIVO REAL con lógica de producción...");
    
    try {
        const profitBuffer = fs.readFileSync('AMORTIGUADORES07052026.xlsx');
        const templateBuffer = fs.readFileSync('AMORTIGUADOR1.xlsx');
        
        const profitWb = xlsx.read(profitBuffer);
        const profitSheet = profitWb.Sheets[profitWb.SheetNames[0]];
        const profitRows = xlsx.utils.sheet_to_json(profitSheet, {header: 1});
        
        // Buscar la fila de cabecera real o la primera fila con datos útiles
        // En este reporte parece que los datos útiles empiezan donde la col 0 tiene un código numérico
        const dataStartIdx = profitRows.findIndex(row => row[0] && !isNaN(row[0]) && String(row[0]).length > 2);
        const internalItems = profitRows.slice(dataStartIdx).filter(row => row[0]);

        console.log(`📊 Ítems detectados: ${internalItems.length}`);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(templateBuffer);
        const worksheet = workbook.worksheets.find(ws => ws.name !== 'Ayuda' && ws.name !== 'extra info');

        const headerRow = worksheet.getRow(3);
        const columns = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            columns.push({ name: String(cell.value || '').toLowerCase(), index: colNumber });
        });

        let currentRow = 5;
        for (const item of internalItems) {
            const row = worksheet.getRow(currentRow);
            
            // Mapeo manual basado en la estructura del reporte Profit
            const sku = String(item[0] || '');
            const descrip = String(item[1] || '');
            const price = item[15] || 0;
            const stock = item[9] || 0;
            const oem = item[18] || '';
            const brand = item[3] || 'Genérico';

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
            });
            
            row.commit();
            currentRow++;
            if (currentRow > 2005) break; 
        }

        const totalRows = worksheet.rowCount;
        if (totalRows >= currentRow) {
            worksheet.spliceRows(currentRow, totalRows - currentRow + 1);
        }

        const finalBuffer = await workbook.xlsx.writeBuffer();
        fs.writeFileSync('PLANTILLA_REAL_AMORTIGUADORES.xlsx', finalBuffer);
        console.log(`✨ ARCHIVO REAL GENERADO: PLANTILLA_REAL_AMORTIGUADORES.xlsx (${finalBuffer.length} bytes)`);

    } catch (err) {
        console.error("💥 ERROR:", err.message);
    }
}

runRealLocalTest();
