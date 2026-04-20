// ================================================================
// app/api/auth/accounts/route.js
// Devuelve la lista de cuentas ML vinculadas (para el selector multicuenta)
// ================================================================
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const accounts = await prisma.meliAccount.findMany({
      select: {
        id: true,
        nickname: true,
        email: true,
        siteId: true,
        tokenExpiry: true,
        createdAt: true,
        // Nunca devolver tokens en el frontend
        _count: {
          select: { orders: true, products: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Añadir flag de si el token está vigente o expirado
    const enriched = accounts.map((acc) => ({
      ...acc,
      tokenActive: new Date(acc.tokenExpiry) > new Date(),
    }));

    return NextResponse.json({ accounts: enriched });
  } catch (err) {
    console.error("Error listando cuentas:", err.message);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
