/**
 * Supabase Client with Graceful Fallback
 * Falls back to in-memory store if not configured (local dev friendly)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

/**
 * Get Supabase client (or null if not configured)
 * Server-side routes prefer SUPABASE_SERVICE_ROLE_KEY to avoid RLS/anon expiration
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabase) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      key
    );
  }

  return supabase;
}

// Default export for convenience
export { supabase };
