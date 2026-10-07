// src/app/api/profit/orphans/route.js
import { NextResponse } from 'next/server';
import { getOrphanSuggestions } from '@/modules/profit/orphan-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const filter = searchParams.get('filter') || 'pending';

    const data = await getOrphanSuggestions({ page, limit, filter });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error en /api/profit/orphans:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error consultando huérfanos y sugerencias' },
      { status: 500 }
    );
  }
}
