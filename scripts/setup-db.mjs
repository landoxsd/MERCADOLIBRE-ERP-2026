// ================================================================
// scripts/setup-db.mjs
// Ejecuta el schema.sql en Supabase via Session Pooler (IPv4 compatible)
// Uso: node scripts/setup-db.mjs
// ================================================================
import postgres from "postgres";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Session Pooler de Supabase - us-east-2 - compatible con IPv4
const DB_URL =
  "postgresql://postgres.zqxesjcchykncxpekmbz:uiomlYzmvLyWOjkZ@aws-0-us-east-2.pooler.supabase.com:5432/postgres";

console.log("🔌 Conectando a Supabase (Session Pooler us-east-2)...");

const sql = postgres(DB_URL, {
  ssl: "require",
  max: 1,
  idle_timeout: 30,
});

try {
  // Leer el archivo schema.sql
  const schemaPath = join(__dirname, "../supabase/schema.sql");
  const schema = readFileSync(schemaPath, "utf8");

  console.log("📄 Ejecutando schema.sql...");

  // Ejecutar el SQL completo
  await sql.unsafe(schema);

  console.log("✅ ¡Base de datos creada exitosamente!");
  console.log("   Tablas creadas:");
  console.log("   - meli_accounts (Cuentas ML)");
  console.log("   - customers     (CRM de Clientes)");
  console.log("   - orders        (Órdenes)");
  console.log("   - order_items   (Items de Órdenes)");
  console.log("   - products      (Publicaciones)");
  console.log("   - questions     (Preguntas)");

} catch (err) {
  console.error("❌ Error:", err.message);
  process.exit(1);
} finally {
  await sql.end();
}
