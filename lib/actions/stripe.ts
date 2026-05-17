'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMemberWithRole, parseInput } from '@/lib/auth-helpers'
import { ADMIN_ROLES } from '@/lib/permissions'
import { stripeSettingsSchema } from '@/lib/validations'
import { isStripeConfigured } from '@/lib/stripe-logic'
import { getStripeConfig, storeStripeSecret, type StripeConfig } from '@/lib/stripe/config'

// Admin-facing settings view. NEVER returns secret values, only whether they
// are set, so the config screen can show status without exposing keys.
export async function getStripeSettings() {
  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const cfg = (await getStripeConfig(createAdminClient(), member.space_id)) ?? {}
  return {
    data: {
      mode: cfg.mode ?? 'test',
      publishable_key: cfg.publishable_key ?? '',
      grace_days: cfg.grace_days ?? 7,
      prices: cfg.prices ?? {},
      hasSecretKey: !!cfg.secret_key_ref,
      hasWebhookSecret: !!cfg.webhook_secret_ref,
      configured: isStripeConfigured(cfg),
    },
  }
}

export async function saveStripeSettings(input: unknown) {
  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const v = parseInput(stripeSettingsSchema, input)
  if (!v.ok) return { error: v.error }
  const s = v.data

  const admin = createAdminClient()
  const existing = (await getStripeConfig(admin, member.space_id)) ?? {}

  // Secret fields are write-only: a provided non-blank value rotates the
  // stored secret; blank/omitted keeps the existing ref.
  let secretKeyRef = existing.secret_key_ref
  if (s.secret_key && s.secret_key.trim()) {
    const id = await storeStripeSecret(admin, member.space_id, 'Stripe secret key', s.secret_key.trim(), user?.id ?? null)
    if (!id) return { error: 'Could not store the Stripe secret key.' }
    secretKeyRef = id
  }
  let webhookRef = existing.webhook_secret_ref
  if (s.webhook_secret && s.webhook_secret.trim()) {
    const id = await storeStripeSecret(admin, member.space_id, 'Stripe webhook signing secret', s.webhook_secret.trim(), user?.id ?? null)
    if (!id) return { error: 'Could not store the Stripe webhook secret.' }
    webhookRef = id
  }

  const prices: Record<string, string> = {}
  for (const [k, val] of Object.entries(s.prices ?? {})) {
    if (typeof val === 'string' && val.trim()) prices[k] = val.trim()
  }

  const config: StripeConfig = {
    mode: s.mode,
    publishable_key: s.publishable_key?.trim() || undefined,
    secret_key_ref: secretKeyRef,
    webhook_secret_ref: webhookRef,
    grace_days: s.grace_days ?? 7,
    prices,
  }

  const { error } = await admin.from('integrations').upsert(
    {
      space_id: member.space_id,
      platform: 'stripe',
      name: 'Stripe',
      is_connected: isStripeConfigured(config),
      config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'space_id,platform' },
  )
  if (error) return { error: error.message }

  revalidatePath('/settings')
  return { data: { ok: true, configured: isStripeConfigured(config) } }
}
