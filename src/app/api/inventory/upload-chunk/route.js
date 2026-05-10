import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req) {
  try {
    const { items, clear } = await req.json();

    if (clear) {
      await supabaseAdmin.from("internal_inventory").delete().neq("sku", "EMPTY_PLACEHOLDER");
    }

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: "No se recibieron items válidos" }, { status: 400 });
    }

    // Guardar el lote en Supabase
    const { error: upsertError } = await supabaseAdmin
      .from("internal_inventory")
      .upsert(items, { onConflict: "sku" });

    if (upsertError) {
      console.error("Error en upsert de lote:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: items.length });
  } catch (error) {
    console.error("❌ Upload Chunk Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
