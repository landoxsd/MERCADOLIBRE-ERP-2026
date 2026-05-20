// =============================================================================
// MCP MercadoLibre Token Refresher
// =============================================================================
// Este script refresca automáticamente el access_token de MercadoLibre
// y actualiza el archivo de configuración de Cline/Antigravity.
//
// Uso:
//   node refresh-token.js
//
// Configuración:
//   Ajusta las variables ACCOUNT_NICKNAME y CONFIG_PATH abajo según tu entorno.
// =============================================================================

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// CARGAR VARIABLES DE ENTORNO LOCALES (.env)
// ---------------------------------------------------------------------------
try {
    const envPath = path.join(__dirname, "..", ".env");
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf-8");
        envContent.split(/\r?\n/).forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) return;
            const match = trimmed.match(/^([\w.\-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || "";
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.substring(1, value.length - 1);
                } else if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.substring(1, value.length - 1);
                }
                process.env[key] = value;
            }
        });
        console.log("ℹ️  Variables de entorno cargadas desde .env de forma nativa");
    }
} catch (e) {
    console.warn("⚠️  Error al cargar .env:", e.message);
}

// ---------------------------------------------------------------------------
// CONFIGURACIÓN
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zqxesjcchykncxpekmbz.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const MELI_CLIENT_ID = process.env.MELI_CLIENT_ID || "2657663366318591";
const MELI_CLIENT_SECRET = process.env.MELI_CLIENT_SECRET || "VgPvucR8v97fp8ruCEfb2QOyeeAdvj73";

// Cuenta de MercadoLibre a refrescar (dejar vacío "" para refrescar TODAS)
const ACCOUNT_NICKNAME = process.env.ACCOUNT_NICKNAME || "";

// Rutas al archivo de configuración de Cline/Claude/Desktop (usa doble barra invertida en Windows)
const CONFIG_PATHS = [
    // Antigravity / Cline (Entorno del Agente)
    path.join(
        process.env.APPDATA || "C:/Users/ORLANDO/AppData/Roaming",
        "Antigravity/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"
    ),
    // Antigravity Agent Configuration
    path.join(
        process.env.USERPROFILE || "C:/Users/ORLANDO",
        ".gemini",
        "antigravity",
        "mcp_config.json"
    ),
    // Gemini IDE Configuration (Active Environment)
    path.join(
        process.env.USERPROFILE || "C:/Users/ORLANDO",
        ".gemini",
        "config",
        "mcp_config.json"
    ),
    // Claude Desktop (Configuración global del usuario)
    path.join(
        process.env.APPDATA || "C:/Users/ORLANDO/AppData/Roaming",
        "Claude",
        "claude_desktop_config.json"
    ),
    // Copia local mcp_config_BACKUP.json
    path.join(__dirname, "..", "mcp_config_BACKUP.json"),
    // Backup en el proyecto
    path.join(__dirname, "..", "claude_desktop_config_snippet.json"),
];

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function refreshToken(refreshToken) {
    const params = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: MELI_CLIENT_ID,
        client_secret: MELI_CLIENT_SECRET,
        refresh_token: refreshToken,
    });

    const res = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
        },
        body: params.toString(),
    });

    const data = await res.json();

    if (data.error) {
        throw new Error(`ML API Error: ${data.error} - ${data.message}`);
    }

    return data;
}

