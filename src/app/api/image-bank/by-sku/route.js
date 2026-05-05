import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request) {
  try {
    const { skus, countOnly = false } = await request.json();

    if (!skus || !Array.isArray(skus) || skus.length === 0) {
      return NextResponse.json({ success: false, error: 'Se requiere una lista de SKUs' }, { status: 400 });
    }

    // Consultar en lotes de 1000 para evitar límites de Supabase
    const BATCH_SIZE = 1000;
    const photoMap = {};

    for (let i = 0; i < skus.length; i += BATCH_SIZE) {
      const batch = skus.slice(i, i + BATCH_SIZE);
      
      const { data, error } = await supabaseAdmin
        .from('image_bank')
        .select('sku, ml_picture_id, ml_url')
        .in('sku', batch)
        .eq('sync_status', 'synced')
        .order('image_index', { ascending: true });

      if (error) throw error;

      if (data) {
        data.forEach(p => {
          if (countOnly) {
            photoMap[p.sku] = true;
          } else {
            if (!photoMap[p.sku]) photoMap[p.sku] = [];
            const url = p.ml_url || (p.ml_picture_id ? `https://http2.mlstatic.com/D_${p.ml_picture_id}-O.jpg` : null);
            if (url) photoMap[p.sku].push(url);
          }
        });
      }
    }

    // Para los SKUs que no tienen fotos, asegurar que aparezcan como false o []
    skus.forEach(sku => {
      if (photoMap[sku] === undefined) {
        photoMap[sku] = countOnly ? false : [];
      }
    });

    return NextResponse.json({ success: true, photoMap });

  } catch (error) {
    console.error('❌ API Image Bank By SKU Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
