import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tables } from '@/types/database'
import type { ZodSchema } from 'zod'
import { ACTIVE_STATUSES, hasRole, type Role } from '@/lib/permissions'

/**
 * Loose Supabase client type for shared helpers.
 *
 * The fully-typed client (`Awaited<ReturnType<typeof createClient>>` from
 * `lib/supabase/server.ts`) has a 3-generic shape that the supabase-js
 * version drift makes painful to assign across module boundaries. We use
 * a wide type at the helper boundary so callers with the precise client
 * can pass it through; inside the helper, schema-level type checking on
 * `.from(table).insert(row)` is relaxed. Helpers stay tiny and unit-tested,
 * so the precision loss is acceptable. Action bodies keep full typing
 * because they use the client returned by `createClient()` directly.
 */
export type ServerSupabase = SupabaseClient<any, any, any>

/** Projection of `space_members` that server actions consume. */
export type Member = Pick<
  Tables<'space_members'>,
  'id' | 'space_id' | 'user_id' | 'role' | 'display_name' | 'handle'
>

/**
 * Result types: a `ok: boolean` discriminator narrows reliably under
 * strict TypeScript. Always `if (!result.ok) return { error: result.error }`.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }
export type MemberResult = { ok: true; member: Member } | { ok: false; error: string }

/**
 * Returns the active member row for the current authenticated user, or
 * `null` if the user is not authenticated or has no active membership.
 *
 * "Active" means one of ACTIVE_STATUSES (current, unverified, late).
 * Inactive members are blocked from all server actions.
 */
export async function getAuthMember(supabase: ServerSupabase): Promise<Member | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('space_members')
    .select('id, space_id, user_id, role, display_name, handle')
    .eq('user_id', user.id)
    .in('status', ACTIVE_STATUSES as unknown as string[])
    .single()

  return (data as Member | null) ?? null
}

/**
 * Like getAuthMember but in MemberResult shape so callers can early-return
 * on `!result.ok`.
 */
export async function requireMember(supabase: ServerSupabase): Promise<MemberResult> {
  const member = await getAuthMember(supabase)
  if (!member) return { ok: false, error: 'Not authenticated or no active membership' }
  return { ok: true, member }
}

/**
 * Returns the member iff they hold one of the allowed roles.
 * Otherwise an error result.
 */
export async function requireMemberWithRole(
  supabase: ServerSupabase,
  allowed: readonly Role[],
  errorLabel = 'Insufficient permissions',
): Promise<MemberResult> {
  const r = await requireMember(supabase)
  if (!r.ok) return r
  if (!hasRole(r.member.role, allowed)) {
    return { ok: false, error: errorLabel }
  }
  return r
}

/**
 * Runs a Zod schema against an input. Returns a discriminated Result
 * so callers can `if (!v.ok) return { error: v.error }` and have `v.data`
 * narrowed to T.
 */
export function parseInput<T>(schema: ZodSchema<T>, input: unknown): Result<T> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' }
  }
  return { ok: true, data: parsed.data }
}

/**
 * Insert a row into activity_log. Errors are swallowed: the log is
 * advisory and should never block the primary action.
 */
export async function logActivity(
  supabase: ServerSupabase,
  member: Pick<Member, 'space_id' | 'user_id' | 'display_name'>,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: string | null,
): Promise<void> {
  await supabase.from('activity_log').insert({
    space_id: member.space_id,
    user_id: member.user_id,
    display_name: member.display_name,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details ?? null,
  })
}
