import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHUNK_SIZE = 500;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const stockFilter = searchParams.get('stock'); // 'all', 'inStock', 'noStock'
    const hasStockFilter = stockFilter === 'inStock' || stockFilter === 'noStock';

    // 1. Obtener SKUs pendientes (solo columna sku, sin inventario completo)
    const { data: pendingItems, error } = await supabase
      .from('image_bank')
      .select('sku')
      .in('sync_status', ['pending', 'changed']);

    if (error) throw error;

    let finalSkus = [...new Set((pendingItems || []).map(item => item.sku))];

    // 2. Cruzar con filtro de stock consultando inventario solo para SKUs pendientes (en lotes)
    if (hasStockFilter && finalSkus.length > 0) {
      const matchingSkus = [];

      for (let i = 0; i < finalSkus.length; i += CHUNK_SIZE) {
        const chunk = finalSkus.slice(i, i + CHUNK_SIZE);
        const { data: invData } = await supabase
          .from('internal_inventory')
          .select('sku, stock')
          .in('sku', chunk);

        if (invData) {
          for (const row of invData) {
            const hasStock = (row.stock || 0) > 0;
            if (stockFilter === 'inStock' ? hasStock : !hasStock) {
              matchingSkus.push(row.sku);
            }
          }
        }
      }

      finalSkus = matchingSkus;
    }

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
