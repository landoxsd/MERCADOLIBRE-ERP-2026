const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// 1. APLICAR EL MONKEY PATCH (IGUAL QUE EN LA API)
try {
    const CellXform = require('exceljs/lib/xlsx/xform/sheet/cell-xform.js');
    if (CellXform && CellXform.prototype && CellXform.prototype.render) {
        const originalRender = CellXform.prototype.render;
        CellXform.prototype.render = function(xmlStream, model, options) {
            if (model.sharedFormula) {
                const formulae = options.formulae || {};
                const master = formulae[model.sharedFormula];
                if (!master) {
                    // Silenciamos el error desvinculando el clon huérfano
                    delete model.sharedFormula;
                }
            }
            return originalRender.call(this, xmlStream, model, options);
        };
        console.log("✅ Monkey-patch aplicado con éxito.");
    }
} catch (e) {
    console.error("❌ Error aplicando el parche:", e);
}

async function runLocalTest() {
    console.log("🚀 Iniciando prueba local con archivos reales...");
    
    try {
        // Cargar archivos
        const profitBuffer = fs.readFileSync('AMORTIGUADORES07052026.xlsx');
        const templateBuffer = fs.readFileSync('AMORTIGUADOR1.xlsx');
        
        // Leer Profit usando xlsx (como en la API)
        const profitWb = xlsx.read(profitBuffer);
        const profitSheet = profitWb.Sheets[profitWb.SheetNames[0]];
        const profitData = xlsx.utils.sheet_to_json(profitSheet);
        console.log(`📊 Datos de Profit leídos: ${profitData.length} filas.`);

        // Cargar Plantilla ML usando ExcelJS
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(templateBuffer);
        const worksheet = workbook.worksheets.find(ws => ws.name !== 'Ayuda' && ws.name !== 'extra info');
        
        if (!worksheet) {
            throw new Error("No se encontró la hoja de datos en la plantilla de ML.");
        }

        // Detectar Cabeceras (Fila 3)
        const headerRow = worksheet.getRow(3);
        const columns = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            columns.push({ name: String(cell.value || '').toLowerCase(), index: colNumber });
        });

        // Simular el rellenado
        let currentRow = 5;
        for (const item of profitData) {
            const row = worksheet.getRow(currentRow);
            
            // Mapeo básico para verificar escritura
            columns.forEach(col => {
                const header = col.name;
                const colIdx = col.index;
                
                if (header.includes('título')) row.getCell(colIdx).value = "PRUEBA LOCAL SEO " + (item.DESCRIP || '');
                else if (header.includes('sku')) row.getCell(colIdx).value = String(item.COD_ART || '');
                else if (header.includes('precio')) row.getCell(colIdx).value = 100; // Precio dummy
            });
            
            row.commit();
            currentRow++;
        }

        console.log(`✍️ Escritura completada hasta fila ${currentRow - 1}.`);

        // Splicing (El que tenemos en la API ahora)
        const totalRows = worksheet.rowCount;
        console.log(`📏 Filas totales en plantilla: ${totalRows}.`);
        if (totalRows >= currentRow) {
            console.log(`✂️ Splicing desde fila ${currentRow} hasta ${totalRows}...`);
            worksheet.spliceRows(currentRow, totalRows - currentRow + 1);
        }

        // EL MOMENTO DE LA VERDAD: writeBuffer
        console.log("💾 Generando buffer final (aquí es donde fallaba antes)...");
        const finalBuffer = await workbook.xlsx.writeBuffer();
        
        fs.writeFileSync('PRUEBA_LOCAL_RESULTADO.xlsx', finalBuffer);
        console.log(`✨ ¡ÉXITO! Archivo generado: PRUEBA_LOCAL_RESULTADO.xlsx (${finalBuffer.length} bytes)`);

    } catch (err) {
        console.error("💥 ERROR DURANTE LA PRUEBA:", err.message);
        if (err.stack) console.error(err.stack);
    }
}

runLocalTest();
