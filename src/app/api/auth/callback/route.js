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

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth?error=${error}`, process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth?error=no_code", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  try {
    // 1. Intercambiar el código por tokens (pasando la URI personalizada si existe)
    const tokenData = await exchangeCodeForToken(code, customRedirectUri);
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
    const redirectUrl = new URL("/dashboard", process.env.NEXT_PUBLIC_APP_URL);
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
    return NextResponse.redirect(
      new URL(`/auth?error=callback_failed`, process.env.NEXT_PUBLIC_APP_URL)
    );
  }
}
