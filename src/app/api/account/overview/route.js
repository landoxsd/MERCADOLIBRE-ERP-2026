// ================================================================
// app/api/account/overview/route.js
// Resumen completo de la cuenta: reputación + facturación + ventas
// ================================================================
import { NextResponse } from "next/server";
import { accountsTable } from "@/lib/supabase-admin";
import { getAccountOverview } from "@/lib/meli";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { cookies } from "next/headers";

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const activeAccountId = cookieStore.get("meli_erp_account")?.value;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || activeAccountId;

    if (!accountId) {
      return NextResponse.json({ error: "No hay cuenta activa" }, { status: 401 });
    }

    // Buscar la cuenta en Supabase
    const { data: account, error } = await accountsTable()
      .select("id, meli_user_id, nickname, access_token, token_expiry")
      .eq("id", accountId)
      .single();

    if (error || !account) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    // Obtener token válido (refresca automáticamente si expiró)
    const accessToken = await getValidAccessToken(accountId);

    // Obtener resumen completo desde la API de ML
    const overview = await getAccountOverview(account.meli_user_id, accessToken);

    return NextResponse.json({
      account: { id: account.id, nickname: account.nickname },
      ...overview,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error en /api/account/overview:", err.message);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
