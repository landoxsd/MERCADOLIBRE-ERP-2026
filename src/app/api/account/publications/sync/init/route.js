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
    const allIds = await getAllItemIds(account.meli_user_id, accessToken, "active,paused,closed,not_yet_active,under_review");

    // 4. Verificar qué publicaciones ya están guardadas en PostgreSQL local para reanudar
    const { pgPool } = await import("@/lib/supabase-admin");
    let existingCount = 0;
    let pendingIds = allIds;
    if (pgPool) {
      try {
        const existingRes = await pgPool.query(
          "SELECT meli_item_id FROM products WHERE meli_account_id = $1",
          [accountId]
        );
        const existingSet = new Set(existingRes.rows.map(r => r.meli_item_id));
        existingCount = existingSet.size;
        pendingIds = allIds.filter(id => !existingSet.has(id));
      } catch (e) {
        console.warn("No se pudo consultar ítems existentes:", e.message);
      }
    }

    return NextResponse.json({
      success: true,
      total: allIds.length,
      alreadySynced: existingCount,
      pendingCount: pendingIds.length,
      itemIds: pendingIds, // Solo procesar los que faltan
      nickname: account.nickname
    });

  } catch (error) {
    console.error("❌ Sync Init Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
