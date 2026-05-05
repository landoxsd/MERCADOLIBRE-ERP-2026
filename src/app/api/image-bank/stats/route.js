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
