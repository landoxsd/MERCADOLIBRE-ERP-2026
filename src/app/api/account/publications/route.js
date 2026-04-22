// ================================================================
// src/app/api/account/publications/route.js
// API para listar publicaciones desde la base de datos Supabase
// ================================================================
import { NextResponse } from "next/server";
import { supabaseAdmin, productsTable } from "@/lib/supabase-admin";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    if (!accountId) {
      return NextResponse.json({ error: "Falta accountId" }, { status: 400 });
    }

    const limit = 100; // Limite de productos por carga

    // 2. Obtener los productos con el filtro aplicado
    let query = productsTable().select("*", { count: "exact" }).eq("meli_account_id", accountId);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data: products, count, error } = await query
      .order("updated_at", { ascending: false })
      .range(0, limit - 1);

    if (error) throw error;

    // 2.1 Detectar Huérfanas (Cruce con internal_inventory)
    // Extraemos todos los SKUs de los productos cargados, soportando multi-sku
    const normalize = (s) => String(s || "").trim().toUpperCase();
    
    const allNormalizedSkus = [];
    products.forEach(p => {
      const pSkus = String(p.sku || "").split(/[, /]+/).map(s => normalize(s)).filter(Boolean);
      allNormalizedSkus.push(...pSkus);
    });

    let inventorySkus = new Set();
    if (allNormalizedSkus.length > 0) {
      const { data: inventoryData } = await supabaseAdmin
        .from("internal_inventory")
        .select("sku")
        .in("sku", [...new Set(allNormalizedSkus)]); // Usamos Set para únicos
      
      if (inventoryData) {
        inventorySkus = new Set(inventoryData.map(i => i.sku));
      }
    }

    // Marcamos cada producto como huérfano si NINGUNO de sus SKUs existe en el inventario
    const enrichedProducts = products.map(p => {
      const pSkus = String(p.sku || "").split(/[, /]+/).map(s => normalize(s)).filter(Boolean);
      const isMatched = pSkus.some(s => inventorySkus.has(s));
      
      return {
        ...p,
        is_orphan: !isMatched
      };
    });

    // 3. Obtener conteos por estado para las pestañas
    // ...
    const [allC, activeC, pausedC, closedC] = await Promise.all([
      supabaseAdmin.from("products").select("*", { count: "exact", head: true }).eq("meli_account_id", accountId),
      supabaseAdmin.from("products").select("*", { count: "exact", head: true }).eq("meli_account_id", accountId).eq("status", "active"),
      supabaseAdmin.from("products").select("*", { count: "exact", head: true }).eq("meli_account_id", accountId).eq("status", "paused"),
      supabaseAdmin.from("products").select("*", { count: "exact", head: true }).eq("meli_account_id", accountId).in("status", ["closed", "finished"]),
    ]);

    return NextResponse.json({
      success: true,
      products: enrichedProducts,
      count, 
      stats: {
        all: allC.count || 0,
        active: activeC.count || 0,
        paused: pausedC.count || 0,
        closed: closedC.count || 0
      }
    });

  } catch (error) {
    console.error("❌ API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
