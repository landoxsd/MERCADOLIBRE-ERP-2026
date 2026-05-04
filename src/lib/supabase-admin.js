// ================================================================
// lib/supabase-admin.js
// Cliente Supabase con Service Role para operaciones de servidor
// (equivalente al viejo prisma.js - úsalo en Route Handlers y Server Components)
// NUNCA exponer en el cliente/browser
// ================================================================
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Faltan variables de entorno de Supabase (SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)");
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

// -----------------------------------------------------------------
// Storage Helpers (Puente para Imágenes)
// -----------------------------------------------------------------
export async function uploadImageToStorage(fileBuffer, filename) {
  // Asegurar un nombre único para evitar colisiones en caché
  const uniqueFilename = `${Date.now()}_${filename}`;
  const bucketName = "product-photos";

  const { data, error } = await supabaseAdmin
    .storage
    .from(bucketName)
    .upload(uniqueFilename, fileBuffer, {
      contentType: filename.toLowerCase().endsWith('png') ? 'image/png' : 'image/jpeg',
      upsert: true
    });

  if (error) {
    throw new Error(`Error subiendo a Supabase Storage: ${error.message}`);
  }

  // Obtener URL pública
  const { data: publicUrlData } = supabaseAdmin
    .storage
    .from(bucketName)
    .getPublicUrl(uniqueFilename);

  return publicUrlData.publicUrl;
}
