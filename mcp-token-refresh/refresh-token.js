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
// CONFIGURACIÓN (modifica según tu entorno)
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zqxesjcchykncxpekmbz.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ZMzOEp7m4QlwTUQOqZcmrA_cwu-Yk0U";
const MELI_CLIENT_ID = process.env.MELI_CLIENT_ID || "2657663366318591";
const MELI_CLIENT_SECRET = process.env.MELI_CLIENT_SECRET || "VgPvucR8v97fp8ruCEfb2QOyeeAdvj73";

// Cuenta de MercadoLibre a refrescar
const ACCOUNT_NICKNAME = "CORPORACIONRWCCA";

// Rutas al archivo de configuración de Cline (usa doble barra invertida en Windows)
const CONFIG_PATHS = [
    // Antigravity / Cline
    path.join(
        process.env.APPDATA || "C:/\Users/\ORLANDO/\AppData/\Roaming",
        "Antigravity/\User/\globalStorage/\saoudrizwan.claude-dev/\settings/\cline_mcp_settings.json"
    ),
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

    // Regex para reemplazar cualquier Bearer token en el archivo
    const bearerRegex = /Authorization:Bearer APP_USR-[\w-]+/g;

    if (!bearerRegex.test(content)) {
        console.warn(`⚠️  No se encontró token Bearer en: ${filePath}`);
        return false;
    }

    content = content.replace(bearerRegex, `Authorization:Bearer ${newToken}`);
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`✅ Config actualizado: ${filePath}`);
    return true;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
    console.log(`\n🔄 MCP Token Refresher — ${new Date().toISOString()}\n`);

    // 1. Obtener refresh_token de la DB
    console.log(`📡 Buscando cuenta "${ACCOUNT_NICKNAME}" en Supabase...`);
    const { data: account, error } = await supabase
        .from("meli_accounts")
        .select("refresh_token")
        .eq("nickname", ACCOUNT_NICKNAME)
        .single();

    if (error || !account) {
        throw new Error(`No se encontró la cuenta: ${error?.message || "Desconocido"}`);
    }

    console.log(`🔑 Refresh token encontrado`);

    // 2. Refrescar token en MercadoLibre
    console.log(`🌐 Solicitando nuevo access_token a MercadoLibre...`);
    const freshData = await refreshToken(account.refresh_token);

    console.log(`✅ Nuevo token recibido`);
    console.log(`   Expira en: ${freshData.expires_in} segundos (~${Math.round(freshData.expires_in / 3600)}h)`);
    console.log(`   User ID: ${freshData.user_id}`);

    // 3. Actualizar base de datos
    const newExpiry = new Date(Date.now() + freshData.expires_in * 1000).toISOString();

    console.log(`💾 Actualizando base de datos...`);
    const { error: updateError } = await supabase
        .from("meli_accounts")
        .update({
            access_token: freshData.access_token,
            refresh_token: freshData.refresh_token,
            token_expiry: newExpiry,
            updated_at: new Date().toISOString(),
        })
        .eq("nickname", ACCOUNT_NICKNAME);

    if (updateError) {
        throw new Error(`Error actualizando DB: ${updateError.message}`);
    }
    console.log(`✅ Base de datos actualizada`);

    // 4. Actualizar archivos de configuración de Cline
    console.log(`\n📝 Actualizando archivos de configuración...`);
    let updatedCount = 0;
    for (const configPath of CONFIG_PATHS) {
        const updated = updateConfigFile(configPath, freshData.access_token);
        if (updated) updatedCount++;
    }

    if (updatedCount === 0) {
        console.warn(`\n⚠️  Ningún archivo de configuración fue actualizado.`);
        console.warn(`   Verifica que las rutas en CONFIG_PATHS sean correctas.`);
    }

    console.log(`\n🎉 Proceso completado exitosamente!`);
    console.log(`   Token válido hasta: ${newExpiry}`);
    console.log(`   Archivos actualizados: ${updatedCount}`);
    console.log(`\n💡 Nota: Si Cline/Antigravity está abierto, reinícialo para que lea el nuevo token.\n`);
}

main().catch((err) => {
    console.error(`\n❌ ERROR: ${err.message}\n`);
    process.exit(1);
});
