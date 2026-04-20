// ================================================================
// app/api/auth/accounts/route.js  
// Lista las cuentas ML vinculadas (selector multicuenta en Sidebar)
// ================================================================
import { NextResponse } from "next/server";
import { accountsTable, ordersTable, productsTable } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { data: accounts, error } = await accountsTable()
      .select("id, nickname, email, site_id, token_expiry, created_at")
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    // Enriquecer con flag de token activo
    const enriched = (accounts || []).map((acc) => ({
      ...acc,
      tokenActive: new Date(acc.token_expiry) > new Date(),
    }));

    return NextResponse.json({ accounts: enriched });
  } catch (err) {
    console.error("Error listando cuentas:", err.message);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
