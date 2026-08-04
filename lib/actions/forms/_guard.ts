import { createClient } from '@/lib/supabase/server'
import {
  requireMember,
  type Member,
  type ServerSupabase,
} from '@/lib/auth-helpers'

export type Manager =
  | { ok: true; supabase: ServerSupabase; member: Member }
  | { ok: false; error: string }

// forms.manage gate. Errors here are advisory UX; the database RLS on `forms`
// independently enforces the same permission, so a bypass cannot write.
export async function requireFormsManager(): Promise<Manager> {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { ok: false, error: auth.error }
  const { member } = auth

  const { data: allowed, error } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm: 'forms.manage',
  })
  if (error) return { ok: false, error: error.message }
  if (!allowed) return { ok: false, error: 'You do not have permission to manage forms' }

  return { ok: true, supabase, member }
}

export function isUniqueViolation(message: string): boolean {
  return /duplicate key value|already exists|unique constraint/i.test(message)
}
