'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberWithRole, parseInput } from '@/lib/auth-helpers'
import {
  updateSpaceSettingsSchema,
  saveIntegrationSchema,
  updateSpaceVisibilitySchema,
} from '@/lib/validations'

const ADMIN_ONLY = ['admin'] as const

export async function updateSpaceSettings(updates: {
  name?: string
  slug?: string
  city?: string
  require_approval?: boolean
  public_member_directory?: boolean
}) {
  const v = parseInput(updateSpaceSettingsSchema, updates)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ONLY, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('spaces')
    .update({ ...v.data, updated_at: new Date().toISOString() })
    .eq('id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true as const }
}

export async function rotateWebhookSecret() {
  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ONLY, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const newSecret =
    'whsec_' +
    Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

  const { error } = await supabase
    .from('spaces')
    .update({ webhook_secret: newSecret, updated_at: new Date().toISOString() })
    .eq('id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { secret: newSecret }
}

export async function saveIntegration(platform: string, config: Record<string, string>) {
  const v = parseInput(saveIntegrationSchema, { platform, config })
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ONLY, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // Store provided values; also store boolean "_set" flags so the UI can show
  // a "connected" state without leaking the secret back to the client.
  const safeConfig: Record<string, string> = {}
  for (const [key, value] of Object.entries(v.data.config)) {
    safeConfig[key] = value ?? ''
    safeConfig[`${key}_set`] = value && value.length > 0 ? 'true' : 'false'
  }

  const { error } = await supabase.from('integrations').upsert(
    {
      space_id: member.space_id,
      platform: v.data.platform,
      name: v.data.platform,
      is_connected: Object.values(v.data.config).some(value => value && value.length > 0),
      config: safeConfig,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'space_id,platform' },
  )

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true as const }
}

/**
 * Per-space visibility flags. Lets admins decide whether financial data is
 * visible to all members, board only, or treasurer-only; and whether the
 * member directory is fully visible, count-only, or board-only.
 */
export async function updateSpaceVisibility(updates: {
  financial_visibility?: string
  member_directory_visibility?: string
}) {
  const v = parseInput(updateSpaceVisibilitySchema, updates)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ONLY, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('spaces')
    .update({ ...v.data, updated_at: new Date().toISOString() })
    .eq('id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  revalidatePath('/financials')
  revalidatePath('/members')
  return { success: true as const }
}

export async function disconnectIntegration(platform: string) {
  if (typeof platform !== 'string' || platform.length === 0 || platform.length > 50) {
    return { error: 'Invalid platform' }
  }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ONLY, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('integrations')
    .update({ is_connected: false, config: {}, updated_at: new Date().toISOString() })
    .eq('space_id', member.space_id)
    .eq('platform', platform)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true as const }
}
