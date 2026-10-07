// ================================================================
// src/app/api/profit/missing/items/route.js
// Endpoint REST: Artículos faltantes de una sublínea paginados por lotes
// ================================================================
import { NextResponse } from 'next/server';
import { getMissingItemsBySubline } from '@/modules/profit/missing-service';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const co_subl = searchParams.get('co_subl');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = searchParams.get('limit') === 'all' ? 'all' : parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const photoFilter = searchParams.get('photoFilter') || 'all';

    if (!co_subl) {
      return NextResponse.json(
        { success: false, error: 'Parámetro co_subl requerido' },
        { status: 400 }
      );
    }

    const data = await getMissingItemsBySubline(co_subl, {
      page,
      limit,
      search,
      photoFilter,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error en /api/profit/missing/items:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
