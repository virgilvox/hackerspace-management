import { createClient } from '@/lib/supabase/server'
import {
  requireMember,
  type Member,
  type ServerSupabase,
} from '@/lib/auth-helpers'

export type Gate =
  | { ok: true; supabase: ServerSupabase; member: Member }
  | { ok: false; error: string }

export async function requirePermission(
  perm: 'classes.manage' | 'classes.instruct',
): Promise<Gate> {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { ok: false, error: auth.error }
  const { member } = auth
  const { data: allowed, error } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm,
  })
  if (error) return { ok: false, error: error.message }
  if (!allowed) {
    return {
      ok: false,
      error:
        perm === 'classes.manage'
          ? 'You do not have permission to manage classes'
          : 'You do not have permission to run classes',
    }
  }
  return { ok: true, supabase, member }
}
