// ================================================================
// app/api/auth/callback/route.js
// ML redirige aquí después de que el usuario autoriza la app.
// Intercambia el "code" por tokens y guarda la cuenta en Supabase.
// ================================================================
import { NextResponse } from "next/server";
import { exchangeCodeForToken, getMeliUserProfile } from "@/lib/meli";
import { accountsTable } from "@/lib/supabase-admin";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const customRedirectUri = searchParams.get("redirectUri");

  const baseUrl = new URL(request.url).origin;

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth?error=${error}`, baseUrl)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth?error=no_code", baseUrl)
    );
  }

  try {
    // 1. Intercambiar el código por tokens (pasando la URI personalizada si existe)
    const requestUrl = new URL(request.url);
    const forwardedProto = request.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "");
    const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || requestUrl.host;
    const detectedRedirectUri = `${forwardedProto}://${forwardedHost}${requestUrl.pathname}`;
    const effectiveRedirectUri = customRedirectUri || (forwardedHost.includes("trycloudflare.com") || forwardedHost.includes("komid") ? detectedRedirectUri : process.env.MELI_REDIRECT_URI);

    const tokenData = await exchangeCodeForToken(code, effectiveRedirectUri);
    const { access_token, refresh_token, expires_in, user_id } = tokenData;

    // 2. Obtener el perfil del usuario de ML
    const profile = await getMeliUserProfile(access_token);

    // 3. Calcular cuándo vence el token
    const token_expiry = new Date(Date.now() + expires_in * 1000).toISOString();

    // 4. Guardar o actualizar la cuenta en Supabase (upsert)
    const { data: account, error: dbError } = await accountsTable()
      .upsert(
        {
          meli_user_id: String(user_id),
          nickname: profile.nickname,
          email: profile.email || null,
          site_id: profile.site_id || "MLV",
          access_token,
          refresh_token,
          token_expiry,
        },
        {
          onConflict: "meli_user_id",
          ignoreDuplicates: false,
        }
      )
      .select("id, nickname, meli_user_id")
      .single();

    if (dbError) throw new Error(`DB Error: ${dbError.message}`);

    console.log(`✅ Cuenta conectada: ${account.nickname} (${account.meli_user_id})`);

    // 5. Redirigir al dashboard con cookie de sesión
    const redirectUrl = new URL("/dashboard", baseUrl);
    const response = NextResponse.redirect(redirectUrl);

    response.cookies.set("active_account_id", account.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Error en callback de ML:", err.message);
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Código de Vinculación MercadoLibre</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 2rem; max-width: 560px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); text-align: center; }
    h2 { color: #38bdf8; margin-top: 0; }
    p { color: #94a3b8; line-height: 1.5; font-size: 0.95rem; }
    .code-box { background: #020617; border: 1px solid #475569; border-radius: 8px; padding: 1rem; font-family: monospace; font-size: 1.1rem; color: #22c55e; word-break: break-all; margin: 1.5rem 0; user-select: all; }
    .btn { background: #2563eb; color: #fff; border: none; border-radius: 8px; padding: 0.85rem 1.75rem; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.2s; width: 100%; }
    .btn:hover { background: #1d4ed8; }
    .copied { background: #16a34a !important; }
  </style>
</head>
<body>
  <div class="card">
    <h2>🔑 Código de Vinculación Obtenido</h2>
    <p>MercadoLibre ha generado tu código de acceso con éxito. Cópialo a continuación para completar la vinculación en tu servidor local:</p>
    <div class="code-box" id="codeBox">${code}</div>
    <button class="btn" id="copyBtn" onclick="copyCode()">📋 Copiar Código</button>
  </div>
  <script>
    function copyCode() {
      const code = document.getElementById('codeBox').innerText;
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.innerText = '✓ ¡Copiado!';
        btn.classList.add('copied');
      });
    }
  </script>
</body>
</html>`;
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

