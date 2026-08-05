import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/** Shape `@supabase/ssr` passes to `setAll` (typing lost to the ssr/js version drift). */
type CookiesToSet = { name: string; value: string; options: CookieOptions }[]

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 *
 * The explicit `SupabaseClient<Database>` return annotation is load-bearing:
 * `@supabase/ssr`'s `createServerClient` still returns supabase-js's older
 * 3-generic client shape, which — against the installed 5-generic supabase-js —
 * collapses the schema to `never` (every `.from().select()` row becomes `never`).
 * Re-asserting `SupabaseClient<Database>` here lets the client recompute its
 * schema from `Database`, restoring full row typing across every caller.
 */
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  )

  // Single documented boundary cast: `createServerClient` returns the older
  // 3-generic client shape; re-assert the 5-generic `SupabaseClient<Database>`
  // so callers get full row typing. This is the ONE place the impedance
  // mismatch is bridged.
  return client as unknown as SupabaseClient<Database>
}
