// ================================================================
// utils/supabase/client.js
// Cliente de Supabase para Client Components ('use client')
// Se instancia una vez por sesión en el navegador
// ================================================================
import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
