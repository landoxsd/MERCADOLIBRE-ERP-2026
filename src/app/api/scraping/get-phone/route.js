// =============================================================================
// src/app/api/scraping/get-phone/route.js
// API Route: Extraer teléfono del comprador de una orden ML via Playwright
// =============================================================================
// Uso:
//   POST /api/scraping/get-phone
//   Body: { accountId: string, orderId: string }
//
// ⚠️ IMPORTANTE: Esta ruta usa Node.js runtime (no Edge).
//    Playwright necesita acceso al sistema de archivos y a binarios del SO.
// =============================================================================

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { scrapeOrderPhone } from '@/utils/scraping/ml-scraper';

// Forzar Node.js runtime (Playwright no funciona en Edge Runtime)
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 segundos máximo (Vercel Pro)

export async function POST(req) {
  try {
    const { accountId, orderId } = await req.json();

    if (!accountId || !orderId) {
      return NextResponse.json(
        { error: 'Faltan parámetros: accountId y orderId son obligatorios' },
        { status: 400 }
      );
    }

    // 1. Obtener la cookie de sesión de la cuenta desde Supabase
    const { data: account, error: accountError } = await supabaseAdmin
      .from('meli_accounts')
      .select('id, nickname, session_cookie, cookie_expiry')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Cuenta no encontrada en la base de datos' },
        { status: 404 }
      );
    }

    if (!account.session_cookie) {
      return NextResponse.json(
        { 
          error: 'NO_SESSION_COOKIE',
          message: `La cuenta "${account.nickname}" no tiene una cookie de sesión configurada. Por favor, sigue las instrucciones en Ajustes > Scraping para agregarla.`
        },
        { status: 422 }
      );
    }

    // 2. Verificar si la cookie de sesión no ha expirado
    if (account.cookie_expiry) {
      const expiryDate = new Date(account.cookie_expiry);
      if (expiryDate < new Date()) {
        return NextResponse.json(
          { 
            error: 'SESSION_EXPIRED',
            message: 'La cookie de sesión ha expirado. Por favor, actualízala en Ajustes > Scraping.'
          },
          { status: 401 }
        );
      }
    }

    // 3. Ejecutar el scraping con Playwright
    console.log(`🎭 Iniciando Playwright para orden ${orderId} de ${account.nickname}...`);
    const result = await scrapeOrderPhone(orderId, account.session_cookie);

    // 4. Manejar errores de sesión
    if (result.error === 'SESSION_EXPIRED') {
      // Marcar la cookie como expirada en la DB
      await supabaseAdmin
        .from('meli_accounts')
        .update({ cookie_expiry: new Date().toISOString() })
        .eq('id', accountId);

      return NextResponse.json(
        { 
          error: 'SESSION_EXPIRED',
          message: 'La sesión de ML ha expirado. Por favor, actualiza la cookie en Ajustes > Scraping.'
        },
        { status: 401 }
      );
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error, message: 'Error al ejecutar el scraper' },
        { status: 500 }
      );
    }

    // 5. Si encontró teléfono, guardarlo en la orden correspondiente
    if (result.phone) {
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({
          scraped_phone: result.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('meli_order_id', orderId)
        .eq('meli_account_id', accountId);

      if (updateError) {
        console.warn(`⚠️ No se pudo guardar el teléfono en la orden: ${updateError.message}`);
        // No es fatal, retornamos el resultado igual
      } else {
        console.log(`💾 Teléfono ${result.phone} guardado en orden ${orderId}`);
      }

      // También actualizar/crear el cliente en la tabla CRM
      if (result.buyerName) {
        await supabaseAdmin
          .from('customers')
          .upsert({
            phone: result.phone,
            nickname: result.buyerName,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'phone', ignoreDuplicates: false })
          .select();
      }
    }

    return NextResponse.json({
      success: true,
      phone: result.phone,
      buyerName: result.buyerName,
      orderId,
      savedToDb: !!result.phone,
    });

  } catch (error) {
    console.error('❌ Error en API get-phone:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
