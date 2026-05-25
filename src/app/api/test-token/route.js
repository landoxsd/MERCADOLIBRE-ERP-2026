import { NextResponse } from "next/server";
import { accountsTable } from "@/lib/supabase-admin";
import { getValidAccessToken } from "@/lib/meli-auth-helper";

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const seller_id = searchParams.get("seller_id");
    const nickname = searchParams.get("nickname");

    const { data } = await accountsTable().select("id").limit(1);
    const token = await getValidAccessToken(data[0].id);

    let url = `https://api.mercadolibre.com/sites/MLV/search?`;
    if (seller_id) url += `seller_id=${seller_id}`;
    if (nickname) url += `nickname=${nickname}`;

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json();
    return NextResponse.json({ status: res.status, url, json });
}
