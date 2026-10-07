const fs = require('fs');
const { Pool } = require('C:/Users/ORLANDO/.gemini/antigravity/brain/504da43c-bf62-482e-90e7-3b8ee80d5518/scratch/node_modules/pg');

const clientId = '2657663366318591';
const clientSecret = 'VgPvucR8v97fp8ruCEfb2QOyeeAdvj73';
const redirectUri = 'https://mercadolibre-erp.vercel.app/api/auth/callback';
const connStr = 'postgresql://postgres:LaV65QIkQ1mujjpc6KA0RWqZBX4FqcbAcUR9NtTBOrMgfRyRRvAksmaCcZepXk7o@192.168.1.58:5432/postgres';

const pool = new Pool({ connectionString: connStr });

async function exchangeAndSave(inputCode) {
  let cleanCode = inputCode.trim();
  const match = cleanCode.match(/TG-[a-zA-Z0-9_-]+/);
  if (match) {
    cleanCode = match[0];
  }
  console.log(`\n1. Intercambiando código con MercadoLibre: ${cleanCode}`);
  const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: cleanCode,
      redirect_uri: redirectUri
    })
  });


  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(`Error de MercadoLibre: ${JSON.stringify(tokenData)}`);
  }

  const { access_token, refresh_token, expires_in, user_id } = tokenData;
  console.log(`✅ Tokens recibidos con éxito para User ID: ${user_id}`);

  console.log(`2. Consultando perfil del usuario en MercadoLibre...`);
  const profileRes = await fetch('https://api.mercadolibre.com/users/me', {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  const profile = await profileRes.json();
  console.log(`✅ Perfil obtenido: ${profile.nickname} (${profile.email || 'sin email'})`);

  const token_expiry = new Date(Date.now() + expires_in * 1000).toISOString();

  console.log(`3. Guardando cuenta en PostgreSQL local (Dell R630 @ 192.168.1.58:5432)...`);
  const query = `
    INSERT INTO meli_accounts (
      meli_user_id, nickname, email, site_id, access_token, refresh_token, token_expiry, updated_at
    )
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

  const dbRes = await pool.query(query, [
    String(user_id),
    profile.nickname,
    profile.email || null,
    profile.site_id || 'MLV',
    access_token,
    refresh_token,
    token_expiry
  ]);

  console.log(`\n🎉 ¡CUENTA VINCULADA Y GUARDADA CON ÉXITO!`);
  console.log(`ID en Base de Datos: ${dbRes.rows[0].id}`);
  console.log(`Nickname: ${dbRes.rows[0].nickname}`);
  console.log(`Meli User ID: ${dbRes.rows[0].meli_user_id}`);
}

const authUrl = `https://auth.mercadolibre.com.ve/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

const codeArg = process.argv[2];
if (!codeArg) {
  console.log(`\n======================================================`);
  console.log(`  VINCULADOR DIRECTO DE CUENTAS MERCADOLIBRE → DELL R630`);
  console.log(`======================================================\n`);
  console.log(`Paso 1: Abre este enlace en tu navegador para autorizar:`);
  console.log(`\n👉 ${authUrl}\n`);
  console.log(`Paso 2: Cuando autorices, copia el código que aparece al final`);
  console.log(`de la URL (empieza con TG-...) y corre:`);
  console.log(`\nnode vincular_cuenta.js "TG-TU_CODIGO_AQUI"\n`);
  process.exit(0);
}

exchangeAndSave(codeArg)
  .catch(err => {
    console.error('\n❌ ERROR:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await pool.end(); } catch (e) {}
  });
