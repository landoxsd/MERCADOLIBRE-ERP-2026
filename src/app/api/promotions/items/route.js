import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/meli-auth-helper";
import { getItemsPromotionsBatch, addItemsBatchToPromotion, removeItemFromPromotion } from "@/lib/meli-promotions";
import { cookies } from "next/headers";

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const activeAccountId = cookieStore.get("meli_erp_account")?.value;
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || activeAccountId;
    const ids = searchParams.get("ids")?.split(",").filter(Boolean) || [];

    if (!accountId) return NextResponse.json({ error: "Sin cuenta activa" }, { status: 401 });
    if (ids.length === 0) return NextResponse.json({ error: "Se requiere ?ids=" }, { status: 400 });

    const accessToken = await getValidAccessToken(accountId);
    const results = await getItemsPromotionsBatch(ids, accessToken);
    
    return NextResponse.json({ results, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Error en /api/promotions/items GET:", err.message);
    return NextResponse.json({ error: err.message || "Error del servidor" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { accountId, items, promotionId, promotionType } = await request.json();
    
    if (!accountId || !items || !promotionId || !promotionType) {
        return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }
    
    const accessToken = await getValidAccessToken(accountId);
    const results = await addItemsBatchToPromotion(items, promotionId, promotionType, accessToken);
    const success = results.filter(r => r.success).length;
    const errors = results.filter(r => !r.success);
    
    return NextResponse.json({ success, errors, results, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Error en /api/promotions/items POST:", err.message);
    return NextResponse.json({ error: err.message || "Error del servidor" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { accountId, itemIds, promotionId, promotionType } = await request.json();
    
    if (!accountId || !itemIds || !promotionId || !promotionType) {
        return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }
    
    const accessToken = await getValidAccessToken(accountId);
    const results = await Promise.allSettled(
      itemIds.map(id => removeItemFromPromotion(id, promotionId, promotionType, accessToken))
    );
    
    return NextResponse.json({
      results: results.map((r, i) => ({
        id: itemIds[i],
        success: r.status === 'fulfilled',
        error: r.reason?.message
      })),
      fetchedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error en /api/promotions/items DELETE:", err.message);
    return NextResponse.json({ error: err.message || "Error del servidor" }, { status: 500 });
  }
}
