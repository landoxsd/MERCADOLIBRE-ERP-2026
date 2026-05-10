import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { supabaseAdmin } from "@/lib/supabase-admin";
import "@/lib/exceljs-patch"; // Parche global

export const maxDuration = 300;

const CONFIG_FALLBACK = {
    FALLBACK_IMAGE_URL: "https://http2.mlstatic.com/D_NQ_NP_927964-MLV111474686141_052026-F.jpg",
    TIPO_PUBLICACION: 'Premium',
    RETIRO_PERSONA: 'Acepto',
    CONDICION: 'Nuevo',
    TIPO_GARANTIA: 'Garantía del vendedor',
    TIEMPO_GARANTIA: '30',
    UNIDAD_GARANTIA: 'días',
    ORIGEN: 'Importado'
};

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

function optimizeSEO(rawTitle) {
    if (!rawTitle) return '';
    let seoTitle = String(rawTitle).toUpperCase();
    const sortedKeys = Object.keys(ABBREVIATIONS).sort((a, b) => b.length - a.length);
    const escapedKeys = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escapedKeys.join('|')})(?=\\.|\\s|$)`, 'gi');
    
    seoTitle = seoTitle.replace(regex, (matched) => {
        const upperMatched = matched.toUpperCase();
        return ABBREVIATIONS[upperMatched] || ABBREVIATIONS[upperMatched + '.'] || matched;
    });

    seoTitle = seoTitle
        .replace(/[,()]/g, " ")
        .replace(/\.([A-Z])/g, " $1")
        .replace(/\./g, " ")
        .replace(/\b(DE|LA|EL|LOS|LAS|CON|PARA|DEL)\b/gi, "")
        .replace(/NUEVO|OFERTA|PROMO|BARATO|ENVIO GRATIS|EXCELENTE|ORIGINAL|REEMPLAZO/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    
    let finalTitle = seoTitle.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    if (finalTitle.length > 60) {
        let truncated = finalTitle.substring(0, 60);
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > 45) truncated = truncated.substring(0, lastSpace);
        return truncated.trim();
    }
    return finalTitle;
}

const DESCRIPTION_FOOTER = `
\n¡BIENVENIDOS A CORPORACION RWC!
-- INFORMACIÓN IMPORTANTE --
* Somos Tienda Física.
* Horario: Lunes a Viernes de 8:30 AM a 5:00 PM.
* Envíos Nacionales GRATIS: MRW, Zoom y Tealca (MercadoEnvíos).
* Por favor verifique disponibilidad antes de ofertar.
¡GRACIAS POR PREFERIRNOS!
`;

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get("file");
        const accountId = formData.get("accountId");

        if (!file || !accountId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

        const bytes = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(Buffer.from(bytes));
        const worksheet = workbook.worksheets.find(ws => ws.name !== 'Ayuda' && ws.name !== 'extra info') || workbook.worksheets[0];

        // --- MATAR EL ERROR B643 AQUÍ ---
        worksheet.eachRow(row => {
            row.eachCell({ includeEmpty: true }, cell => {
                if (cell.formula || cell.sharedFormula || (cell._value && cell._value.sharedFormula)) {
                    const val = cell.value;
                    cell.value = null; // Reset
                    cell.value = val;  // Restaurar solo el valor, sin el fantasma de la fórmula
                    if (cell._value) {
                        delete cell._value.formula;
                        delete cell._value.sharedFormula;
                    }
                }
            });
        });

        // Identificar categoría ML
        let mlCategoryName = "";
        const cellA1 = worksheet.getCell('A1').value;
        const cellB1 = worksheet.getCell('B1').value;

        if (cellA1 && typeof cellA1 === 'string') mlCategoryName = cellA1.trim();
        else if (cellB1 && typeof cellB1 === 'string') {
             const parts = cellB1.split(' > ');
             mlCategoryName = parts[parts.length - 1].trim();
        }

        if (!mlCategoryName) return NextResponse.json({ error: "Categoría no detectada" }, { status: 400 });

        // Mapeos y Paginación
        const { data: mappings } = await supabaseAdmin.from('category_mappings').select('internal_name').eq('ml_category_name', mlCategoryName);
        if (!mappings || mappings.length === 0) return NextResponse.json({ error: `No hay mapeos para ${mlCategoryName}` }, { status: 400 });
        const sublineNames = mappings.map(m => m.internal_name.toUpperCase());

        const publishedSet = new Set();
        let offset = 0, limit = 1000, hasMore = true;
        while (hasMore) {
            const { data } = await supabaseAdmin.from('products').select('sku').eq('meli_account_id', accountId).range(offset, offset + limit - 1);
            if (data && data.length > 0) {
                data.forEach(p => String(p.sku || "").split(/[, /]+/).forEach(s => publishedSet.add(s.trim().toUpperCase())));
                offset += limit;
                if (data.length < limit) hasMore = false;
            } else hasMore = false;
        }

        const { data: items } = await supabaseAdmin.from('internal_inventory').select('*').in('subcategory', sublineNames).gt('stock', 0);
        const missingItems = (items || []).filter(item => !publishedSet.has(String(item.sku || "").trim().toUpperCase()));
        if (missingItems.length === 0) return NextResponse.json({ error: "Sin productos nuevos para esta categoría" }, { status: 400 });

        // Fotos
        const allSkus = missingItems.map(i => i.sku);
        const { data: photoData } = await supabaseAdmin.from('image_bank').select('sku, ml_url, ml_picture_id').in('sku', allSkus).eq('sync_status', 'synced');
        const photoMap = {};
        photoData?.forEach(p => {
            if (!photoMap[p.sku]) photoMap[p.sku] = [];
            const url = p.ml_url || (p.ml_picture_id ? `https://http2.mlstatic.com/D_${p.ml_picture_id}-O.jpg` : null);
            if (url) photoMap[p.sku].push(url);
        });

        const headerRow = worksheet.getRow(3);
        const columns = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            columns.push({ name: String(cell.value || "").toLowerCase(), index: colNumber });
        });

        let currentRow = 5;
        for (const item of missingItems) {
            const row = worksheet.getRow(currentRow);
            let photos = (photoMap[item.sku] || []).join(',');
            if (!photos) photos = CONFIG_FALLBACK.FALLBACK_IMAGE_URL;

            columns.forEach(col => {
                const header = col.name;
                const cell = row.getCell(col.index);

                if (header.includes('precio por zona') || header.includes('región')) {
                    cell.value = null; return;
                }

                if (header === 'título' || header.includes('título: incluye')) cell.value = optimizeSEO(item.title);
                else if (header === 'sku' || header.includes('sku / código')) cell.value = item.sku;
                else if (header === 'stock' || header.includes('cantidad')) cell.value = item.stock;
                else if (header === 'precio' || header.includes('precio [us$]')) cell.value = item.price;
                else if (header === 'fotos' || header.includes('fotos (url)')) cell.value = photos;
                else if (header === 'descripción') {
                    cell.value = `Producto Original. SKU: ${item.sku}. OEM: ${item.oem || 'N/A'}.\n\nAplicación: ${item.title}` + DESCRIPTION_FOOTER;
                }
                else if (header === 'condición') cell.value = CONFIG_FALLBACK.CONDICION;
                else if (header === 'marca') cell.value = item.brand || 'Genérico';
                else if (header === 'número de pieza') cell.value = item.oem || item.sku;
                else if (header.includes('tipo de publicación')) cell.value = CONFIG_FALLBACK.TIPO_PUBLICACION;
                else if (header.includes('forma de envío')) cell.value = 'Mercado Envíos';
                else if (header.includes('costo de envío')) cell.value = 'Envío gratis';
                else if (header.includes('retiro en persona')) cell.value = CONFIG_FALLBACK.RETIRO_PERSONA;
                else if (header.includes('tipo de garantía')) cell.value = CONFIG_FALLBACK.TIPO_GARANTIA;
                else if (header.includes('tiempo de garantía')) cell.value = CONFIG_FALLBACK.TIEMPO_GARANTIA;
                else if (header.includes('unidad de tiempo de garantía')) cell.value = CONFIG_FALLBACK.UNIDAD_GARANTIA;
                else if (header === 'origen') cell.value = CONFIG_FALLBACK.ORIGEN;
            });
            row.commit();
            currentRow++;
        }

        const totalRows = worksheet.rowCount;
        if (totalRows >= currentRow) {
            for (let i = currentRow; i <= totalRows; i++) {
                const row = worksheet.getRow(i);
                row.eachCell({ includeEmpty: true }, (cell) => {
                    cell.value = null;
                    if (cell._value) {
                        delete cell._value.formula;
                        delete cell._value.sharedFormula;
                    }
                });
            }
            worksheet.spliceRows(currentRow, totalRows - currentRow + 1);
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${file.name}"`,
            },
        });
    } catch (error) {
        console.error('❌ Fill Template Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
