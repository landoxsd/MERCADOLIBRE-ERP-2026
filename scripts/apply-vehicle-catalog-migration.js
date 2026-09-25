require("dotenv").config();
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const migrationFile = path.join(
  __dirname,
  "..",
  "supabase",
  "migration_vehicle_catalog_2026.sql"
);

if (!connectionString) {
  console.error("BLOCKED: No DIRECT_URL or DATABASE_URL in .env");
  process.exit(1);
}

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log("Connecting to Supabase Postgres...");
    await client.connect();
    console.log("Connected.");

    const sql = fs.readFileSync(migrationFile, "utf8");
    console.log(`Applying ${path.basename(migrationFile)}...`);
    await client.query(sql);
    console.log("Migration applied.");

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('vehicle_catalog', 'sku_vehicle_fitment')
      ORDER BY table_name
    `);

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM vehicle_catalog) AS vehicle_catalog,
        (SELECT COUNT(*)::int FROM sku_vehicle_fitment) AS sku_vehicle_fitment
    `);

    console.log("Tables:", tables.rows.map((r) => r.table_name).join(", "));
    console.log("vehicle_catalog count:", counts.rows[0].vehicle_catalog);
    console.log("sku_vehicle_fitment count:", counts.rows[0].sku_vehicle_fitment);

    if (counts.rows[0].vehicle_catalog !== 15) {
      console.error(`Expected 15 rows in vehicle_catalog, got ${counts.rows[0].vehicle_catalog}`);
      process.exit(2);
    }

    console.log("SUCCESS");
  } catch (err) {
    console.error("BLOCKED:", err.code || "error", err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

run();
