
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fillTemplate(filename, outputName) {
    console.log(`Processing ${filename}...`);
    const workbook = XLSX.readFile(filename);
    const dataSheetName = workbook.SheetNames.find(name => name !== 'Ayuda' && name !== 'extra info');
    
    if (!dataSheetName) {
        console.error(`No data sheet found in ${filename}`);
        return;
    }

    const worksheet = workbook.Sheets[dataSheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const mlCategoryName = rawRows[1] && rawRows[1][0] ? rawRows[1][0] : null;

    if (!mlCategoryName) {
        console.error(`Category name not found in ${filename}`);
        return;
    }

    console.log(`Detected ML Category: ${mlCategoryName}`);

    // Buscar mapeos
    const { data: mappings } = await supabase
        .from('category_mappings')
        .select('internal_name')
        .eq('ml_category_name', mlCategoryName);

    if (!mappings || mappings.length === 0) {
        console.error(`No mappings found for ${mlCategoryName}`);
        return;
    }

    const sublineNames = mappings.map(m => m.internal_name.toUpperCase());
    console.log(`Matching Profit Sublines: ${sublineNames.join(', ')}`);

    // Obtener productos
    const { data: items } = await supabase
        .from('internal_inventory')
        .select('*')
        .in('subcategory', sublineNames)
        .gt('stock', 0)
        .limit(20);

    if (!items || items.length === 0) {
        console.error(`No products found in inventory for these sublines.`);
        return;
    }

    console.log(`Found ${items.length} products to fill.`);

    // Obtener Fotos
    const skus = items.map(i => i.sku);
    const { data: photoData } = await supabase
        .from('image_bank')
        .select('sku, ml_url, ml_picture_id')
        .in('sku', skus)
        .eq('sync_status', 'synced');

    const skuPhotoMap = {};
    if (photoData) {
        photoData.forEach(p => {
            if (!skuPhotoMap[p.sku]) skuPhotoMap[p.sku] = [];
            const url = p.ml_url || (p.ml_picture_id ? `https://http2.mlstatic.com/D_${p.ml_picture_id}-O.jpg` : null);
            if (url) skuPhotoMap[p.sku].push(url);
        });
    }

    // Rellenar
    const headers = rawRows[2];
    const filledRows = [...rawRows.slice(0, 4)];

    for (const item of items) {
        const row = headers.map(h => {
            const header = String(h || "").toLowerCase();
            if (header.includes('título')) return item.title;
            if (header.includes('sku')) return item.sku;
            if (header.includes('stock')) return item.stock;
            if (header.includes('precio')) return item.price;
            if (header.includes('fotos')) return (skuPhotoMap[item.sku] || []).join(',');
            if (header.includes('descripción')) return `Producto 100% Original. SKU: ${item.sku}. OEM: ${item.oem || 'N/A'}. Marca: ${item.brand || 'Genérico'}.`;
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

    const newWorksheet = XLSX.utils.aoa_to_sheet(filledRows);
    workbook.Sheets[dataSheetName] = newWorksheet;
    XLSX.writeFile(workbook, outputName);
    console.log(`Success! File saved as ${outputName}`);
}

async function run() {
    await fillTemplate('aceite para motor.xlsx', 'aceite_para_motor_LLENADO.xlsx');
    await fillTemplate('soporte para motor.xlsx', 'soporte_para_motor_LLENADO.xlsx');
}

run();
