// ================================================================
// app/api/account/overview/route.js
// Endpoint que agrega: reputación + billing + métricas de ventas
// Devuelve todo en una sola llamada para el widget del Dashboard
// ================================================================
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccountOverview } from "@/lib/meli";
import { cookies } from "next/headers";

export async function GET(request) {
  try {
    // Obtener la cuenta activa desde la cookie de sesión
    const cookieStore = await cookies();
    const activeAccountId = cookieStore.get("active_account_id")?.value;

    // También permite pasar el accountId como query param
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || activeAccountId;

    if (!accountId) {
      return NextResponse.json({ error: "No hay cuenta activa" }, { status: 401 });
    }

    // Buscar la cuenta en la BD
    const account = await prisma.meliAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        meliUserId: true,
        nickname: true,
        accessToken: true,
        tokenExpiry: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    // Verificar que el token no haya expirado
    if (new Date(account.tokenExpiry) < new Date()) {
      return NextResponse.json(
        { error: "Token expirado, reconectar cuenta", code: "TOKEN_EXPIRED" },
        { status: 401 }
      );
    }

    // Obtener resumen completo (reputación + billing + ventas)
    const overview = await getAccountOverview(account.meliUserId, account.accessToken);

    return NextResponse.json({
      account: {
        id: account.id,
        nickname: account.nickname,
      },
      ...overview,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error en /api/account/overview:", err.message);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
