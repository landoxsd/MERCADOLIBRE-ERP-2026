// ================================================================
// middleware.js (raíz del proyecto)
// Intercepta todas las peticiones para mantener las sesiones activas
// Redirige a /auth si el usuario no está autenticado en rutas protegidas
// ================================================================
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/middleware";

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Rutas que NO requieren autenticación
  const publicPaths = ["/auth", "/api/auth/login", "/api/auth/callback"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  // Mantener la sesión de Supabase fresca
  const { supabaseResponse } = createClient(request);

  // Proteger rutas del Dashboard
  if (!isPublic && pathname.startsWith("/dashboard")) {
    // Verificar si hay una cuenta activa vinculada (cookie de sesión ML)
    const activeAccount = request.cookies.get("meli_erp_account");

    if (!activeAccount) {
      const redirectUrl = new URL("/auth", request.url);
      redirectUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Excluir archivos estáticos y _next del middleware
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
