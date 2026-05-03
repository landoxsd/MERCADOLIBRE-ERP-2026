import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "Falta la URL" }, { status: 400 });
    }

    // Extraer el ID del item de la URL (ej: MLV12345678)
    const match = url.match(/(MLV[-_]?\d+)/i);
    if (!match) {
      return NextResponse.json({ error: "No se encontró un ID de Mercado Libre válido en el link" }, { status: 400 });
    }

    const itemId = match[1].replace(/[-_]/g, '');
    console.log(`🔍 Intentando extraer categoría EXACTA de la publicación: ${itemId}`);

    // Obtener token VÁLIDO
    const { getValidAccessToken } = require("@/lib/meli-auth-helper");
    const { data: firstAccount } = await supabaseAdmin
      .from('meli_accounts')
      .select('id')
      .limit(1)
      .single();

    let accessToken = null;
    if (firstAccount) {
      try {
        accessToken = await getValidAccessToken(firstAccount.id);
      } catch (e) {
        console.warn("⚠️ No se pudo refrescar el token:", e.message);
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: "No tienes una sesión de Mercado Libre activa. Por favor ve a la sección 'Autenticación' y dale a 'Vincular Cuenta' de nuevo para generar un Token fresco." }, { status: 401 });
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Authorization': `Bearer ${accessToken}`
    };

    // Consulta DIRECTA y EXACTA al item
    const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, { headers, cache: 'no-store' });
    const data = await res.json();

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ 
        error: `Mercado Libre rechazó tu Token (${res.status}). Tu sesión está vencida. Ve a la pantalla de Autenticación y re-vincula tu cuenta.` 
      }, { status: res.status });
    }

    if (!data.category_id) {
      return NextResponse.json({ error: "La publicación no existe o fue eliminada." }, { status: 404 });
    }

    console.log(`✅ Categoría exacta encontrada: ${data.category_id}`);
    return NextResponse.json({ 
      success: true, 
      category_id: data.category_id,
      title: data.title
    });

    if (!data.category_id) {
      return NextResponse.json({ error: "El item no tiene una categoría asociada." }, { status: 404 });
    }

    console.log(`✅ Categoría encontrada: ${data.category_id} (${data.title})`);
    return NextResponse.json({ 
      success: true, 
      category_id: data.category_id,
      title: data.title
    });

  } catch (error) {
    console.error("❌ Extract Category Error:", error);
    return NextResponse.json({ error: "Error interno: " + error.message }, { status: 500 });
  }
}
