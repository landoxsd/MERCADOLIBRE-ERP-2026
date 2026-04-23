require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function analyze() {
  const { data, error } = await supabase
    .from('products')
    .select('category_id, sold_quantity, title')
    .order('sold_quantity', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  const categoryStats = data.reduce((acc, p) => {
    if (!p.category_id) return acc;
    if (!acc[p.category_id]) acc[p.category_id] = { total_sales: 0, sample_title: p.title };
    acc[p.category_id].total_sales += (p.sold_quantity || 0);
    return acc;
  }, {});

  const sorted = Object.entries(categoryStats)
    .sort((a, b) => b[1].total_sales - a[1].total_sales)
    .slice(0, 10);

  console.log('--- TOP 10 CATEGORÍAS POR VENTAS ---');
  sorted.forEach(([catId, stats]) => {
    console.log(`ID: ${catId} | Ventas Totales: ${stats.total_sales} | Ejemplo: ${stats.sample_title}`);
  });
}

analyze();
