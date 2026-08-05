'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberWithRole, parseInput } from '@/lib/auth-helpers'
import { createInviteSchema, updateInviteSchema, uuidSchema } from '@/lib/validations'
import { canAssignInviteRole } from '@/lib/invite-logic'

const INVITE_ADMIN_ROLES = ['admin', 'board'] as const

// Whether `next` lets the invite be redeemed more times than `current`.
// null = unlimited, which is wider than any finite cap.
function widensUses(current: number | null, next: number | null): boolean {
  if (next === null) return current !== null
  if (current === null) return false
  return next > current
}

// Whether `next` pushes the expiry later than `current`.
// null = never expires, which is later than any date.
function extendsExpiry(current: string | null, next: string | null): boolean {
  if (next === null) return current !== null
  if (current === null) return false
  return new Date(next).getTime() > new Date(current).getTime()
}

function generateInviteCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

export async function createInvite(input: {
  code?: string
  label?: string | null
  expires_at?: string | null
  max_uses?: number | null
  is_enabled?: boolean
  role?: 'admin' | 'board' | 'treasurer' | 'member' | 'associate'
}) {
  const v = parseInput(createInviteSchema, input)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, INVITE_ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  if (!canAssignInviteRole(member.role, v.data.role)) {
    return { error: `You cannot create an invite that grants the "${v.data.role}" role.` }
  }

  // Generate a unique code if not provided. Try up to 5 times in case of collision.
  let code = v.data.code
  if (!code) {
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateInviteCode()
      const { data: existing } = await supabase.from('space_invites').select('id').eq('code', code).maybeSingle()
      if (!existing) break
      code = undefined
    }
    if (!code) return { error: 'Could not generate a unique invite code; try again.' }
  }

  const { data, error } = await supabase
    .from('space_invites')
    .insert({
      space_id: member.space_id,
      code,
      label: v.data.label ?? null,
      expires_at: v.data.expires_at ?? null,
      max_uses: v.data.max_uses ?? null,
      is_enabled: v.data.is_enabled ?? true,
      role: v.data.role,
      created_by: member.id,
    })
    .select('id, code')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/customize')
  return { id: data.id, code: data.code }
}

export async function updateInvite(inviteId: string, updates: {
  label?: string | null
  expires_at?: string | null
  max_uses?: number | null
  is_enabled?: boolean
  role?: 'admin' | 'board' | 'treasurer' | 'member' | 'associate'
}) {
  const idCheck = parseInput(uuidSchema, inviteId)
  if (!idCheck.ok) return { error: 'Invalid invite ID' }
  const v = parseInput(updateInviteSchema, updates)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, INVITE_ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // Load the current row (scoped to the caller's space) so the privilege guard
  // applies even when the payload omits `role`. Setting the role, re-enabling,
  // widening max_uses, or extending expiry all (re-)distribute whatever role the
  // invite already grants — so a board member must not be able to re-arm an
  // exhausted/disabled admin invite they could never have minted.
  const { data: existing, error: loadError } = await supabase
    .from('space_invites')
    .select('role, is_enabled, max_uses, expires_at')
    .eq('id', idCheck.data)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (loadError) return { error: loadError.message }
  if (!existing) return { error: 'Invite not found' }

  // The role the invite grants after this update: the explicit new role, or the
  // current role when the payload leaves it untouched.
  const effectiveRole = v.data.role ?? existing.role
  const rearms =
    v.data.role !== undefined ||
    (v.data.is_enabled === true && existing.is_enabled !== true) ||
    (v.data.max_uses !== undefined && widensUses(existing.max_uses, v.data.max_uses)) ||
    (v.data.expires_at !== undefined && extendsExpiry(existing.expires_at, v.data.expires_at))

  if (rearms && !canAssignInviteRole(member.role, effectiveRole)) {
    return { error: `You cannot modify an invite that grants the "${effectiveRole}" role.` }
  }

  const patch: Record<string, unknown> = {}
  if (v.data.label      !== undefined) patch.label = v.data.label
  if (v.data.expires_at !== undefined) patch.expires_at = v.data.expires_at
  if (v.data.max_uses   !== undefined) patch.max_uses = v.data.max_uses
  if (v.data.is_enabled !== undefined) patch.is_enabled = v.data.is_enabled
  if (v.data.role       !== undefined) patch.role = v.data.role

  const { error } = await supabase
    .from('space_invites')
    .update(patch)
    .eq('id', idCheck.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/customize')
  return { success: true as const }
}

export async function deleteInvite(inviteId: string) {
  const v = parseInput(uuidSchema, inviteId)
  if (!v.ok) return { error: 'Invalid invite ID' }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ['admin'], 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('space_invites')
    .delete()
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/customize')
  return { success: true as const }
}
