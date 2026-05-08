
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const maxDuration = 300;

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

const VEHICLE_MODELS = [
    'FIESTA', 'ECOSPORT', 'AVEO', 'CORSA', 'VITARA', 'OPTRA', 'SPARK', 'CRUZE', 'ORLANDO', 
    'LUV DMAX', 'D-MAX', 'KADETT', 'MONZA', 'SILVERADO', 'TAHOE', 'GRAND VITARA', 'SWIFT', 
    'ESTEEM', 'JIMNY', 'SAMURAI', 'EXPLORER', 'FOCUS', 'FUSION', 'RANGER', 'TRITON', 'HILUX',
    'COROLLA', 'YARIS', 'FORTUNER', 'CELICA', 'CAMRY', 'TERIOS', 'MERU', 'PRADO', 'BORA', 'GOL',
    'JETTA', 'PASSAT', 'TIGUAN', 'POLO', 'AMAROK', 'SENTRA', 'TIIDA', 'ALMERA', 'FRONTIER', 
    'PATHFINDER', 'PATROL', 'XTERRA', 'CIVIC', 'ACCORD', 'FIT', 'CRV', 'ODYSSEY', 'PILOT',
    'TUCSON', 'SANTA FE', 'ELANTRA', 'GETZ', 'ACCENT', 'SPORTAGE', 'RIO', 'PICANTO', 'SORENTO',
    'CERATO', 'K2700', 'CANTER', 'L300', 'L200', 'MONTERO', 'DAKAR', 'SIGNUM', 'LANCER',
    'LOGAN', 'SYMBOL', 'MEGANE', 'KANGOO', 'TWINGO', 'CLIO', 'DUSTER', 'SANDERO', 'CAPTUR',
    'GRAN CHEROKEE', 'CHEROKEE', 'LIBERTY', 'WRANGLER', 'WAGONEER', 'COMPASS', 'RENEGADE',
    'GRAND WAGONEER', 'COMMANDER', 'CALIBER', 'JOURNEY', 'RAM', 'DAKOTA', 'NEON', 'STRATUS',
    'BLAZER', 'S10', 'TRAILBLAZER', 'ASTRA', 'MERIVA', 'MONTANA', 'ZAFIRA', 'IMPALA', 'MALIBU',
    'COLORADO', 'CAPRICE', 'CELEBRITY', 'CAVALIER', 'CHEVETTE', 'KODIAK', 'NHR', 'NPR', 'NKR',
    'FVR', 'EXPRESS', 'VENTURE', 'LUMINA', 'MONTE CARLO', 'LEBARON', 'ASPEN', 'ENCAVA', 'IVECO',
    'MACK', 'SCANIA', 'VOLVO', 'FREIGHTLINER', 'INTERNATIONAL', 'PATRIOT', 'KA', 'WAGON R', 
    'TICO', 'NUBIRA', 'STARLET', 'TERCEL', 'BALITA', 'LASER', 'ALLEGRO', 'ACCORD', 'CIVIC'
];

function optimizeSEO(title) {
    if (!title) return '';
    let seoTitle = String(title).toUpperCase();
    const sortedKeys = Object.keys(ABBREVIATIONS).sort((a, b) => b.length - a.length);
    const escapedKeys = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escapedKeys.join('|')})(?=\\.|\\s|$)`, 'gi');
    
    seoTitle = seoTitle.replace(regex, (matched) => {
        const upperMatched = matched.toUpperCase();
        return ABBREVIATIONS[upperMatched] || ABBREVIATIONS[upperMatched + '.'] || matched;
    });

    seoTitle = seoTitle
        .replace(/[,().]/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\b(DE|LA|EL|LOS|LAS|CON|PARA|DEL)\b/gi, "")
        .replace(/NUEVO|OFERTA|PROMO|BARATO|ENVIO GRATIS|EXCELENTE/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    
    return seoTitle.substring(0, 60).trim();
}

function getSplitTitles(rawTitle) {
    if (!rawTitle) return [];
    const cleanTitle = String(rawTitle).toUpperCase().replace(/[,().]/g, " ").replace(/\s+/g, " ").trim();
    let findings = [];
    VEHICLE_MODELS.forEach(model => {
        let pos = cleanTitle.indexOf(model);
        while (pos !== -1) {
            const isStart = pos === 0 || cleanTitle[pos-1] === ' ';
            const isEnd = pos + model.length === cleanTitle.length || cleanTitle[pos + model.length] === ' ';
            if (isStart && isEnd) findings.push({ model, pos });
            pos = cleanTitle.indexOf(model, pos + 1);
        }
    });
    findings = findings.filter(f => !findings.some(other => other !== f && other.pos <= f.pos && (other.pos + other.model.length) >= (f.pos + f.model.length) && other.model.length > f.model.length));
    findings.sort((a, b) => a.pos - b.pos);
    if (findings.length <= 1) return [rawTitle];

    const prefix = cleanTitle.substring(0, findings[0].pos).trim();
    let segments = [];
    for (let i = 0; i < findings.length; i++) {
        const start = findings[i].pos;
        const end = (i + 1 < findings.length) ? findings[i+1].pos : cleanTitle.length;
        segments.push(cleanTitle.substring(start, end).trim());
    }
    return segments.map(seg => `${prefix} ${seg}`.trim());
}

const DESCRIPTION_FOOTER = `
--------------------------------------------------
🏢 TIENDA OFICIAL - CALIDAD GARANTIZADA
--------------------------------------------------
✅ PRODUCTO 100% ORIGINAL Y NUEVO
✅ FACTURA FISCAL DISPONIBLE
✅ ENVIOS GRATIS A TODO EL PAIS (MRW, ZOOM, TEALCA)
✅ RETIRO EN PERSONA (VALENCIA / CARACAS)

