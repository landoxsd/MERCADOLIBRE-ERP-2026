import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LIST_COLUMNS = 'id, sku, sync_status, ml_picture_id, ml_url, ml_secure_url, last_synced_at';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const stockFilter = searchParams.get('stock'); // 'all', 'inStock', 'noStock'
    const hasStockFilter = stockFilter === 'inStock' || stockFilter === 'noStock';

    // 1. Obtener Stats Globales (head-only counts, sin transferir filas)
    const { count: total } = await supabase.from('image_bank').select('id', { count: 'exact', head: true });
    const { count: synced } = await supabase.from('image_bank').select('id', { count: 'exact', head: true }).eq('sync_status', 'synced');
    const { count: errorCount } = await supabase.from('image_bank').select('id', { count: 'exact', head: true }).eq('sync_status', 'error');
    const { count: pending } = await supabase.from('image_bank').select('id', { count: 'exact', head: true }).in('sync_status', ['pending', 'changed']);

    const stats = {
      total: total || 0,
      synced: synced || 0,
      pending: pending || 0,
      error: errorCount || 0
    };

    // 2. Obtener imágenes (búsqueda o recientes); con filtro de stock pedimos más filas y filtramos en memoria
    let query = supabase.from('image_bank').select(LIST_COLUMNS);

    if (search) {
      query = query.ilike('sku', `%${search}%`);
    } else {
      query = query.eq('sync_status', 'synced');
    }

    const fetchLimit = hasStockFilter ? 250 : 48;
    query = query.order('last_synced_at', { ascending: false }).limit(fetchLimit);

    const { data: recent, error: errRecent } = await query;
    if (errRecent) throw errRecent;

    // 3. Enriquecer con stock solo para los SKUs de este lote (evita traer ~27k filas de inventario)
    const skusToFetch = [...new Set((recent || []).map(img => img.sku))];
    const stockMap = {};

    if (skusToFetch.length > 0) {
      const { data: stocks } = await supabase
        .from('internal_inventory')
        .select('sku, stock')
        .in('sku', skusToFetch);

      if (stocks) {
        stocks.forEach(s => { stockMap[s.sku] = s.stock; });
      }
    }

    let enrichedRecent = (recent || []).map(img => ({
      ...img,
      stock: stockMap[img.sku] !== undefined ? stockMap[img.sku] : 0
    }));

    if (stockFilter === 'inStock') {
      enrichedRecent = enrichedRecent.filter(img => img.stock > 0);
    } else if (stockFilter === 'noStock') {
      enrichedRecent = enrichedRecent.filter(img => img.stock <= 0);
    }

    enrichedRecent = enrichedRecent.slice(0, 48);

    return NextResponse.json({ success: true, stats, recent: enrichedRecent });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
