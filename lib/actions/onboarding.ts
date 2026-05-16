'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember, requireMemberWithRole, parseInput } from '@/lib/auth-helpers'
import {
  createOnboardingStepSchema,
  updateOnboardingStepSchema,
  uuidSchema,
} from '@/lib/validations'

const ONBOARDING_ADMIN_ROLES = ['admin', 'board'] as const

// --- Admin: manage steps -----------------------------------------------------

export async function createOnboardingStep(input: {
  step_type: 'welcome' | 'code_of_conduct' | 'profile' | 'payment' | 'content'
  title: string
  body?: string | null
  config?: Record<string, unknown>
  is_enabled?: boolean
  is_required?: boolean
  sort_order?: number
}) {
  const v = parseInput(createOnboardingStepSchema, input)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ONBOARDING_ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // Custom steps get a generated key; built-in keys are reserved for the
  // seeded rows so they stay addressable.
  const stepKey = `custom-${crypto.randomUUID().slice(0, 12)}`

  const { data, error } = await supabase
    .from('space_onboarding_steps')
    .insert({
      space_id: member.space_id,
      step_key: stepKey,
      step_type: v.data.step_type,
      title: v.data.title,
      body: v.data.body ?? null,
      config: v.data.config ?? {},
      is_enabled: v.data.is_enabled ?? true,
      is_required: v.data.is_required ?? false,
      is_system: false,
      sort_order: v.data.sort_order ?? 100,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { id: data.id }
}

export async function updateOnboardingStep(stepId: string, updates: {
  title?: string
  body?: string | null
  config?: Record<string, unknown>
  is_enabled?: boolean
  is_required?: boolean
  sort_order?: number
}) {
  const idCheck = parseInput(uuidSchema, stepId)
  if (!idCheck.ok) return { error: 'Invalid step ID' }
  const v = parseInput(updateOnboardingStepSchema, updates)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ONBOARDING_ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const patch: Record<string, unknown> = {}
  if (v.data.title       !== undefined) patch.title = v.data.title
  if (v.data.body        !== undefined) patch.body = v.data.body
  if (v.data.config      !== undefined) patch.config = v.data.config
  if (v.data.is_enabled  !== undefined) patch.is_enabled = v.data.is_enabled
  if (v.data.is_required !== undefined) patch.is_required = v.data.is_required
  if (v.data.sort_order  !== undefined) patch.sort_order = v.data.sort_order

  const { error } = await supabase
    .from('space_onboarding_steps')
    .update(patch)
    .eq('id', idCheck.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true as const }
}

export async function deleteOnboardingStep(stepId: string) {
  const v = parseInput(uuidSchema, stepId)
  if (!v.ok) return { error: 'Invalid step ID' }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ['admin'], 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // RLS also blocks deleting is_system rows; surface a clear message.
  const { error, count } = await supabase
    .from('space_onboarding_steps')
    .delete({ count: 'exact' })
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  if (count === 0) return { error: 'Built-in steps cannot be deleted. Disable it instead.' }
  revalidatePath('/settings')
  return { success: true as const }
}

// --- Member: progress through the flow ---------------------------------------

export async function markOnboardingStepDone(stepId: string) {
  const v = parseInput(uuidSchema, stepId)
  if (!v.ok) return { error: 'Invalid step ID' }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data: row } = await supabase
    .from('space_members')
    .select('onboarding_progress')
    .eq('id', member.id)
    .single()

  const progress = (row?.onboarding_progress ?? {}) as { completed_step_ids?: string[] }
  const done = new Set(progress.completed_step_ids ?? [])
  done.add(v.data)

  const { error } = await supabase
    .from('space_members')
    .update({ onboarding_progress: { ...progress, completed_step_ids: Array.from(done) } })
    .eq('id', member.id)

  if (error) return { error: error.message }
  return { success: true as const }
}

// Completes onboarding. Server-side double-check: every enabled+required step
// must be in completed_step_ids, so a tampered client cannot skip a required
// code-of-conduct acknowledgement.
export async function finishOnboarding() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data: steps } = await supabase
    .from('space_onboarding_steps')
    .select('id, is_required, is_enabled')
    .eq('space_id', member.space_id)
    .eq('is_enabled', true)

  const { data: row } = await supabase
    .from('space_members')
    .select('onboarding_progress')
    .eq('id', member.id)
    .single()

  const progress = (row?.onboarding_progress ?? {}) as { completed_step_ids?: string[] }
  const done = new Set(progress.completed_step_ids ?? [])
  const requiredMissing = (steps ?? []).filter(s => s.is_required && !done.has(s.id))
  if (requiredMissing.length > 0) {
    return { error: 'Please complete the required steps before finishing.' }
  }

  // onboarding_completed_at is blocked by the self-change trigger (migration
  // 024) so a member cannot skip required steps via a raw PostgREST call.
  // Set it via the service client AFTER the required-steps check above, scoped
  // to this member's own id.
  const admin = createAdminClient()
  const { error } = await admin
    .from('space_members')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', member.id)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true as const }
}

// Skip is only honored when no enabled step is required.
export async function skipOnboarding() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { count } = await supabase
    .from('space_onboarding_steps')
    .select('*', { count: 'exact', head: true })
    .eq('space_id', member.space_id)
    .eq('is_enabled', true)
    .eq('is_required', true)

  if ((count ?? 0) > 0) {
    return { error: 'This space requires you to complete onboarding.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('space_members')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', member.id)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true as const }
}
