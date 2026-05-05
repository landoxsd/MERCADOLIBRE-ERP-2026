import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const stockFilter = searchParams.get('stock'); // 'all', 'inStock', 'noStock'

    // 1. Obtener Stats Globales (sin límite de 1000)
    const { count: total } = await supabase.from('image_bank').select('*', { count: 'exact', head: true });
    const { count: synced } = await supabase.from('image_bank').select('*', { count: 'exact', head: true }).eq('sync_status', 'synced');
    const { count: errorCount } = await supabase.from('image_bank').select('*', { count: 'exact', head: true }).eq('sync_status', 'error');
    const { count: pending } = await supabase.from('image_bank').select('*', { count: 'exact', head: true }).in('sync_status', ['pending', 'changed']);

    const stats = {
      total: total || 0,
      synced: synced || 0,
      pending: pending || 0,
      error: errorCount || 0
    };

    // 2. Obtener SKUs filtrados por stock si es necesario
    let filteredSkus = null;
    if (stockFilter === 'inStock' || stockFilter === 'noStock') {
      let invQuery = supabase.from('internal_inventory').select('sku');
      if (stockFilter === 'inStock') invQuery = invQuery.gt('stock', 0);
      else invQuery = invQuery.lte('stock', 0);
      
      const { data: invData } = await invQuery;
      if (invData) filteredSkus = invData.map(i => i.sku);
    }

    // 3. Obtener imágenes (búsqueda o recientes)
    let query = supabase.from('image_bank').select('*');
    
    if (search) {
      query = query.ilike('sku', `%${search}%`);
    } else if (filteredSkus) {
      // Si hay filtro de stock, limitamos a esos SKUs
      query = query.in('sku', filteredSkus.slice(0, 1000)); // Limite de seguridad para el IN clause
    } else {
      query = query.eq('sync_status', 'synced');
    }

    query = query.order('last_synced_at', { ascending: false }).limit(48);

    const { data: recent, error: errRecent } = await query;
    if (errRecent) throw errRecent;

    // 4. Enriquecer con información de stock real
    const skusToFetch = [...new Set(recent.map(img => img.sku))];
    const { data: stocks } = await supabase
      .from('internal_inventory')
      .select('sku, stock')
      .in('sku', skusToFetch);

    const stockMap = {};
    if (stocks) {
      stocks.forEach(s => { stockMap[s.sku] = s.stock; });
    }

    const enrichedRecent = recent.map(img => ({
      ...img,
      stock: stockMap[img.sku] !== undefined ? stockMap[img.sku] : 0
    }));

    return NextResponse.json({ success: true, stats, recent: enrichedRecent });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
