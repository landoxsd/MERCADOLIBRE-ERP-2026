
import { NextResponse } from "next/server";
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
    'MACK', 'SCANIA', 'VOLVO', 'FREIGHTLINER', 'INTERNATIONAL'
];

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
        .replace(/[,()]/g, " ")
        .replace(/\.([A-Z])/g, " $1")
        .replace(/\./g, " ")
        .replace(/\b(DE|LA|EL|LOS|LAS|CON|PARA|DEL)\b/gi, "")
        .replace(/NUEVO|OFERTA|PROMO|BARATO|ENVIO GRATIS|EXCELENTE/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    
    return seoTitle.substring(0, 60).trim();
}

function getSplitTitles(rawTitle) {
    if (!rawTitle) return [];
    const cleanTitle = String(rawTitle).toUpperCase().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
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

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get("file");
        const accountId = formData.get("accountId");

        if (!file || !accountId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

        const bytes = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(Buffer.from(bytes));

        const worksheet = workbook.worksheets.find(ws => ws.name !== 'Ayuda' && ws.name !== 'extra info');
        if (!worksheet) return NextResponse.json({ error: "Plantilla inválida" }, { status: 400 });

        // Identificar categoría ML
        let mlCategoryName = "";
        const cellA1 = worksheet.getCell('A1').value;
        const cellB1 = worksheet.getCell('B1').value;

        if (cellA1 && typeof cellA1 === 'string') {
             mlCategoryName = cellA1.trim();
        } else if (cellB1 && typeof cellB1 === 'string') {
             const parts = cellB1.split(' > ');
             mlCategoryName = parts[parts.length - 1].trim();
        }

        if (!mlCategoryName) return NextResponse.json({ error: "Categoría no detectada en A1 o B1" }, { status: 400 });

        // Mapeos
        const { data: mappings } = await supabaseAdmin.from('category_mappings').select('internal_name').eq('ml_category_name', mlCategoryName);
        if (!mappings || mappings.length === 0) return NextResponse.json({ error: `No hay mapeos para ${mlCategoryName}` }, { status: 400 });

        const sublineNames = mappings.map(m => m.internal_name.toUpperCase());

        // SKUs publicados
        const { data: mlProducts } = await supabaseAdmin.from('products').select('sku').eq('meli_account_id', accountId);
        const publishedSet = new Set();
        mlProducts?.forEach(p => {
            String(p.sku || "").split(/[, /]+/).forEach(s => {
                const c = s.trim().toUpperCase();
                if (c) publishedSet.add(c);
            });
        });

        // Productos de Profit
        const { data: items } = await supabaseAdmin.from('internal_inventory').select('*').in('subcategory', sublineNames).gt('stock', 0);
        const missingItems = (items || []).filter(item => !publishedSet.has(String(item.sku || "").trim().toUpperCase()));

        if (missingItems.length === 0) return NextResponse.json({ error: "Sin productos nuevos" }, { status: 400 });

        // Fotos
        const allSkus = missingItems.map(i => i.sku);
        const { data: photoData } = await supabaseAdmin.from('image_bank').select('sku, ml_url, ml_picture_id').in('sku', allSkus).eq('sync_status', 'synced');
        const photoMap = {};
        photoData?.forEach(p => {
            if (!photoMap[p.sku]) photoMap[p.sku] = [];
            const url = p.ml_url || (p.ml_picture_id ? `https://http2.mlstatic.com/D_${p.ml_picture_id}-O.jpg` : null);
            if (url) photoMap[p.sku].push(url);
        });

        // Cabeceras (Fila 3)
        const headerRow = worksheet.getRow(3);
        const headers = [];
        headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            headers[colNumber] = String(cell.value || "").toLowerCase();
        });

        let currentRow = 5; // Empezar a escribir en la fila 5 (ML Data start)

        for (const item of missingItems) {
            const variantTitles = getSplitTitles(item.title);
            for (const vTitle of variantTitles) {
                const optTitle = optimizeSEO(vTitle);
                const row = worksheet.getRow(currentRow);
                
                headers.forEach((header, colIdx) => {
                    if (!header) return;
                    if (header.includes('título')) row.getCell(colIdx).value = optTitle;
                    else if (header.includes('sku')) row.getCell(colIdx).value = item.sku;
                    else if (header.includes('stock')) row.getCell(colIdx).value = item.stock;
                    else if (header.includes('precio')) row.getCell(colIdx).value = item.price;
                    else if (header.includes('fotos')) row.getCell(colIdx).value = (photoMap[item.sku] || []).join(',');
                    else if (header.includes('descripción')) {
                        row.getCell(colIdx).value = `Producto Original. \nSKU: ${item.sku}. \nOEM: ${item.oem || 'N/A'}. \nMarca: ${item.brand || 'Genérico'}.\n\nAplicación: ${vTitle}` + DESCRIPTION_FOOTER;
                    }
                    else if (header.includes('condición')) row.getCell(colIdx).value = 'Nuevo';
                    else if (header.includes('marca')) row.getCell(colIdx).value = item.brand || 'Genérico';
                    else if (header.includes('número de pieza')) row.getCell(colIdx).value = item.oem || item.sku;
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