⚠️ IMPORTANTE: 
Por favor verifique la compatibilidad con su vehículo antes de ofertar. 
Realice todas sus preguntas, estamos para servirle.
`;

export async function POST(req) {
    try {
        const formData = await req.formData();
        const profitFile = formData.get("profitFile");
        const templateFile = formData.get("templateFile");
        const accountId = formData.get("accountId");

        if (!profitFile || !templateFile || !accountId) return NextResponse.json({ error: "Faltan archivos o cuenta" }, { status: 400 });

        // 1. Leer Listado de Profit (Búsqueda robusta de cabeceras)
        const profitBytes = await profitFile.arrayBuffer();
        const profitWb = XLSX.read(profitBytes, { type: "buffer" });
        const profitSheet = profitWb.Sheets[profitWb.SheetNames[0]];
        const rawProfitRows = XLSX.utils.sheet_to_json(profitSheet, { header: 1 });

        let headerRowIndex = -1;
        let skuIdx = -1, stockIdx = -1, priceIdx = -1;

        // Buscar la fila de cabecera en las primeras 30 filas
        for (let i = 0; i < Math.min(rawProfitRows.length, 30); i++) {
            const row = rawProfitRows[i];
            if (!row || !Array.isArray(row)) continue;
            
            const sIdx = row.findIndex(c => {
                const val = String(c || "").toUpperCase();
                return val === "CODIGO" || val === "CÓDIGO" || val === "SKU" || val.includes("COD_ART");
            });

            if (sIdx !== -1) {
                headerRowIndex = i;
                skuIdx = sIdx;
                // Buscar stock y precio en la misma fila
                stockIdx = row.findIndex(c => {
                    const val = String(c || "").toUpperCase();
                    return val.includes("STOCK") || val.includes("EXISTENCIA") || val.includes("CANT");
                });
                priceIdx = row.findIndex(c => {
                    const val = String(c || "").toUpperCase();
                    return val.includes("PRECIO") || val.includes("VENTA") || val.includes("COSTO") || val.includes("P.VENTA");
                });
                break;
            }
        }

        if (headerRowIndex === -1 || skuIdx === -1) {
            return NextResponse.json({ error: "No se encontró columna de SKU/CODIGO en el archivo de Profit. Asegúrate de que el listado tenga una fila con estos títulos." }, { status: 400 });
        }

        const profitDataMap = {};
        for (let i = headerRowIndex + 1; i < rawProfitRows.length; i++) {
            const row = rawProfitRows[i];
            if (!row || row.length === 0) continue;
            
            const sku = String(row[skuIdx] || "").trim().toUpperCase();
            if (sku && sku !== "NULL") {
                profitDataMap[sku] = {
                    sku,
                    stock: stockIdx !== -1 ? parseFloat(row[stockIdx] || 0) : 0,
                    price: priceIdx !== -1 ? parseFloat(row[priceIdx] || 0) : 0
                };
            }
        }

        const profitSkus = Object.keys(profitDataMap);

        // 2. Filtrar SKUs ya publicados en ML (Extracción con paginación)
        const publishedSet = new Set();
        let hasMore = true;
        let offset = 0;
        const limit = 1000;
        
        while (hasMore) {
            const { data: mlProducts } = await supabaseAdmin
                .from('products')
                .select('sku')
                .eq('meli_account_id', accountId)
                .range(offset, offset + limit - 1);
                
            if (mlProducts && mlProducts.length > 0) {
                mlProducts.forEach(p => {
                    String(p.sku || "").split(/[, /]+/).forEach(s => {
                        const c = s.trim().toUpperCase();
                        if (c) publishedSet.add(c);
                    });
                });
                offset += limit;
                if (mlProducts.length < limit) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        const skusToPublish = profitSkus.filter(s => !publishedSet.has(s));
        if (skusToPublish.length === 0) return NextResponse.json({ error: "Todos los productos del listado ya están publicados" }, { status: 400 });

        // 3. Obtener Data Técnica (Fotos, OEM, Títulos Originales) de la DB Interna
        const { data: internalItems } = await supabaseAdmin.from('internal_inventory').select('*').in('sku', skusToPublish);
        const { data: photoData } = await supabaseAdmin.from('image_bank').select('sku, ml_url, ml_picture_id').in('sku', skusToPublish).eq('sync_status', 'synced');

        const photoMap = {};
        photoData?.forEach(p => {
            if (!photoMap[p.sku]) photoMap[p.sku] = [];
            const url = p.ml_url || (p.ml_picture_id ? `https://http2.mlstatic.com/D_${p.ml_picture_id}-O.jpg` : null);
            if (url) photoMap[p.sku].push(url);
        });

        // 4. Rellenar Plantilla ML con ExcelJS para preservar formato/fórmulas
        const templateBytes = await templateFile.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(Buffer.from(templateBytes));

        const worksheet = workbook.worksheets.find(ws => ws.name !== 'Ayuda' && ws.name !== 'extra info');
        if (!worksheet) return NextResponse.json({ error: "Plantilla de ML inválida" }, { status: 400 });

        // WORKAROUND CRÍTICO: exceljs falla al guardar plantillas con "Shared Formulas"
        worksheet.eachRow({ includeEmpty: true }, (row) => {
            row.eachCell({ includeEmpty: true }, (cell) => {
                if (cell.type === 6 && cell.sharedFormula) {
                    delete cell.sharedFormula;
                }
            });
        });

        // Detectar Cabeceras (Fila 3)
        const headerRow = worksheet.getRow(3);
        const columns = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            columns.push({ name: String(cell.value || "").toLowerCase(), index: colNumber });
        });

        let currentRow = 5; // ML Data start

        for (const item of internalItems) {
            const profitInfo = profitDataMap[item.sku.toUpperCase()];
            if (!profitInfo) continue;

            const optTitle = optimizeSEO(item.title);
            const row = worksheet.getRow(currentRow);

            columns.forEach(col => {
                const header = col.name;
                const colIdx = col.index;
                if (!header) return;

                if (header === 'título' || header.includes('título: incluye')) row.getCell(colIdx).value = optTitle;
                else if (header === 'sku' || header.includes('sku / código')) row.getCell(colIdx).value = item.sku;
                else if (header === 'stock' || header.includes('cantidad')) row.getCell(colIdx).value = profitInfo.stock;
                else if (header === 'precio' || header.includes('precio [us$]')) row.getCell(colIdx).value = profitInfo.price;
                else if (header === 'fotos' || header.includes('fotos (url)')) row.getCell(colIdx).value = (photoMap[item.sku] || []).join(',');
                else if (header === 'descripción') {
                    row.getCell(colIdx).value = `Producto Original. \nSKU: ${item.sku}. \nOEM: ${item.oem || 'N/A'}. \nMarca: ${item.brand || 'Genérico'}.\n\nAplicación: ${item.title}` + DESCRIPTION_FOOTER;
                }
                else if (header === 'condición') row.getCell(colIdx).value = 'Nuevo';
                else if (header === 'marca') row.getCell(colIdx).value = item.brand || 'Genérico';
                else if (header === 'número de pieza') row.getCell(colIdx).value = item.oem || item.sku;
                else if (header.includes('tipo de publicación')) row.getCell(colIdx).value = 'Premium';
                else if (header.includes('forma de envío')) row.getCell(colIdx).value = 'Mercado Envíos';
                else if (header.includes('costo de envío')) row.getCell(colIdx).value = 'Envío gratis';
                else if (header.includes('retiro en persona')) row.getCell(colIdx).value = 'Acepto';
                else if (header.includes('tipo de garantía')) row.getCell(colIdx).value = 'Garantía del vendedor';
                else if (header.includes('tiempo de garantía')) row.getCell(colIdx).value = 30;
                else if (header.includes('unidad de tiempo de garantía')) row.getCell(colIdx).value = 'días';
            });
            row.commit();
            currentRow++;
        }

        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="Listado_Relleno_${templateFile.name}"`,
            },
        });

    } catch (error) {
        console.error('❌ Fill Template From List Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
