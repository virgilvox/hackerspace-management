import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Browser Supabase client. The explicit `SupabaseClient<Database>` return type
 * mirrors `lib/supabase/server.ts`: `@supabase/ssr` returns supabase-js's older
 * 3-generic client shape, which — against the installed 5-generic supabase-js —
 * collapses the schema to `never`, erasing row typing for every caller. The one
 * boundary cast re-asserts `SupabaseClient<Database>` so callers get typed rows.
 */
export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ) as unknown as SupabaseClient<Database>
}
