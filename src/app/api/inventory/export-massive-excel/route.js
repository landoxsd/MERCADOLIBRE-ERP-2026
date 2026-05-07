
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCategoryRequiredAttributes, getCategoryInfo } from "@/lib/meli-categories";
import fs from "fs";
import path from "path";

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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

function optimizeTitle(rawTitle) {
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
        .replace(/NUEVO|OFERTA|PROMO|BARATO|ENVIO GRATIS|EXCELENTE/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    
    return seoTitle.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function buildBaseRow(item, photoUrls) {
    const title = optimizeTitle(item.title);
    return {
        'Línea Profit': item.category || 'SIN LÍNEA',
        'Sublínea Profit': item.subcategory || 'SIN CATEGORÍA',
        'Breadcrumb Profit': item.profit_breadcrumb || `${item.category || ''} > ${item.subcategory || ''}`,
        'Título': title,
        'Cantidad de caracteres': title.length,
        'Condición': 'Nuevo',
        'Fotos': photoUrls.join(','),
        'SKU': item.sku,
        'Stock': item.stock || 0,
        'Precio [US$]': item.price || 0,
        'Descripción': `Producto 100% Original. \nSKU: ${item.sku}. \nOEM: ${item.oem || 'N/A'}. \nMarca: ${item.brand || 'Genérico'}.`,
        'Tipo de publicación': 'Premium',
        'Cargo por venta': '-',
        'Forma de envío': 'Mercado Envíos',
        'Costo de envío': 'Envío gratis',
        'Retiro en persona': 'Acepto',
        'Tipo de garantía': 'Garantía del vendedor',
        'Tiempo de garantía': '30',
        'Unidad de Tiempo de garantía': 'días',
        'Marca': item.brand || 'Genérico',
        'Número de pieza': item.oem || item.sku,
    };
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { accountId, filters = {} } = body;

        if (!accountId) return NextResponse.json({ error: 'Falta accountId' }, { status: 400 });

        const cachePath = path.join(process.cwd(), `.audit_cache_master_${accountId}.json`);
        if (!fs.existsSync(cachePath)) return NextResponse.json({ error: 'No hay auditoría en caché' }, { status: 400 });

        const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        let missingItems = cacheData.missing || [];

        if (filters.withStock) missingItems = missingItems.filter(i => (i.stock || 0) > 0);
        if (filters.limit > 0) missingItems = missingItems.slice(0, filters.limit);

        const allSkus = missingItems.map(i => i.sku);
        const skuSubcategoryMap = {};
        const BATCH_SIZE = 1000;

        if (allSkus.length > 0) {
            for (let i = 0; i < allSkus.length; i += BATCH_SIZE) {
                const batchSkus = allSkus.slice(i, i + BATCH_SIZE);
                const { data: invData } = await supabaseAdmin.from('internal_inventory').select('sku, subcategory, category, profit_breadcrumb').in('sku', batchSkus);
                invData?.forEach(row => {
                    skuSubcategoryMap[row.sku] = { subcategory: row.subcategory, category: row.category, profit_breadcrumb: row.profit_breadcrumb };
                });
            }
        }

        missingItems = missingItems.map(item => ({ ...item, ...(skuSubcategoryMap[item.sku] || {}) }));

        const uniqueSubcategories = [...new Set(missingItems.map(i => i.subcategory))];
        const subcategoryToMlCat = {};

        for (const sub of uniqueSubcategories) {
            if (!sub) continue;
            const { data: mapping } = await supabaseAdmin.from('category_mappings').select('ml_category_id, ml_category_name, internal_subline_code').ilike('internal_name', sub).limit(1).single();
            subcategoryToMlCat[sub] = mapping || { ml_category_name: 'SIN_CATEGORIA' };
        }

        const skuPhotoMap = {};
        if (allSkus.length > 0) {
            for (let i = 0; i < allSkus.length; i += BATCH_SIZE) {
                const batchSkus = allSkus.slice(i, i + BATCH_SIZE);
                const { data: photoData } = await supabaseAdmin.from('image_bank').select('sku, ml_url, ml_picture_id').in('sku', batchSkus).eq('sync_status', 'synced');
                photoData?.forEach(p => {
                    if (!skuPhotoMap[p.sku]) skuPhotoMap[p.sku] = [];
                    const url = p.ml_url || (p.ml_picture_id ? `https://http2.mlstatic.com/D_${p.ml_picture_id}-O.jpg` : null);
                    if (url) skuPhotoMap[p.sku].push(url);
                });
            }
        }

        const groups = {};
        for (const item of missingItems) {
            const mlCat = subcategoryToMlCat[item.subcategory];
            const catKey = mlCat?.ml_category_id || 'SIN_CATEGORIA';
            if (!groups[catKey]) groups[catKey] = { name: mlCat?.ml_category_name || 'SIN CATEGORÍA', items: [], categoryId: catKey };
            groups[catKey].items.push(item);
        }

        const categoryAttributes = {};
        for (const [catKey, group] of Object.entries(groups)) {
            if (catKey !== 'SIN_CATEGORIA') {
                try {
                    const attrs = await getCategoryRequiredAttributes(catKey);
                    categoryAttributes[catKey] = attrs;
                    const catInfo = await getCategoryInfo(catKey);
                    if (catInfo?.path_from_root) group.mlBreadcrumb = catInfo.path_from_root.map(p => p.name).join(' > ');
                } catch (e) {}
            }
        }

        const workbook = XLSX.utils.book_new();
        
        for (const [catKey, group] of Object.entries(groups)) {
            const sheetRows = [];
            const attrs = categoryAttributes[catKey] || [];
            const baseHeaders = ['Línea Profit', 'Sublínea Profit', 'Breadcrumb Profit', 'Título', 'Cantidad de caracteres', 'Condición', 'Fotos', 'SKU', 'Stock', 'Precio [US$]', 'Descripción', 'Tipo de publicación', 'Forma de envío', 'Costo de envío', 'Retiro en persona', 'Tipo de garantía', 'Tiempo de garantía', 'Unidad de Tiempo de garantía', 'Marca', 'Número de pieza', 'Breadcrumb ML'];
            const allHeaders = [...baseHeaders, ...attrs.map(a => a.name)];

            sheetRows.push([group.name, group.name, group.name]);
            sheetRows.push([group.name, group.name, group.name]);
            sheetRows.push(allHeaders);
            sheetRows.push(allHeaders.map(h => ['Título', 'Fotos', 'Stock', 'Precio [US$]'].includes(h) ? 'Obligatorio' : ''));

            for (const item of group.items) {
                const photos = skuPhotoMap[item.sku] || [];
                const baseRow = buildBaseRow(item, photos);
                const fullRow = allHeaders.map(h => {
                    if (h === 'Breadcrumb ML') return group.mlBreadcrumb || '';
                    if (baseRow[h] !== undefined) return baseRow[h];
                    const attr = attrs.find(a => a.name === h);
                    if (attr) return attr.values?.[0]?.name || 'Genérico';
                    return '';
                });
                sheetRows.push(fullRow);
            }

            const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
            XLSX.utils.book_append_sheet(workbook, worksheet, group.name.substring(0, 31));
        }

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="Export_ML.xlsx"`,
            },
        });

    } catch (error) {
        console.error('❌ Export Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
