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
export const productsTable = () => {
  if (pgPool) {
    const createQueryBuilder = () => {
      const filters = [];
      const params = [];
      let orderBy = "updated_at DESC";
      let limitClause = "";
      let offsetClause = "";

      const builder = {
        select: (fields = "*") => builder,
        eq: (col, val) => {
          params.push(val);
          filters.push(`${col} = $${params.length}`);
          return builder;
        },
        or: (orStr) => {
          const parts = orStr.split(",").map(part => {
            const [c, op, v] = part.split(".");
            if (op === "ilike") {
              const cleanV = v.replace(/^%/, "").replace(/%$/, "");
              params.push(`%${cleanV}%`);
              return `${c} ILIKE $${params.length}`;
            }
            return null;
          }).filter(Boolean);
          if (parts.length > 0) {
            filters.push(`(${parts.join(" OR ")})`);
          }
          return builder;
        },
        order: (col, { ascending = true } = {}) => {
          orderBy = `${col} ${ascending ? "ASC" : "DESC"}`;
          return builder;
        },
        range: (from, to) => {
          const limit = to - from + 1;
          limitClause = `LIMIT ${limit}`;
          offsetClause = `OFFSET ${from}`;
          return builder;
        },
        then: async (resolve, reject) => {
          try {
            const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
            const countRes = await pgPool.query(`SELECT count(*) FROM products ${whereClause};`, params);
            const totalCount = parseInt(countRes.rows[0].count, 10);

            const dataQuery = `SELECT * FROM products ${whereClause} ORDER BY ${orderBy} ${limitClause} ${offsetClause};`;
            const dataRes = await pgPool.query(dataQuery, params);

            resolve({ data: dataRes.rows, count: totalCount, error: null });
          } catch (e) {
            console.error("Error in productsTable().select:", e);
            resolve({ data: [], count: 0, error: e });
          }
        }
      };
      return builder;
    };

    return {
      select: (fields = "*", options = {}) => createQueryBuilder().select(fields),
      upsert: async (records, options = {}) => {
        try {
          const list = Array.isArray(records) ? records : [records];
          if (list.length === 0) return { data: [], error: null };

          const client = await pgPool.connect();
          try {
            await client.query("BEGIN");
            for (const item of list) {
              const query = `
                INSERT INTO products (
                  id, meli_item_id, meli_account_id, title, status, price, cost_price,
                  available_qty, permalink, thumbnail, category_id, domain_id, sku,
                  attributes, raw_data, last_updated_meli, sold_quantity, visits_count, updated_at
                ) VALUES (
                  gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW()
                )
                ON CONFLICT (meli_item_id) DO UPDATE SET
                  meli_account_id = COALESCE(EXCLUDED.meli_account_id, products.meli_account_id),
                  title = EXCLUDED.title,
                  status = EXCLUDED.status,
                  price = EXCLUDED.price,
                  cost_price = COALESCE(EXCLUDED.cost_price, products.cost_price),
                  available_qty = EXCLUDED.available_qty,
                  permalink = EXCLUDED.permalink,
                  thumbnail = EXCLUDED.thumbnail,
                  category_id = EXCLUDED.category_id,
                  domain_id = EXCLUDED.domain_id,
                  sku = EXCLUDED.sku,
                  attributes = EXCLUDED.attributes,
                  raw_data = EXCLUDED.raw_data,
                  last_updated_meli = EXCLUDED.last_updated_meli,
                  sold_quantity = EXCLUDED.sold_quantity,
                  visits_count = EXCLUDED.visits_count,
                  updated_at = NOW();
              `;
              await client.query(query, [
                item.meli_item_id,
                item.meli_account_id,
                item.title,
                item.status,
                item.price || 0,
                item.cost_price || null,
                item.available_qty || 0,
                item.permalink || null,
                item.thumbnail || null,
                item.category_id || null,
                item.domain_id || null,
                item.sku || null,
                item.attributes ? JSON.stringify(item.attributes) : null,
                item.raw_data ? JSON.stringify(item.raw_data) : null,
                item.last_updated_meli || null,
                item.sold_quantity || 0,
                item.visits_count || 0,
              ]);
            }
            await client.query("COMMIT");
            return { data: list, error: null };
          } catch (err) {
            await client.query("ROLLBACK");
            throw err;
          } finally {
            client.release();
          }
        } catch (e) {
          console.error("Error in productsTable().upsert:", e);
          return { data: null, error: e };
        }
      },
      update: (record) => ({
        eq: async (col, val) => {
          try {
            const keys = Object.keys(record);
            const setClauses = keys.map((k, idx) => `${k} = $${idx + 2}`).join(", ");
            const values = [val, ...keys.map((k) => record[k])];
            await pgPool.query(
              `UPDATE products SET ${setClauses}, updated_at = NOW() WHERE ${col} = $1;`,
              values
            );
            return { error: null };
          } catch (e) {
            return { error: e };
          }
        }
      })
    };
  }
  return supabaseAdmin ? supabaseAdmin.from("products") : null;
};

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
