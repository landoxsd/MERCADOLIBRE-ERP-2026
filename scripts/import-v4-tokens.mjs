// ================================================================
// scripts/import-v4-tokens.mjs
// Script para migrar los tokens de la versión 4 a la base de datos cloud.
// Uso: node --env-file=.env scripts/import-v4-tokens.mjs
// ================================================================
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; 

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Faltan variables de entorno de Supabase. Asegúrate de correr con --env-file=.env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importTokens() {
  const tokensPath = path.resolve(process.cwd(), 'V4/ml_tokens.json');
  
  if (!fs.existsSync(tokensPath)) {
    console.error("❌ No se encontró el archivo V4/ml_tokens.json");
    return;
  }

  const tokensData = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

  console.log("🚀 Iniciando migración de tokens desde V4...");

  for (const [nickname, data] of Object.entries(tokensData)) {
    console.log(`\n📦 Procesando cuenta: ${nickname}`);

    try {
      const res = await fetch(`https://api.mercadolibre.com/users/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` }
      });

      if (!res.ok) {
        console.error(`  ⚠️ Error al validar token para ${nickname}: ${res.statusText}`);
        continue;
      }

      const profile = await res.json();
      const userId = String(profile.id);

      const expiryDate = data.token_expiry_time 
        ? new Date(data.token_expiry_time * 1000).toISOString()
        : new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

      // 3. Obtener cookie del config v4 si existe
      const configPath = path.resolve(process.cwd(), 'V4/ml_config.json');
      let sessionCookie = null;
      if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const accountConfig = configData.accounts.find(a => String(a.user_id) === userId);
        if (accountConfig) sessionCookie = accountConfig.cookie;
      }

      // 4. Upsert en Supabase
      const { data: upsertData, error } = await supabase
        .from('meli_accounts')
        .upsert({
          meli_user_id: userId,
          nickname: profile.nickname,
          email: profile.email || null,
          site_id: profile.site_id || 'MLV',
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          token_expiry: expiryDate,
          is_active: true,
          session_cookie: sessionCookie // Importamos la cookie para WhatsApp scraping
        }, {
          onConflict: 'meli_user_id'
        })
        .select();

      if (error) {
        console.error(`  ❌ Error al guardar en Supabase: ${error.message}`);
      } else {
        console.log(`  ✅ Cuenta ${profile.nickname} migrada exitosamente. ID local: ${upsertData[0].id}`);
      }

    } catch (err) {
      console.error(`  ❌ Error procesando ${nickname}:`, err.message);
    }
  }

  console.log("\n✨ Proceso de migración finalizado.");
}

importTokens();