function updateConfigFile(filePath, newToken) {
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  Archivo no encontrado: ${filePath}`);
        return false;
    }

    let content = fs.readFileSync(filePath, "utf-8");

    // Regex para reemplazar cualquier Bearer token en el archivo (soporta formato CLI 'Authorization:Bearer APP_USR-...' y formato JSON '"Authorization": "Bearer APP_USR-..."')
    const bearerRegex = /(Authorization(?:\":\s*\"|\s*:\s*)Bearer\s+)(APP_USR-[\w\-]+)/gi;

    if (!bearerRegex.test(content)) {
        console.warn(`⚠️  No se encontró token Bearer en: ${filePath}`);
        return false;
    }

    // Resetear regex para la operación de reemplazo
    bearerRegex.lastIndex = 0;
    content = content.replace(bearerRegex, `$1${newToken}`);
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`✅ Config actualizado: ${filePath}`);
    return true;
}

async function refreshAccount(account) {
    console.log(`\n📡 Refrescando cuenta "${account.nickname}" (ID: ${account.meli_user_id})...`);

    try {
        // 1. Refrescar token en MercadoLibre
        const freshData = await refreshToken(account.refresh_token);

        console.log(`✅ Nuevo token recibido`);
        console.log(`   Expira en: ${freshData.expires_in} segundos (~${Math.round(freshData.expires_in / 3600)}h)`);
        console.log(`   User ID: ${freshData.user_id}`);

        // 2. Actualizar base de datos
        const newExpiry = new Date(Date.now() + freshData.expires_in * 1000).toISOString();

        const { error: updateError } = await supabase
            .from("meli_accounts")
            .update({
                access_token: freshData.access_token,
                refresh_token: freshData.refresh_token,
                token_expiry: newExpiry,
                updated_at: new Date().toISOString(),
            })
            .eq("id", account.id);

        if (updateError) {
            throw new Error(`Error actualizando DB: ${updateError.message}`);
        }
        console.log(`💾 Base de datos actualizada`);

        return { success: true, token: freshData.access_token, expiry: newExpiry };
    } catch (err) {
        console.error(`❌ Error refrescando ${account.nickname}: ${err.message}`);
        return { success: false, error: err.message };
    }
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
    console.log(`\n🔄 MCP Token Refresher — ${new Date().toISOString()}\n`);

    // 1. Obtener cuentas a refrescar
    let query = supabase.from("meli_accounts").select("id, meli_user_id, nickname, refresh_token");

    if (ACCOUNT_NICKNAME) {
        console.log(`🔍 Modo: una sola cuenta (${ACCOUNT_NICKNAME})`);
        query = query.eq("nickname", ACCOUNT_NICKNAME);
    } else {
        console.log(`🔍 Modo: TODAS las cuentas`);
    }

    const { data: accounts, error } = await query;

    if (error) {
        throw new Error(`Error consultando cuentas: ${error.message}`);
    }

    if (!accounts || accounts.length === 0) {
        throw new Error("No se encontraron cuentas para refrescar");
    }

    console.log(`📋 Cuentas encontradas: ${accounts.length}\n`);

    // 2. Refrescar cada cuenta
    const results = [];
    let primaryToken = null;

    for (const account of accounts) {
        const result = await refreshAccount(account);
        results.push({ nickname: account.nickname, ...result });
        if (result.success && !primaryToken) {
            primaryToken = result.token;
        }
    }

    // 3. Actualizar archivos de configuración de Cline (con el primer token válido)
    if (primaryToken) {
        console.log(`\n📝 Actualizando archivos de configuración...`);
        let updatedCount = 0;
        for (const configPath of CONFIG_PATHS) {
            const updated = updateConfigFile(configPath, primaryToken);
            if (updated) updatedCount++;
        }
        console.log(`   Archivos actualizados: ${updatedCount}`);
    } else {
        console.warn(`\n⚠️  No se pudo obtener ningún token válido. Configuración NO actualizada.`);
    }

    // 4. Resumen
    console.log(`\n📊 RESUMEN:`);
    const ok = results.filter(r => r.success).length;
    const fail = results.filter(r => !r.success).length;
    console.log(`   ✅ Exitosas: ${ok}`);
    console.log(`   ❌ Fallidas: ${fail}`);

    for (const r of results) {
        const icon = r.success ? "✅" : "❌";
        console.log(`   ${icon} ${r.nickname}${r.error ? ` — ${r.error}` : ""}`);
    }

    console.log(`\n🎉 Proceso completado!`);
    console.log(`\n💡 Nota: Si Cline/Antigravity está abierto, reinícialo para que lea el nuevo token.\n`);
}

main().catch((err) => {
    console.error(`\n❌ ERROR: ${err.message}\n`);
    process.exit(1);
});
