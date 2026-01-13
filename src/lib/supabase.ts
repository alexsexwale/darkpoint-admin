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
// Service role key bypasses Row Level Security (RLS)
export const createServerClient = () => {
  const serviceRoleKey = env.supabase.serviceRoleKey;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase config:', { 
      hasUrl: !!supabaseUrl, 
      hasServiceKey: !!serviceRoleKey,
      keyPrefix: serviceRoleKey?.substring(0, 20) 
    });
    throw new Error("Supabase service role key not configured. Please set SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
    // The service role key should automatically bypass RLS
    // but we're being explicit about the headers
    global: {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  });
};

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

