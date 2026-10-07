// ================================================================
// src/app/api/profit/missing/sublines/route.js
// Endpoint REST: Listado de Sub-Líneas con Artículos Faltantes
// ================================================================
import { NextResponse } from 'next/server';
import { getSublinesSummary } from '@/modules/profit/missing-service';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const minFaltantes = parseInt(searchParams.get('min') || '1', 10);

    const summary = await getSublinesSummary({ minFaltantes });

    return NextResponse.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error en /api/profit/missing/sublines:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
