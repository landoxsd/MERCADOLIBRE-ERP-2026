
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ABBREVIATIONS = {
    'AMORT.': 'AMORTIGUADOR', 'AMORT': 'AMORTIGUADOR',
    'DEL.': 'DELANTERO', 'DEL': 'DELANTERO',
    'TRAS.': 'TRASERO', 'TRAS': 'TRASERO',
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
    'CHEV.': 'CHEVROLET', 'CHEV': 'CHEVROLET',
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

function optimizeSEO(title) {
    let seoTitle = String(title).toUpperCase();
    const sortedKeys = Object.keys(ABBREVIATIONS).sort((a, b) => b.length - a.length);
    const escapedKeys = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escapedKeys.join('|')})`, 'gi');
    
    seoTitle = seoTitle.replace(regex, (matched) => {
        const upperMatched = matched.toUpperCase();
        const expansion = ABBREVIATIONS[upperMatched] || ABBREVIATIONS[upperMatched + '.'];
        return expansion ? expansion + " " : matched;
    });

    seoTitle = seoTitle
        .replace(/NUEVO|OFERTA|PROMO|BARATO|ENVIO GRATIS|EXCELENTE/g, "")
        .replace(/\s+/g, " ")
        .trim();
    return seoTitle.substring(0, 60).trim();
}

async function fillTemplate(filename, outputName) {
    console.log(`Testing BUG-FREE SEO & Expansion for ${filename}...`);
    const workbook = XLSX.readFile(filename);
    const dataSheetName = workbook.SheetNames.find(name => name !== 'Ayuda' && name !== 'extra info');
    const worksheet = workbook.Sheets[dataSheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const mlCategoryName = rawRows[1][0];

    const { data: mappings } = await supabase.from('category_mappings').select('internal_name').eq('ml_category_name', mlCategoryName);
    const sublineNames = mappings.map(m => m.internal_name.toUpperCase());

    const { data: items } = await supabase.from('internal_inventory').select('*').in('subcategory', sublineNames).gt('stock', 0).limit(5);

    const headers = rawRows[2];
    const filledRows = [...rawRows.slice(0, 4)];

    for (const item of items) {
        console.log(`Original: ${item.title}`);
        const optimized = optimizeSEO(item.title);
        console.log(`SEO Optimized: ${optimized}`);
        console.log('---');
    }
}

async function run() {
    await fillTemplate('aceite para motor.xlsx', 'test_seo_aceite.xlsx');
    await fillTemplate('soporte para motor.xlsx', 'test_seo_soporte.xlsx');
}

run();
