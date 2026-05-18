'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { storeSecret, isSecretConfigField } from '@/lib/secrets/vault'
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
  city?: string | null
  require_approval?: boolean
  public_member_directory?: boolean
  mission_statement?: string | null
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
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Existing config: lets us carry a stored secret ref forward when the admin
  // leaves a credential field blank (write-only, like Stripe), and lets us
  // auto-migrate any legacy plaintext secret into the vault on the next save.
  const { data: existingRow } = await supabase
    .from('integrations')
    .select('config')
    .eq('space_id', member.space_id)
    .eq('platform', v.data.platform)
    .maybeSingle()
  const existing = (existingRow?.config as Record<string, string> | null) ?? {}

  const admin = createAdminClient()

  // Credentials NEVER land in integrations.config in plaintext: secret-named
  // fields go to the AES-256-GCM vault and only a *_ref id is kept. Non-secret
  // fields are stored verbatim. *_set flags let the UI show "connected"
  // without the value being readable.
  const safeConfig: Record<string, string> = {}
  let connected = false

  for (const [key, value] of Object.entries(v.data.config)) {
    if (isSecretConfigField(key)) continue // handled below
    safeConfig[key] = value ?? ''
    safeConfig[`${key}_set`] = value && value.length > 0 ? 'true' : 'false'
    if (value && value.length > 0) connected = true
  }

  // Determine the secret fields this platform may carry: those provided now
  // plus any already on file (so a blank submit preserves / migrates them).
  const secretKeys = new Set<string>()
  for (const k of Object.keys(v.data.config)) if (isSecretConfigField(k)) secretKeys.add(k)
  for (const k of Object.keys(existing)) {
    const base = k.replace(/_ref$/, '')
    if (isSecretConfigField(base)) secretKeys.add(base)
  }

  for (const key of secretKeys) {
    const provided = v.data.config[key]
    let ref: string | null = existing[`${key}_ref`] ?? null

    if (provided && provided.length > 0) {
      ref = await storeSecret(admin, member.space_id, `${v.data.platform} ${key}`, provided, user?.id ?? null)
      if (!ref) return { error: `Could not securely store ${key}.` }
    } else if (!ref && existing[key] && existing[key].length > 0) {
      // Legacy plaintext on file (pre-vault). Migrate it now, then drop it.
      ref = await storeSecret(admin, member.space_id, `${v.data.platform} ${key}`, existing[key], user?.id ?? null)
      if (!ref) return { error: `Could not migrate ${key} into the vault.` }
    }

    if (ref) {
      safeConfig[`${key}_ref`] = ref
      safeConfig[`${key}_set`] = 'true'
      connected = true
    } else {
      safeConfig[`${key}_set`] = 'false'
    }
  }

  const { error } = await supabase.from('integrations').upsert(
    {
      space_id: member.space_id,
      platform: v.data.platform,
      name: v.data.platform,
      is_connected: connected,
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
