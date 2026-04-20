// ================================================================
// lib/supabase-admin.js
// Cliente Supabase con Service Role para operaciones de servidor
// (equivalente al viejo prisma.js - úsalo en Route Handlers y Server Components)
// NUNCA exponer en el cliente/browser
// ================================================================
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan variables de entorno de Supabase");
}

// Singleton para evitar múltiples instancias en hot-reload
const globalForSupabase = globalThis;

export const supabaseAdmin =
  globalForSupabase.supabaseAdmin ??
  createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.supabaseAdmin = supabaseAdmin;
}

// -----------------------------------------------------------------
// Helpers tipados para las tablas principales
// -----------------------------------------------------------------

// Cuentas ML
export const accountsTable = () => supabaseAdmin.from("meli_accounts");

// Órdenes
export const ordersTable = () => supabaseAdmin.from("orders");

// Items de órdenes
export const orderItemsTable = () => supabaseAdmin.from("order_items");

// Productos / Publicaciones
export const productsTable = () => supabaseAdmin.from("products");

// Preguntas
export const questionsTable = () => supabaseAdmin.from("questions");

// Clientes CRM
export const customersTable = () => supabaseAdmin.from("customers");
