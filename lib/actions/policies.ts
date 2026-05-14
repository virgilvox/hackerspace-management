'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberWithRole, logActivity, parseInput } from '@/lib/auth-helpers'
import { ADMIN_ROLES } from '@/lib/permissions'
import {
  createPolicySchema,
  supersedePolicySchema,
  updatePolicyStatusSchema,
} from '@/lib/validations'

/**
 * Create a new policy at version 1, in draft status. Admin/board only.
 * To activate it, call updatePolicyStatus(id, 'active').
 */
export async function createPolicy(formData: {
  slug: string
  title: string
  section_ref?: string | null
  parent_policy_id?: string | null
  body_formal?: string
  body_plain?: string | null
  effective_at?: string | null
}) {
  const v = parseInput(createPolicySchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // Ensure (space_id, slug) is unique for v1 by checking for existing rows.
  const { data: existing } = await supabase
    .from('policies')
    .select('id')
    .eq('space_id', member.space_id)
    .eq('slug', v.data.slug)
    .limit(1)
  if (existing && existing.length > 0) {
    return { error: 'A policy with that slug already exists. Use supersedePolicy to publish a new version.' }
  }

  const { data, error } = await supabase
    .from('policies')
    .insert({
      space_id: member.space_id,
      slug: v.data.slug,
      title: v.data.title,
      section_ref: v.data.section_ref ?? null,
      parent_policy_id: v.data.parent_policy_id ?? null,
      body_formal: v.data.body_formal,
      body_plain: v.data.body_plain ?? null,
      version: 1,
      status: 'draft',
      effective_at: v.data.effective_at ?? null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await logActivity(supabase, member, 'created', 'policy', data.id, v.data.title)

  revalidatePath('/policies')
  return { data }
}

/**
 * Supersede a policy by inserting a new version. The new row has
 * prior_version_id=<old policy id>, version=<old.version+1>, status='draft'.
 * Activating it (via updatePolicyStatus -> 'active') marks the prior version
 * as 'superseded' atomically inside this function.
 */
export async function supersedePolicy(formData: {
  policyId: string
  body_formal?: string
  body_plain?: string | null
  section_ref?: string | null
  title?: string
  adopted_by_proposal_id?: string | null
  effective_at?: string | null
}) {
  const v = parseInput(supersedePolicySchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data: prior, error: priorErr } = await supabase
    .from('policies')
    .select('id, space_id, slug, title, section_ref, parent_policy_id, body_formal, body_plain, version, status')
    .eq('id', v.data.policyId)
    .single()
  if (priorErr || !prior) return { error: 'Prior policy not found' }
  if (prior.space_id !== member.space_id) return { error: 'Cross-space supersede not allowed' }

  const { data, error } = await supabase
    .from('policies')
    .insert({
      space_id: member.space_id,
      slug: prior.slug,
      title: v.data.title ?? prior.title,
      section_ref: v.data.section_ref ?? prior.section_ref,
      parent_policy_id: prior.parent_policy_id,
      body_formal: v.data.body_formal,
      body_plain: v.data.body_plain ?? null,
      version: prior.version + 1,
      prior_version_id: prior.id,
      status: 'draft',
      effective_at: v.data.effective_at ?? null,
      adopted_by_proposal_id: v.data.adopted_by_proposal_id ?? null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await logActivity(supabase, member, 'superseded', 'policy', data.id, `v${prior.version} -> v${prior.version + 1}`)

  revalidatePath('/policies')
  revalidatePath(`/policies/${prior.slug}`)
  return { data }
}

/**
 * Flip a policy's status. Activating supersedes any prior active version
 * (same slug) atomically.
 */
export async function updatePolicyStatus(policyId: string, status: string) {
  const v = parseInput(updatePolicyStatusSchema, { policyId, status })
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data: policy, error: pErr } = await supabase
    .from('policies')
    .select('id, slug, space_id, version, prior_version_id')
    .eq('id', v.data.policyId)
    .single()
  if (pErr || !policy) return { error: 'Policy not found' }
  if (policy.space_id !== member.space_id) return { error: 'Cross-space policy edit not allowed' }

  const now = new Date().toISOString()

  // When activating, supersede the prior active version (if any) of the same slug.
  if (v.data.status === 'active') {
    await supabase
      .from('policies')
      .update({ status: 'superseded' })
      .eq('space_id', member.space_id)
      .eq('slug', policy.slug)
      .eq('status', 'active')
  }

  const patch: Record<string, unknown> = { status: v.data.status }
  if (v.data.status === 'active') patch.effective_at = now

  const { error } = await supabase
    .from('policies')
    .update(patch)
    .eq('id', v.data.policyId)

  if (error) return { error: error.message }

  await logActivity(supabase, member, v.data.status, 'policy', v.data.policyId)

  revalidatePath('/policies')
  revalidatePath(`/policies/${policy.slug}`)
  return { success: true as const }
}
