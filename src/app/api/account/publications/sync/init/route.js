// src/app/api/account/publications/sync/init/route.js
import { NextResponse } from "next/server";
import { accountsTable } from "@/lib/supabase-admin";
import { getAllItemIds } from "@/lib/meli";

export async function POST(req) {
  try {
    const { accountId } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: "Falta accountId" }, { status: 400 });
    }

    // 1. Obtener la cuenta y asegurar un TOKEN VÁLIDO (con refresco automático)
    const { getValidAccessToken } = await import("@/lib/meli-auth-helper");
    let accessToken;
    try {
      accessToken = await getValidAccessToken(accountId);
    } catch (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    // 2. Obtener datos de la cuenta para el proceso
    const { data: account, error: accError } = await accountsTable()
      .select("meli_user_id, nickname")
      .eq("id", accountId)
      .single();

    if (accError || !account) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    // 3. Obtener TODOS los IDs (Incluyendo Activos, Pausados y Cerrados)
    console.log(`📊 Inicializando conteo total para ${account?.nickname}...`);
    // Buscamos todos los estados relevantes para tener el inventario completo
    const allIds = await getAllItemIds(account.meli_user_id, accessToken, "active,paused,closed,not_yet_active,under_review");

    return NextResponse.json({
      success: true,
      total: allIds.length,
      itemIds: allIds, // Devolvemos la lista completa de IDs para que el frontend los procese por lotes
      nickname: account.nickname
    });

  } catch (error) {
    console.error("❌ Sync Init Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
