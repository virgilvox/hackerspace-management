'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { linkSubmissionsByEmail } from './forms'
import {
  requireMember,
  requireMemberWithRole,
  logActivity,
  parseInput,
} from '@/lib/auth-helpers'
import { ADMIN_ROLES } from '@/lib/permissions'
import {
  addMemberSchema,
  updateMemberSchema,
  updateMyProfileSchema,
  discloseAffiliationsSchema,
  uuidSchema,
  bulkMemberIdsSchema,
} from '@/lib/validations'

export async function addMember(formData: {
  display_name: string
  email: string
  phone?: string
  handle?: string
  tier: string
  role: string
  joined_at?: string
  has_card_access?: boolean
}) {
  const v = parseInput(addMemberSchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member: self } = auth

  const { data, error } = await supabase
    .from('space_members')
    .insert({
      space_id: self.space_id,
      display_name: v.data.display_name,
      email: v.data.email,
      phone: v.data.phone ?? null,
      handle: v.data.handle ?? null,
      tier: v.data.tier,
      role: v.data.role,
      status: 'current',
      approved: true,
      joined_at: v.data.joined_at ?? new Date().toISOString(),
      has_card_access: v.data.has_card_access ?? false,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Associate any prior unlinked form submissions for this email with the
  // new member (admin-established email).
  if (v.data.email) {
    await linkSubmissionsByEmail(createAdminClient(), self.space_id, data.id as string, v.data.email)
  }

  revalidatePath('/members')
  return { data }
}

export async function updateMember(
  memberId: string,
  updates: {
    display_name?: string
    email?: string
    phone?: string
    handle?: string
    tier?: string
    role?: string
    status?: string
    has_card_access?: boolean
    payment_status?: string
    payment_note?: string
  },
) {
  const v = parseInput(updateMemberSchema, { memberId, ...updates })
  if (!v.ok) return { error: v.error }
  const { memberId: id, ...patch } = v.data

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member: self } = auth

  const { error } = await supabase
    .from('space_members')
    .update(patch)
    .eq('id', id)
    .eq('space_id', self.space_id)

  if (error) return { error: error.message }

  // If the email was set/corrected, associate matching prior submissions.
  if (patch.email) {
    await linkSubmissionsByEmail(createAdminClient(), self.space_id, id, patch.email)
  }

  revalidatePath('/members')
  return { success: true as const }
}

export async function approveMember(memberId: string) {
  const v = parseInput(uuidSchema, memberId)
  if (!v.ok) return { error: 'Invalid member ID' }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member: self } = auth

  const { error } = await supabase
    .from('space_members')
    .update({ status: 'current', approved: true })
    .eq('id', v.data)
    .eq('space_id', self.space_id)

  if (error) return { error: error.message }

  await logActivity(supabase, self, 'approved', 'member', v.data)

  revalidatePath('/members')
  return { success: true as const }
}

export async function bulkApproveMembers(ids: unknown) {
  const v = parseInput(bulkMemberIdsSchema, ids)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member: self } = auth

  // One batched, space-scoped update; only still-unverified rows flip.
  const { data, error } = await supabase
    .from('space_members')
    .update({ status: 'current', approved: true })
    .in('id', v.data)
    .eq('space_id', self.space_id)
    .eq('status', 'unverified')
    .select('id')
  if (error) return { error: error.message }

  await logActivity(supabase, self, 'approved', 'member', null, `${data?.length ?? 0} member(s) bulk-approved`)
  revalidatePath('/members')
  return { data: { approved: data?.length ?? 0 } }
}

/**
 * Self-edit profile fields: display_name, handle, phone, skills, interests,
 * willing_to. The privilege-escalation trigger (migration 015) blocks
 * non-privileged members from touching role/tier/status/approved/
 * has_card_access/space_id. RLS allows self-update generally.
 */
export async function updateMyProfile(updates: {
  display_name?: string
  handle?: string | null
  phone?: string | null
  bio?: string | null
  skills?: string[]
  interests?: string[]
  willing_to?: string[]
}) {
  const v = parseInput(updateMyProfileSchema, updates)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('space_members')
    .update(v.data)
    .eq('id', member.id)

  if (error) return { error: error.message }
  revalidatePath('/members')
  return { success: true as const }
}

/**
 * Disclose conflict-of-interest affiliations. Records the disclosure
 * timestamp so the dashboard can remind privileged roles to refresh
 * disclosures annually.
 */
export async function discloseAffiliations(formData: { affiliations: string[] }) {
  const v = parseInput(discloseAffiliationsSchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('space_members')
    .update({
      affiliations: v.data.affiliations,
      coi_last_disclosed_at: new Date().toISOString(),
    })
    .eq('id', member.id)

  if (error) return { error: error.message }

  await logActivity(supabase, member, 'disclosed', 'coi', member.id)

  revalidatePath('/members')
  return { success: true as const }
}

export async function removeMember(memberId: string) {
  const v = parseInput(uuidSchema, memberId)
  if (!v.ok) return { error: 'Invalid member ID' }

  const supabase = await createClient()
  // Admin-only (per RLS members_delete policy).
  const auth = await requireMemberWithRole(supabase, ['admin'], 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member: self } = auth

  const { error } = await supabase
    .from('space_members')
    .delete()
    .eq('id', v.data)
    .eq('space_id', self.space_id)

  if (error) return { error: error.message }
  revalidatePath('/members')
  return { success: true as const }
}
