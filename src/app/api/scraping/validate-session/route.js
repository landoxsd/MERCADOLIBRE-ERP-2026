// =============================================================================
// src/app/api/scraping/validate-session/route.js
// API Route: Validar si la cookie de sesión de ML sigue activa
// =============================================================================

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateSessionCookie } from '@/utils/scraping/ml-scraper';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    const { accountId } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: 'Falta accountId' }, { status: 400 });
    }

    const { data: account } = await supabaseAdmin
      .from('meli_accounts')
      .select('id, nickname, session_cookie')
      .eq('id', accountId)
      .single();

    if (!account?.session_cookie) {
      return NextResponse.json({ valid: false, reason: 'NO_COOKIE' });
    }

    const result = await validateSessionCookie(account.session_cookie);

    // Actualizar cookie_expiry si es inválida
    if (!result.valid) {
      await supabaseAdmin
        .from('meli_accounts')
        .update({ cookie_expiry: new Date().toISOString() })
        .eq('id', accountId);
    }

    return NextResponse.json({
      valid: result.valid,
      nickname: result.nickname,
      account: account.nickname,
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
