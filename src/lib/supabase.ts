import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";

const supabaseUrl = env.supabase.url;
const supabaseAnonKey = env.supabase.anonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase credentials not found. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

// Client for browser-side operations
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    global: supabaseAnonKey ? { headers: { apikey: supabaseAnonKey } } : undefined,
  }
);

// Server client with service role key for admin operations
export const createServerClient = () => {
  const serviceRoleKey = env.supabase.serviceRoleKey;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service role key not configured");
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

