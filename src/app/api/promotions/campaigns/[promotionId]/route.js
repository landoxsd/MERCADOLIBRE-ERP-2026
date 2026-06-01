import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { updateSellerCampaign, deleteSellerCampaign } from "@/lib/meli-promotions";

export async function PUT(request, { params }) {
  try {
    const { promotionId } = await params;
    const body = await request.json();
    const { accountId, ...fields } = body;
    
    if (!accountId) {
      return NextResponse.json({ error: "Falta accountId" }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(accountId);
    const updated = await updateSellerCampaign(promotionId, fields, accessToken);
    
    return NextResponse.json({ campaign: updated, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error(`Error en /api/promotions/campaigns/[id] PUT:`, err.message);
    return NextResponse.json({ error: err.message || "Error del servidor" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { promotionId } = await params;
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    
    if (!accountId) {
        return NextResponse.json({ error: "Falta accountId" }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(accountId);
    await deleteSellerCampaign(promotionId, accessToken);
    
    return NextResponse.json({ success: true, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error(`Error en /api/promotions/campaigns/[id] DELETE:`, err.message);
    return NextResponse.json({ error: err.message || "Error del servidor" }, { status: 500 });
  }
}
