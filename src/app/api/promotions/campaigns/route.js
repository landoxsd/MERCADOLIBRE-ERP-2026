import { NextResponse } from "next/server";
import { accountsTable } from "@/lib/supabase-admin";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { getSellerCampaigns, createSellerCampaign } from "@/lib/meli-promotions";
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

    const { data: account } = await accountsTable()
      .select("meli_user_id")
      .eq("id", accountId)
      .single();

    if (!account) {
        return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    const accessToken = await getValidAccessToken(accountId);
    const campaigns = await getSellerCampaigns(account.meli_user_id, accessToken);

    return NextResponse.json({ campaigns: campaigns.results || [], paging: campaigns.paging, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Error en /api/promotions/campaigns GET:", err.message);
    return NextResponse.json({ error: err.message || "Error del servidor" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { accountId, name, startDate, finishDate } = body;
    
    if (!accountId || !name || !startDate || !finishDate) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }
    
    const accessToken = await getValidAccessToken(accountId);
    const campaign = await createSellerCampaign(name, startDate, finishDate, accessToken);
    
    return NextResponse.json({ campaign, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Error en /api/promotions/campaigns POST:", err.message);
    return NextResponse.json({ error: err.message || "Error del servidor" }, { status: 500 });
  }
}
