// ================================================================
// scripts/setup-db-api.mjs
// Ejecuta el schema.sql usando la Management API de Supabase (HTTP)
// No requiere conexión directa a PostgreSQL - 100% compatible con IPv4
// Uso: node scripts/setup-db-api.mjs
// ================================================================
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Credenciales de Supabase
const PROJECT_REF = "zqxesjcchykncxpekmbz";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SUPABASE_KEY = "sb_publishable_ZMzOEp7m4QlwTUQOqZcmrA_cwu-Yk0U";

console.log("🌐 Usando Supabase REST API (HTTP - sin problemas IPv6)...");

// Leer el archivo schema.sql
const schemaPath = join(__dirname, "../supabase/schema.sql");
const schema = readFileSync(schemaPath, "utf8");

// Dividir el SQL en statements individuales para ejecutarlos uno por uno
// (la API REST de Supabase puede tener límites en queries muy largas)
const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

console.log(`📄 ${statements.length} statements a ejecutar...\n`);

let success = 0;
let errors = [];

for (const statement of statements) {
  if (statement.trim().length < 5) continue;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ sql: statement + ";" }),
    });

    if (res.ok) {
      success++;
    } else {
      const err = await res.text();
      errors.push({ statement: statement.substring(0, 60), error: err });
    }
  } catch (e) {
    errors.push({ statement: statement.substring(0, 60), error: e.message });
  }
}

if (errors.length === 0) {
  console.log(`✅ ¡${success} statements ejecutados exitosamente!`);
} else {
  console.log(`⚠️  ${success} exitosos, ${errors.length} errores:`);
  errors.forEach((e) => {
    console.log(`  - ${e.statement}...`);
    console.log(`    Error: ${e.error.substring(0, 100)}`);
  });
}
