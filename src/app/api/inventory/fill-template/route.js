
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
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
        const workbook = XLSX.read(bytes, { type: "buffer" });
        const dataSheetName = workbook.SheetNames.find(name => name !== 'Ayuda' && name !== 'extra info');
        if (!dataSheetName) return NextResponse.json({ error: "Plantilla inválida" }, { status: 400 });

        const worksheet = workbook.Sheets[dataSheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        let mlCategoryName = rawRows[1] && rawRows[1][0] ? String(rawRows[1][0]).trim() : null;
        if (!mlCategoryName && rawRows[0] && rawRows[0][1]) {
            const parts = String(rawRows[0][1]).split(' > ');
            mlCategoryName = parts[parts.length - 1].trim();
        }
        if (!mlCategoryName) return NextResponse.json({ error: "Categoría no detectada" }, { status: 400 });

        const { data: mappings } = await supabaseAdmin.from('category_mappings').select('internal_name').eq('ml_category_name', mlCategoryName);
        if (!mappings || mappings.length === 0) return NextResponse.json({ error: `No hay mapeos para ${mlCategoryName}` }, { status: 400 });

        const sublineNames = mappings.map(m => m.internal_name.toUpperCase());

        // --- NUEVA LÓGICA DE DETECCIÓN DE PUBLICADOS (MÁS PRECISA) ---
        // Consultar productos reales de ML sincronizados en la tabla 'products'
        const { data: mlProducts } = await supabaseAdmin
            .from('products')
            .select('sku')
            .eq('meli_account_id', accountId);
        
        const publishedSkusSet = new Set();
        mlProducts?.forEach(p => {
            // Soportar SKUs múltiples separados por coma, espacio o barra (igual que en la auditoría)
            String(p.sku || "").split(/[, /]+/).forEach(s => {
                const clean = s.trim().toUpperCase();
                if (clean) publishedSkusSet.add(clean);
            });
        });

        const { data: items } = await supabaseAdmin
            .from('internal_inventory')
            .select('*')
            .in('subcategory', sublineNames)
            .gt('stock', 0);

        // Filtrar missingItems usando el Set de SKUs publicados normalizados
        const missingItems = (items || []).filter(item => {
            const sku = String(item.sku || "").trim().toUpperCase();
            return !publishedSkusSet.has(sku);
        });

        if (missingItems.length === 0) return NextResponse.json({ error: "Sin productos nuevos para publicar." }, { status: 400 });

        const allSkus = missingItems.map(i => i.sku);
        const { data: photoData } = await supabaseAdmin.from('image_bank').select('sku, ml_url, ml_picture_id').in('sku', allSkus).eq('sync_status', 'synced');
        const skuPhotoMap = {};
        photoData?.forEach(p => {
            if (!skuPhotoMap[p.sku]) skuPhotoMap[p.sku] = [];
            const url = p.ml_url || (p.ml_picture_id ? `https://http2.mlstatic.com/D_${p.ml_picture_id}-O.jpg` : null);
            if (url) skuPhotoMap[p.sku].push(url);
        });

        const headers = rawRows[2]; 
        const filledRows = [...rawRows.slice(0, 4)]; 

        for (const item of missingItems) {
            const variantTitles = getSplitTitles(item.title);
            for (const vTitle of variantTitles) {
                const optimizedTitle = optimizeSEO(vTitle);
                const row = headers.map(h => {
                    const header = String(h || "").toLowerCase();
                    if (header.includes('título')) return optimizedTitle;
                    if (header.includes('sku')) return item.sku;
                    if (header.includes('stock')) return item.stock;
                    if (header.includes('precio')) return item.price;
                    if (header.includes('fotos')) return (skuPhotoMap[item.sku] || []).join(',');
                    if (header.includes('descripción')) {
                        return `Producto Original. \nSKU: ${item.sku}. \nOEM: ${item.oem || 'N/A'}. \nMarca: ${item.brand || 'Genérico'}.\n\nAplicación: ${vTitle}` + DESCRIPTION_FOOTER;
                    }
                    if (header.includes('condición')) return 'Nuevo';
                    if (header.includes('marca')) return item.brand || 'Genérico';
                    if (header.includes('número de pieza')) return item.oem || item.sku;
                    if (header.includes('tipo de publicación')) return 'Premium';
                    if (header.includes('forma de envío')) return 'Mercado Envíos';
                    if (header.includes('costo de envío')) return 'Envío gratis';
                    if (header.includes('retiro en persona')) return 'Acepto';
                    if (header.includes('tipo de garantía')) return 'Garantía del vendedor';
                    if (header.includes('tiempo de garantía')) return '30';
                    if (header.includes('unidad de tiempo de garantía')) return 'días';
                    return "";
                });
                filledRows.push(row);
            }
        }

        const newWorksheet = XLSX.utils.aoa_to_sheet(filledRows);
        workbook.Sheets[dataSheetName] = newWorksheet;
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

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
