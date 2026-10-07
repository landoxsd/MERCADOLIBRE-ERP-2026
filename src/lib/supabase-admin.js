// ================================================================
// lib/supabase-admin.js
// Cliente Supabase con Service Role para operaciones de servidor
// (equivalente al viejo prisma.js - úsalo en Route Handlers y Server Components)
// NUNCA exponer en el cliente/browser
// ================================================================
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const postgresUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || "postgresql://postgres:LaV65QIkQ1mujjpc6KA0RWqZBX4FqcbAcUR9NtTBOrMgfRyRRvAksmaCcZepXk7o@192.168.1.58:5432/postgres";

// Singleton PostgreSQL Pool
const globalForPg = globalThis;
export const pgPool =
  globalForPg.pgPool ??
  (postgresUrl ? new Pool({ connectionString: postgresUrl }) : null);

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pgPool;
}

// Singleton para evitar múltiples instancias en hot-reload
const globalForSupabase = globalThis;

export const supabaseAdmin =
  globalForSupabase.supabaseAdmin ??
  ((supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null);

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.supabaseAdmin = supabaseAdmin;
}

// -----------------------------------------------------------------
// Helpers tipados para las tablas principales
// -----------------------------------------------------------------

// Cuentas ML: usa PostgreSQL nativo si está disponible para máxima velocidad y evitar errores de nube
export const accountsTable = () => {
  if (pgPool) {
    return {
      select: (fields = "*") => ({
        order: async (orderCol = "created_at", { ascending = true } = {}) => {
          try {
            const res = await pgPool.query(
              `SELECT id, nickname, email, site_id, token_expiry, created_at FROM meli_accounts ORDER BY ${orderCol} ${ascending ? "ASC" : "DESC"};`
            );
            return { data: res.rows, error: null };
          } catch (e) {
            return { data: null, error: e };
          }
        },
        eq: (col, val) => ({
          single: async () => {
            try {
              const res = await pgPool.query(
                `SELECT * FROM meli_accounts WHERE ${col} = $1 LIMIT 1;`,
                [val]
              );
              return { data: res.rows[0] || null, error: null };
            } catch (e) {
              return { data: null, error: e };
            }
          },
        }),
        limit: async (n = 1) => {
          try {
            const res = await pgPool.query(
              `SELECT id, nickname FROM meli_accounts LIMIT $1;`,
              [n]
            );
            return { data: res.rows, error: null };
          } catch (e) {
            return { data: null, error: e };
          }
        },
      }),
      upsert: (record, options = {}) => ({
        select: (selectFields) => ({
          single: async () => {
            try {
              const query = `
                INSERT INTO meli_accounts (meli_user_id, nickname, email, site_id, access_token, refresh_token, token_expiry, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (meli_user_id) DO UPDATE SET
                  nickname = EXCLUDED.nickname,
                  email = EXCLUDED.email,
                  site_id = EXCLUDED.site_id,
                  access_token = EXCLUDED.access_token,
                  refresh_token = EXCLUDED.refresh_token,
                  token_expiry = EXCLUDED.token_expiry,
                  updated_at = NOW()
                RETURNING id, nickname, meli_user_id;
              `;
              const res = await pgPool.query(query, [
                String(record.meli_user_id),
                record.nickname,
                record.email || null,
                record.site_id || "MLV",
                record.access_token,
                record.refresh_token,
                record.token_expiry,
              ]);
              return { data: res.rows[0], error: null };
            } catch (e) {
              return { data: null, error: e };
            }
          },
        }),
      }),
      update: (record) => ({
        eq: async (col, val) => {
          try {
            const keys = Object.keys(record);
            const setClauses = keys.map((k, idx) => `${k} = $${idx + 2}`).join(", ");
            const values = [val, ...keys.map((k) => record[k])];
            await pgPool.query(
              `UPDATE meli_accounts SET ${setClauses}, updated_at = NOW() WHERE ${col} = $1;`,
              values
            );
            return { error: null };
          } catch (e) {
            return { error: e };
          }
        },
      }),
    };
  }
  return supabaseAdmin ? supabaseAdmin.from("meli_accounts") : null;
};


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
