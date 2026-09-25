const path = require("path");

const ROOT = path.join(__dirname, "..");

function resolveDotenv() {
  try {
    return require("dotenv");
  } catch {
    try {
      return require(path.join(ROOT, "node_modules", "dotenv"));
    } catch {
      return null;
    }
  }
}

const dotenv = resolveDotenv();
if (dotenv) {
  dotenv.config({ path: path.join(ROOT, ".env.local") });
  dotenv.config({ path: path.join(ROOT, ".env") });
  dotenv.config({ path: path.join(__dirname, ".env.local") });
}

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "❌ Faltan variables de Supabase. Configura en .env.local (raíz del proyecto):"
  );
  console.error("   SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_ROLE_KEY");
  console.error("   Plantilla: .env.local.example");
  process.exit(1);
}

module.exports = { SUPABASE_URL, SUPABASE_KEY };
