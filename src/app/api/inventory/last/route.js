import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');
    
    if (!accountId) return NextResponse.json({ error: "Falta accountId" }, { status: 400 });

    const masterPath = path.join(process.cwd(), `.audit_cache_master_${accountId}.json`);
    const inboundPath = path.join(process.cwd(), `.audit_cache_inbound_${accountId}.json`);
    
    let result = { success: true, master: null, inbound: null };

    if (fs.existsSync(masterPath)) {
      result.master = JSON.parse(fs.readFileSync(masterPath, "utf-8"));
    }
    if (fs.existsSync(inboundPath)) {
      result.inbound = JSON.parse(fs.readFileSync(inboundPath, "utf-8"));
    }

    if (!result.master && !result.inbound) {
      return NextResponse.json({ success: false, message: "No hay auditoría previa." });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
