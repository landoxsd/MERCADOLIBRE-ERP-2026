const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_KEY } = require('./load-env');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. MONKEY PATCH CRÍTICO PARA EXCELJS (Evita corrupción de fórmulas)
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
    console.error("⚠️ Error aplicando parche crítico:", e.message);
}

// --- CARGA DE CONFIGURACIÓN EXTERNA ---
let CONFIG = {
    DESCRIPTION_TEMPLATE: "¡BIENVENIDOS!\n\nPRODUCTO: {PRODUCTO}\nOEM: {OEM}",
    TIPO_PUBLICACION: 'Clásica',
    RETIRO_PERSONA: 'Acepto',
    CONDICION: 'Nuevo',
    TIPO_GARANTIA: 'Garantía del vendedor',
    TIEMPO_GARANTIA: '30',
    UNIDAD_GARANTIA: 'días',
    ORIGEN: 'Importado',
    FALLBACK_IMAGE_URL: ''
};

try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
        const externalConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        CONFIG = { ...CONFIG, ...externalConfig };
        console.log("⚙️  Configuración externa cargada desde config.json");
    }
} catch (e) {
    console.error("⚠️ Error cargando config.json, usando valores por defecto:", e.message);
}

const ABBREVIATIONS = {
    'AMORT.': 'AMORTIGUADOR', 'AMORT': 'AMORTIGUADOR',
    'DEL.': 'DELANTERO', 'DEL': 'DELANTERO', 'DELT.': 'DELANTERO', 'DELT': 'DELANTERO',
    'TRAS.': 'TRASERO', 'TRAS': 'TRASERO', 'TRST.': 'TRASERO', 'TRST': 'TRASERO',
    'IZQ.': 'IZQUIERDO', 'IZQ': 'IZQUIERDO',
    'DER.': 'DERECHO', 'DER': 'DERECHO',
    'SUP.': 'SUPERIOR', 'SUP': 'SUPERIOR',
    'INF.': 'INFERIOR', 'INF': 'INFERIOR',
    'PAST.': 'PASTILLAS', 'PAST': 'PASTILLAS',
    'BOMB.': 'BOMBA', 'BOMB': 'BOMBA',
    'BUJ.': 'BUJE', 'BUJ': 'BUJE',
    'ROT.': 'ROTULA', 'ROT': 'ROTULA',
    'TERM.': 'TERMINAL', 'TERM': 'TERMINAL',
    'KIT.': 'KIT', 'KIT': 'KIT',
    'EMP.': 'EMPACADURA', 'EMP': 'EMPACADURA',
    'ESTOP.': 'ESTOPERA', 'ESTOP': 'ESTOPERA',
    'ROD.': 'RODAMIENTO', 'ROD': 'RODAMIENTO',
    'FILT.': 'FILTRO', 'FILT': 'FILTRO',
    'VALV.': 'VALVULA', 'VALV': 'VALVULA',
    'CHEV.': 'CHEVROLET', 'CHEV': 'CHEVROLET', 'CHEVY': 'CHEVROLET',
    'TOY.': 'TOYOTA', 'TOY': 'TOYOTA',
    'MIT.': 'MITSUBISHI', 'MIT': 'MITSUBISHI',
    'HYU.': 'HYUNDAI', 'HYU': 'HYUNDAI',
    'FOR.': 'FORD', 'FOR': 'FORD',
    'MAZ.': 'MAZDA', 'MAZ': 'MAZDA',
    'REN.': 'RENAULT', 'REN': 'RENAULT',
    'CIL.': 'CILINDRO', 'CIL': 'CILINDRO',
    'MULT.': 'MULTIPLE', 'MULT': 'MULTIPLE',
    'CREM.': 'CREMALLERA', 'CREM': 'CREMALLERA'
};

