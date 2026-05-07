
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
        const profitFile = formData.get("profitFile");
        const templateFile = formData.get("templateFile");
        const accountId = formData.get("accountId");

        if (!profitFile || !templateFile || !accountId) {
            return NextResponse.json({ error: "Faltan archivos (Profit, Plantilla o Cuenta)" }, { status: 400 });
        }

        // 1. Leer listado de Profit
        const profitBytes = await profitFile.arrayBuffer();
        const profitWb = XLSX.read(profitBytes, { type: "buffer" });
        const profitWs = profitWb.Sheets[profitWb.SheetNames[0]];
        const profitRows = XLSX.utils.sheet_to_json(profitWs, { header: 1 });

        // Identificar cabeceras de Profit
        let headerIdx = -1;
        for (let i = 0; i < Math.min(profitRows.length, 50); i++) {
            if (profitRows[i]?.some(c => String(c).toUpperCase().includes("CODIGO"))) {
                headerIdx = i;
                break;
            }
        }
        if (headerIdx === -1) return NextResponse.json({ error: "No se encontró cabecera 'CODIGO' en el Excel de Profit" }, { status: 400 });

        const pHeaders = profitRows[headerIdx].map(h => String(h || "").trim().toUpperCase());
        const idxSku = pHeaders.findIndex(h => h.includes("CODIGO") || h === "ARTICULO");
        const idxStock = pHeaders.findIndex(h => h === "STOCK" || h === "CANTIDAD" || h === "EXISTENCIA");
        const idxPrice = pHeaders.findIndex(h => h === "PRECIO" || h.includes("VTA1") || h.includes("COSTO"));

        const profitItems = profitRows.slice(headerIdx + 1)
            .filter(r => r[idxSku])
            .map(r => ({
                sku: String(r[idxSku] || "").trim().toUpperCase(),
                stock: parseFloat(r[idxStock] || 0),
                price: parseFloat(r[idxPrice] || 0)
            }));

        if (profitItems.length === 0) return NextResponse.json({ error: "No se encontraron SKUs en el archivo de Profit" }, { status: 400 });

        // 2. Obtener publicados para excluir
        const { data: mlProducts } = await supabaseAdmin.from('products').select('sku').eq('meli_account_id', accountId);
        const publishedSet = new Set();
        mlProducts?.forEach(p => {
            String(p.sku || "").split(/[, /]+/).forEach(s => {
                const c = s.trim().toUpperCase();
                if (c) publishedSet.add(c);
            });
        });

        const missingProfitItems = profitItems.filter(i => !publishedSet.has(i.sku));
        if (missingProfitItems.length === 0) return NextResponse.json({ error: "Todos los productos del listado ya están publicados." }, { status: 400 });

        // 3. Enriquecer con data técnica de Supabase (Fotos, OEM, Marca)
        const skusToProcess = missingProfitItems.map(i => i.sku);
        const { data: techData } = await supabaseAdmin.from('internal_inventory').select('sku, title, brand, oem').in('sku', skusToProcess);
        const { data: photoData } = await supabaseAdmin.from('image_bank').select('sku, ml_url, ml_picture_id').in('sku', skusToProcess).eq('sync_status', 'synced');

        const techMap = {};
        techData?.forEach(t => { techMap[t.sku] = t; });
        const photoMap = {};
        photoData?.forEach(p => {
            if (!photoMap[p.sku]) photoMap[p.sku] = [];
            const url = p.ml_url || (p.ml_picture_id ? `https://http2.mlstatic.com/D_${p.ml_picture_id}-O.jpg` : null);
            if (url) photoMap[p.sku].push(url);
        });

        // 4. Rellenar Plantilla ML
        const templateBytes = await templateFile.arrayBuffer();
        const templateWb = XLSX.read(templateBytes, { type: "buffer" });
        const dataSheetName = templateWb.SheetNames.find(n => n !== 'Ayuda' && n !== 'extra info');
        const templateWs = templateWb.Sheets[dataSheetName];
        const templateRows = XLSX.utils.sheet_to_json(templateWs, { header: 1 });

        const headers = templateRows[2]; 
        const filledRows = [...templateRows.slice(0, 4)]; 

        for (const pItem of missingProfitItems) {
            const tech = techMap[pItem.sku] || { title: pItem.sku, brand: 'Genérico', oem: pItem.sku };
            const variantTitles = getSplitTitles(tech.title || pItem.sku);

            for (const vTitle of variantTitles) {
                const optTitle = optimizeSEO(vTitle);
                const row = headers.map(h => {
                    const header = String(h || "").toLowerCase();
                    if (header.includes('título')) return optTitle;
                    if (header.includes('sku')) return pItem.sku;
                    if (header.includes('stock')) return pItem.stock;
                    if (header.includes('precio')) return pItem.price;
                    if (header.includes('fotos')) return (photoMap[pItem.sku] || []).join(',');
                    if (header.includes('descripción')) {
                        return `Producto Original. \nSKU: ${pItem.sku}. \nOEM: ${tech.oem || 'N/A'}. \nMarca: ${tech.brand || 'Genérico'}.\n\nAplicación: ${vTitle}` + DESCRIPTION_FOOTER;
                    }
                    if (header.includes('condición')) return 'Nuevo';
                    if (header.includes('marca')) return tech.brand || 'Genérico';
                    if (header.includes('número de pieza')) return tech.oem || pItem.sku;
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

        const newWs = XLSX.utils.aoa_to_sheet(filledRows);
        templateWb.Sheets[dataSheetName] = newWs;
        const buffer = XLSX.write(templateWb, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="Template_Relleno_${profitFile.name}"`,
            },
        });

    } catch (error) {
        console.error('❌ Fill From List Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
