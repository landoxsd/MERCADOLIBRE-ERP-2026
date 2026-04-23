import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');
    
    if (!accountId) return NextResponse.json({ error: "Falta accountId" }, { status: 400 });

    const cachePath = path.join(process.cwd(), `.audit_cache_${accountId}.json`);
    
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, "utf-8");
      return NextResponse.json(JSON.parse(data));
    } else {
      return NextResponse.json({ success: false, message: "No hay auditoría previa." });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