function generateSEO(rawTitle) {
    if (!rawTitle) return '';
    let seoTitle = String(rawTitle).toUpperCase();
    
    // Aplicar diccionario de abreviaturas
    const sortedKeys = Object.keys(ABBREVIATIONS).sort((a, b) => b.length - a.length);
    const escapedKeys = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escapedKeys.join('|')})(?=\\.|\\s|$)`, 'gi');
    
    seoTitle = seoTitle.replace(regex, (matched) => {
        const upperMatched = matched.toUpperCase();
        return ABBREVIATIONS[upperMatched] || ABBREVIATIONS[upperMatched + '.'] || matched;
    });

    // Limpieza profunda
    seoTitle = seoTitle
        .replace(/[,()]/g, " ")
        .replace(/\.([A-Z])/g, " $1")
        .replace(/\./g, " ")
        .replace(/\b(DE|LA|EL|LOS|LAS|CON|PARA|DEL)\b/gi, "")
        .replace(/NUEVO|OFERTA|PROMO|BARATO|ENVIO GRATIS|EXCELENTE|GARANTIZADO|ORIGINAL|REEMPLAZO/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    
    // Capitalización (Title Case)
    let finalTitle = seoTitle.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

    // Recorte inteligente a 60 caracteres
    if (finalTitle.length > 60) {
        let truncated = finalTitle.substring(0, 60);
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > 45) {
            truncated = truncated.substring(0, lastSpace);
        }
        return truncated.trim();
    }

    return finalTitle;
}

// Función para detectar columnas en el Excel de Profit
function detectProfitColumns(rows) {
    const colMap = { sku: -1, description: -1, price: -1, stock: -1, oem: -1, brand: -1 };
    let headerRowIdx = -1;

    for (let i = 0; i < Math.min(rows.length, 30); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row)) continue;
        
        const rowStr = row.map(c => String(c || '').toUpperCase()).join('|');
        if (rowStr.includes('CODIGO') && rowStr.includes('DESCRIPCION')) {
            headerRowIdx = i;
            row.forEach((cell, idx) => {
                const val = String(cell || '').toUpperCase().trim();
                if (val === 'CODIGO') colMap.sku = idx;
                if (val === 'DESCRIPCION') colMap.description = idx;
                if (val === 'STOCK' || val === 'EXISTENCIA') colMap.stock = idx;
                if (val === 'COSTO' || val === 'CAMPO4' || val === 'PRECIO') colMap.price = idx;
                if (val === 'REF' || val === 'CAMPO7' || val === 'ORIGINAL') colMap.oem = idx;
                if (val === 'CO CATEGORIA' || val === 'MARCA') colMap.brand = idx;
            });
            break;
        }
    }

    return { headerRowIdx, colMap };
}

async function run() {
    console.log("\n==========================================");
    console.log("   ML DESKTOP PUBLISHER PRO - V2.1 ");
    console.log("   Advanced Logistics & Config Edition ");
    console.log("==========================================\n");

    try {
        console.log("☁️  Conectando con Supabase...");
        let allPublishedSkus = new Set();
        let photoMap = {};
        let oemMap = {};
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        // 1. Obtener productos ya publicados
        while (hasMore) {
            const { data, error } = await supabase.from('products').select('sku, raw_data').range(offset, offset + limit - 1);
            if (error) throw error;
            if (!data || data.length === 0) hasMore = false;
            else {
                data.forEach(p => {
                    if (p.sku) {
                        const sku = String(p.sku).trim().toUpperCase();
                        allPublishedSkus.add(sku);
                        if (p.raw_data && p.raw_data.attributes) {
                            const oemAttr = p.raw_data.attributes.find(a => a.id === 'PART_NUMBER' || a.id === 'OEM');
                            if (oemAttr) oemMap[sku] = oemAttr.value_name;
                        }
                    }
                });
                offset += limit;
                if (data.length < limit) hasMore = false;
            }
        }

        // 2. Obtener banco de imágenes
        console.log("🖼️  Sincronizando Banco de Imágenes...");
        offset = 0;
        hasMore = true;
        while (hasMore) {
            const { data, error } = await supabase.from('image_bank').select('sku, ml_picture_id, ml_url').eq('sync_status', 'synced').range(offset, offset + limit - 1);
            if (error) throw error;
            if (!data || data.length === 0) hasMore = false;
            else {
                data.forEach(img => {
                    const sku = String(img.sku).trim().toUpperCase();
                    if (!photoMap[sku]) photoMap[sku] = [];
                    const url = img.ml_url || (img.ml_picture_id ? `https://http2.mlstatic.com/D_${img.ml_picture_id}-O.jpg` : null);
                    if (url) photoMap[sku].push(url);
                });
                offset += limit;
                if (data.length < limit) hasMore = false;
            }
        }

        const inputProfitDir = path.join(__dirname, 'Input_Profit');
        const inputTemplateDir = path.join(__dirname, 'Input_Template');
        const outputDir = path.join(__dirname, 'Output');

        const profitFiles = fs.readdirSync(inputProfitDir).filter(f => f.endsWith('.xlsx'));
        const templateFiles = fs.readdirSync(inputTemplateDir).filter(f => f.endsWith('.xlsx'));

        if (profitFiles.length === 0) throw new Error("No se encontró archivo de Profit en Input_Profit");
        if (templateFiles.length === 0) throw new Error("No se encontró plantilla en Input_Template");

        const profitFile = path.join(inputProfitDir, profitFiles[0]);
        const templateFile = path.join(inputTemplateDir, templateFiles[0]);

        console.log(`📄 Procesando Profit: ${profitFiles[0]}`);
        const profitBuffer = fs.readFileSync(profitFile);
        const profitWb = xlsx.read(profitBuffer);
        const profitSheet = profitWb.Sheets[profitWb.SheetNames[0]];
        const profitRows = xlsx.utils.sheet_to_json(profitSheet, {header: 1});

        // Detección de columnas Profit
        const { headerRowIdx, colMap } = detectProfitColumns(profitRows);
        if (headerRowIdx === -1 || colMap.sku === -1) {
            throw new Error("No se pudo detectar la estructura de columnas en el archivo de Profit. Asegúrese de tener una fila con 'CODIGO' y 'DESCRIPCION'.");
        }

        console.log(`✅ Estructura Profit detectada en fila ${headerRowIdx + 1}`);
        console.log(`📊 Mapeo: SKU(${colMap.sku}), Desc(${colMap.description}), Stock(${colMap.stock}), Precio(${colMap.price})`);

        const rawItems = profitRows.slice(headerRowIdx + 1).filter(row => row[colMap.sku]);
        const filteredItems = rawItems.filter(row => {
            const sku = String(row[colMap.sku] || '').trim().toUpperCase();
            return !allPublishedSkus.has(sku);
        });

        console.log(`\n🔍 Resumen de Filtro:`);
        console.log(`   - Total ítems en Profit: ${rawItems.length}`);
        console.log(`   - Ya publicados (omitidos): ${rawItems.length - filteredItems.length}`);
        console.log(`   - Pendientes por publicar: ${filteredItems.length}`);

        if (filteredItems.length === 0) {
            console.log("\n⚠️  No hay ítems nuevos para procesar. Saliendo...");
            process.exit(0);
        }

        console.log("\n📂 Abriendo plantilla de Mercado Libre...");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templateFile);
        const worksheet = workbook.worksheets.find(ws => ws.name !== 'Ayuda' && ws.name !== 'extra info');

        // Detección de cabeceras en plantilla ML
        let mlHeaderRowIdx = 4;
        let mlColumns = [];
        for (let i = 1; i <= 6; i++) {
            const row = worksheet.getRow(i);
            let isHeader = false;
            row.eachCell((cell) => {
                const val = String(cell.value || '').toLowerCase();
                if (val.includes('sku') || val.includes('título')) isHeader = true;
            });
            if (isHeader) {
                mlHeaderRowIdx = i;
                break;
            }
        }
        
        const mlHeaderRow = worksheet.getRow(mlHeaderRowIdx);
        mlHeaderRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const name = String(cell.value || '').toLowerCase();
            if (name) mlColumns.push({ name, index: colNumber });
        });

        // Rellenado de datos
        let currentRow = 9; 
        let processedCount = 0;

        for (const item of filteredItems) {
            const row = worksheet.getRow(currentRow);
            
            const sku = String(item[colMap.sku] || '').trim();
            const skuUpper = sku.toUpperCase();
            const descrip = String(item[colMap.description] || '');
            const price = item[colMap.price] || 0;
            const stock = item[colMap.stock] || 0;
            const oem = oemMap[skuUpper] || item[colMap.oem] || '';
            const brand = item[colMap.brand] || 'Genérico';
            let photos = (photoMap[skuUpper] || []).join(',');

            if (!photos && CONFIG.FALLBACK_IMAGE_URL) {
                photos = CONFIG.FALLBACK_IMAGE_URL;
            }

            mlColumns.forEach(col => {
                const header = col.name;
                const colIdx = col.index;
                const cell = row.getCell(colIdx);
                
                // Limpieza preventiva: Si es una columna de precio por zona, dejar vacía
                if (header.includes('precio por zona') || header.includes('región')) {
                    cell.value = null;
                    return;
                }

                if (header === 'título' || header.includes('título:')) {
                    cell.value = generateSEO(descrip);
                }
                else if (header === 'sku') {
                    cell.value = sku;
                }
                else if (header === 'stock') {
                    cell.value = stock;
                }
                else if (header.startsWith('precio') && !header.includes('zona')) {
                    cell.value = price;
                }
                else if (header === 'condición') {
                    cell.value = CONFIG.CONDICION;
                }
                else if (header === 'marca') {
                    cell.value = brand;
                }
                else if (header === 'número de pieza') {
                    cell.value = oem || sku;
                }
                else if (header === 'fotos') {
                    cell.value = photos;
                }
                else if (header === 'descripción') {
                    cell.value = CONFIG.DESCRIPTION_TEMPLATE
                        .replace('{PRODUCTO}', descrip)
                        .replace('{OEM}', oem || sku);
                }
                else if (header === 'tipo de publicación') {
                    cell.value = CONFIG.TIPO_PUBLICACION;
                }
                else if (header === 'retiro en persona') {
                    cell.value = CONFIG.RETIRO_PERSONA;
                }
                else if (header === 'tipo de garantía') {
                    cell.value = CONFIG.TIPO_GARANTIA;
                }
                else if (header === 'tiempo de garantía') {
                    cell.value = CONFIG.TIEMPO_GARANTIA;
                }
                else if (header === 'unidad de tiempo de garantía') {
                    cell.value = CONFIG.UNIDAD_GARANTIA;
                }
                else if (header === 'origen') {
                    cell.value = CONFIG.ORIGEN;
                }
            });
            
            row.commit();
            currentRow++;
            processedCount++;
            if (processedCount % 100 === 0) console.log(`... Procesados ${processedCount} de ${filteredItems.length}`);
        }

        // Limpiar filas sobrantes de la plantilla
        const totalRows = worksheet.rowCount;
        if (totalRows >= currentRow) {
            worksheet.spliceRows(currentRow, totalRows - currentRow + 1);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
        const outputName = `PLANTILLA_LISTA_${timestamp}_${processedCount}_items.xlsx`;
        const outputPath = path.join(outputDir, outputName);

        console.log("\n💾 Guardando archivo final...");
        await workbook.xlsx.writeFile(outputPath);
        
        console.log("\n✨ ¡ÉXITO TOTAL! ✨");
        console.log(`📍 Archivo generado: Output/${outputName}`);
        console.log(`📝 Ítems procesados: ${processedCount}`);
        console.log("==========================================\n");

    } catch (err) {
        console.error("\n💥 ERROR CRÍTICO:", err.message);
    }
}

run();
