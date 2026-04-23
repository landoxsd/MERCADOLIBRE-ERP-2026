require('dotenv').config();
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

const MAESTRO_FILE = 'MAESTRO 20042026.xlsx';
const SETTINGS_FILE = '.erp_settings.json';

async function learnMappings() {
  try {
    console.log('📖 Leyendo Maestro...');
    const workbook = XLSX.readFile(MAESTRO_FILE);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Mapear SKU -> Sublinea del Excel (Fila 11+ = Data)
    const skuToSubline = {};
    data.slice(11).forEach(row => {
      const sku = String(row[0] || '').trim();
      const subline = String(row[4] || '').trim();
      if (sku && subline) skuToSubline[sku] = subline;
    });

    console.log(`✅ ${Object.keys(skuToSubline).length} SKUs cargados del maestro.`);

    console.log('📡 Consultando publicaciones actuales en Supabase...');
    const { data: dbProducts, error } = await supabase
      .from('products')
      .select('sku, category_id')
      .not('category_id', 'is', null);

    if (error) throw error;

    // Mapear Sublinea -> Frecuencia de Categorias
    const sublineMappingStats = {};

    dbProducts.forEach(p => {
      const subline = skuToSubline[p.sku];
      if (subline) {
        if (!sublineMappingStats[subline]) sublineMappingStats[subline] = {};
        sublineMappingStats[subline][p.category_id] = (sublineMappingStats[subline][p.category_id] || 0) + 1;
      }
    });

    // Tomar la categoría más frecuente para cada sublínea
    const finalMap = {};
    Object.entries(sublineMappingStats).forEach(([subline, cats]) => {
      const sortedCats = Object.entries(cats).sort((a, b) => b[1] - a[1]);
      finalMap[subline] = sortedCats[0][0];
    });

    console.log(`✨ Se han deducido ${Object.keys(finalMap).length} mapeos de categorías.`);

    // Actualizar Settings
    let settings = { photosPath: '', defaultMargin: 30, categoryMap: {} };
    if (fs.existsSync(SETTINGS_FILE)) {
      settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }

    settings.categoryMap = { ...settings.categoryMap, ...finalMap };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    
    console.log('💾 Configuración de Categorías actualizada con éxito en el ERP.');
  } catch(e) {
    console.error('❌ Error fatal:', e.message);
  }
}

learnMappings();
