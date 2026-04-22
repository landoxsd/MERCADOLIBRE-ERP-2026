// ================================================================
// app/api/auth/login/route.js
// Inicia el flujo de autenticación OAuth de Mercado Libre.
// Genera un "state" único y redirige al usuario a la página de ML.
// Compatible con el flujo "Delegar Login" (type=delegate en query).
// ================================================================
import { NextResponse } from "next/server";
import { getMeliAuthUrl } from "@/lib/meli";
import crypto from "crypto";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "login"; 
  const customRedirectUri = searchParams.get("redirectUri");

  // State aleatorio para prevenir CSRF
  const state = crypto.randomBytes(16).toString("hex");

  // Construir la URL de autorización de ML (pasando la URI personalizada si existe)
  const authUrl = getMeliAuthUrl(state, customRedirectUri);

  if (mode === "delegate") {
    // En modo "Delegar Login": devolver la URL para que el usuario la comparta
    return NextResponse.json({ authUrl, state });
  }

  // En modo normal: redirigir directamente al navegador
  return NextResponse.redirect(authUrl);
}
