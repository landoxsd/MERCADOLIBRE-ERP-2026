import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/meli-auth-helper";

export async function GET(request) {
  const t1 = await getValidAccessToken('1eb437bf-33a8-42f3-9c66-93a638ab36b5');
  const r1 = await fetch('https://api.mercadolibre.com/seller-promotions/items/MLV704398079?app_version=v2', { headers: { Authorization: 'Bearer ' + t1 } });
  
  const t2 = await getValidAccessToken('cb705fa4-1d10-4cd7-a0d6-ff8822b883a6');
  const r2 = await fetch('https://api.mercadolibre.com/seller-promotions/items/MLV776976569?app_version=v2', { headers: { Authorization: 'Bearer ' + t2 } });

  return NextResponse.json({
    MLV704398079: await r1.json(),
    MLV776976569: await r2.json()
  });
}
