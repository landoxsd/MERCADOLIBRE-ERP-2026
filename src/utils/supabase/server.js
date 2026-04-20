// ================================================================
// utils/supabase/server.js
// Cliente de Supabase para Server Components y Route Handlers
// Maneja las cookies de sesión de forma segura en el servidor
// ================================================================
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignorar si se llama desde un Server Component sin capacidad de escritura
          }
        },
      },
    }
  );
};
