// ================================================================
// scripts/download-mlv-categories.js
// Descarga recursivamente el árbol completo de categorías de MLV
// y lo guarda en public/mlv-categories.json
// ================================================================

const fs = require('fs');
const path = require('path');

const MELI_BASE_URL = 'https://api.mercadolibre.com';
const SITE_ID = 'MLV';
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'mlv-categories.json');

async function fetchJSON(url) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!res.ok) {
        console.warn(`  ⚠️ Error ${res.status} en ${url}`);
        return null;
    }
    return res.json();
}

async function downloadCategoryTree(categoryId, depth = 0) {
    const indent = '  '.repeat(depth);
    const data = await fetchJSON(`${MELI_BASE_URL}/categories/${categoryId}`);

    if (!data) return null;

    const node = {
        id: data.id,
        name: data.name,
        path_from_root: data.path_from_root?.map(p => ({ id: p.id, name: p.name })) || [],
        children: [],
        is_leaf: !data.children_categories || data.children_categories.length === 0,
    };

    if (data.children_categories && data.children_categories.length > 0) {
        console.log(`${indent}📂 ${data.name} (${data.id}) → ${data.children_categories.length} hijos`);

        for (const child of data.children_categories) {
            const childNode = await downloadCategoryTree(child.id, depth + 1);
            if (childNode) {
                node.children.push(childNode);
            }
        }
    } else {
        console.log(`${indent}🍃 ${data.name} (${data.id})`);
    }

    return node;
}

async function main() {
    console.log('🚀 Descargando árbol de categorías de ML Venezuela...\n');

    const rootCategories = await fetchJSON(`${MELI_BASE_URL}/sites/${SITE_ID}/categories`);

    if (!rootCategories) {
        console.error('❌ No se pudieron obtener las categorías raíz');
        process.exit(1);
    }

    console.log(`📊 ${rootCategories.length} categorías raíz encontradas\n`);

    const tree = [];

    for (const root of rootCategories) {
        console.log(`\n📁 Procesando raíz: ${root.name} (${root.id})`);
        const node = await downloadCategoryTree(root.id, 1);
        if (node) {
            tree.push(node);
        }
    }

    // Contar totales
    let totalCategories = 0;
    let leafCategories = 0;

    function count(node) {
        totalCategories++;
        if (node.is_leaf) leafCategories++;
        for (const child of node.children) count(child);
    }
    for (const node of tree) count(node);

    const output = {
        site_id: SITE_ID,
        downloaded_at: new Date().toISOString(),
        total_root: tree.length,
        total_categories: totalCategories,
        total_leaf: leafCategories,
        categories: tree,
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

    console.log(`\n✅ Árbol guardado en: ${OUTPUT_FILE}`);
    console.log(`📊 Total categorías: ${totalCategories}`);
    console.log(`🍃 Categorías hoja (donde se publica): ${leafCategories}`);
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
