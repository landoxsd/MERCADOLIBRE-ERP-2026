// src/app/api/profit/orphans/approve/route.js
import { NextResponse } from 'next/server';
import { approveOrphanSuggestion } from '@/modules/profit/orphan-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await approveOrphanSuggestion(body);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error aprobando huérfano:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error al aprobar cambio de código' },
      { status: 500 }
    );
  }
}
