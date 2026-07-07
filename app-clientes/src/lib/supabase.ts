import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) ||
  (import.meta.env?.VITE_SUPABASE_URL as string);

const supabaseAnonKey =
  (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY) ||
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string);

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
