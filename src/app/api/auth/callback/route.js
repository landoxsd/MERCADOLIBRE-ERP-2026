// ================================================================
// app/api/auth/callback/route.js
// ML redirige aquí después de que el usuario autoriza la app.
// Intercambia el "code" por tokens y guarda la cuenta en la BD.
// ================================================================
import { NextResponse } from "next/server";
import { exchangeCodeForToken, getMeliUserProfile } from "@/lib/meli";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // ML puede devolver un error si el usuario cancela
  if (error) {
    console.error("ML OAuth Error:", error);
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
    // 1. Intercambiar el código por tokens
    const tokenData = await exchangeCodeForToken(code);
    const { access_token, refresh_token, expires_in, user_id } = tokenData;

    // 2. Obtener el perfil del usuario de ML
    const profile = await getMeliUserProfile(access_token);

    // 3. Calcular cuándo vence el token
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    // 4. Guardar o actualizar la cuenta en la base de datos (upsert)
    const account = await prisma.meliAccount.upsert({
      where: { meliUserId: String(user_id) },
      update: {
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry,
        nickname: profile.nickname,
        email: profile.email,
        siteId: profile.site_id,
      },
      create: {
        meliUserId: String(user_id),
        nickname: profile.nickname,
        email: profile.email,
        siteId: profile.site_id || "MLV",
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry,
      },
    });

    console.log(`✅ Cuenta conectada: ${account.nickname} (${account.meliUserId})`);

    // 5. Redirigir al dashboard con la cuenta activa
    const redirectUrl = new URL("/dashboard", process.env.NEXT_PUBLIC_APP_URL);
    redirectUrl.searchParams.set("account", account.id);

    const response = NextResponse.redirect(redirectUrl);

    // Guardar el ID de la cuenta activa en una cookie de sesión
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
