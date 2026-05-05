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

    // 1. Obtener Stats
    const { data: allData, error: errStats } = await supabase
      .from('image_bank')
      .select('sync_status');

    if (errStats) throw errStats;

    const counts = allData.reduce((acc, curr) => {
      acc[curr.sync_status] = (acc[curr.sync_status] || 0) + 1;
      return acc;
    }, {});

    const stats = {
      total: allData.length,
      synced: counts.synced || 0,
      pending: (counts.pending || 0) + (counts.changed || 0),
      error: counts.error || 0
    };

    // 2. Obtener imágenes (búsqueda o recientes)
    let query = supabase.from('image_bank').select('*');
    
    if (search) {
      query = query.ilike('sku', `%${search}%`).order('image_index', { ascending: true });
    } else {
      query = query.eq('sync_status', 'synced').order('last_synced_at', { ascending: false }).limit(24);
    }

    const { data: recent, error: errRecent } = await query;
    if (errRecent) throw errRecent;

    return NextResponse.json({ success: true, stats, recent });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
