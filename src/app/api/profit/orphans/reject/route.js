// src/app/api/profit/orphans/reject/route.js
import { NextResponse } from 'next/server';
import { rejectOrphanSuggestion } from '@/modules/profit/orphan-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await rejectOrphanSuggestion(body);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error rechazando sugerencia de huérfano:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al descartar sugerencia' },
      { status: 500 }
    );
  }
}
