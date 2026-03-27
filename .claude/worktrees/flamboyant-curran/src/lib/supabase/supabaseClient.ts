// src/lib/supabase/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Singleton Supabase client for browser-side usage.
 * Returns null if env vars are not configured (graceful degradation).
 */
export const supabase =
    supabaseUrl && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey)
        : null;

export function isSupabaseConfigured(): boolean {
    return supabase !== null;
}
