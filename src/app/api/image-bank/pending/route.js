import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stockFilter = searchParams.get('stock'); // 'all', 'inStock', 'noStock'

    // 1. Obtener SKUs filtrados por stock si es necesario
    let filteredSkus = null;
    if (stockFilter === 'inStock' || stockFilter === 'noStock') {
      let invQuery = supabase.from('internal_inventory').select('sku');
      if (stockFilter === 'inStock') invQuery = invQuery.gt('stock', 0);
      else invQuery = invQuery.lte('stock', 0);
      
      const { data: invData } = await invQuery;
      if (invData) filteredSkus = invData.map(i => i.sku);
    }

    // 2. Obtener SKUs pendientes (sin imagenes)
    let query = supabase
      .from('image_bank')
      .select('sku')
      .in('sync_status', ['pending', 'changed']);

    const { data: pendingItems, error } = await query;
    if (error) throw error;

    let finalSkus = pendingItems.map(item => item.sku);

    // 3. Cruzar con filtro de stock si aplica
    if (filteredSkus) {
        const stockSet = new Set(filteredSkus);
        finalSkus = finalSkus.filter(sku => stockSet.has(sku));
    }

    // 4. Formatear como texto plano (un SKU por linea) para facil copiado
    const textOutput = finalSkus.join('\n');

    return new NextResponse(textOutput, {
        headers: {
            'Content-Type': 'text/plain',
            'Content-Disposition': `attachment; filename="SKUS_FALTANTES_${new Date().toISOString().split('T')[0]}.txt"`,
        }
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
