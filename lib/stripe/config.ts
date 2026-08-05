// Server-only helpers (NOT a 'use server' module — these take a Supabase
// admin client and are imported by server actions + the webhook route).
// Per-space Stripe config lives in integrations.config; the secret key and
// webhook signing secret live in the AES-256-GCM secrets vault, referenced
// by id from config.
import type { createAdminClient } from '@/lib/supabase/admin'
import type { TablesInsert } from '@/types/database'
import { encryptSecret, decryptSecret, encryptionAvailable } from '@/lib/secrets/crypto'

type Admin = ReturnType<typeof createAdminClient>

export type StripeConfig = {
  mode?: 'test' | 'live'
  publishable_key?: string
  secret_key_ref?: string
  webhook_secret_ref?: string
  grace_days?: number
  prices?: Record<string, string>
}

// Store a Stripe credential in the encrypted secrets vault (same layout the
// door subsystem uses). Returns the secret row id to keep in config.
export async function storeStripeSecret(
  admin: Admin,
  spaceId: string,
  title: string,
  value: string,
  createdBy: string | null,
): Promise<string | null> {
  const row: Record<string, unknown> = {
    space_id: spaceId,
    title,
    label: title,
    category: 'integration',
    created_by: createdBy,
  }
  if (encryptionAvailable()) {
    const { ciphertext, version } = encryptSecret(value)
    row.encrypted_value = ciphertext
    row.encryption_version = version
    row.value = ''
  } else {
    row.value = value
    row.encryption_version = 0
  }
  const { data, error } = await admin
    .from('secrets')
    .insert(row as TablesInsert<'secrets'>)
    .select('id')
    .single()
  if (error || !data) return null
  return data.id as string
}

// Read + decrypt a stored Stripe credential. Server-only; never returned to
// a client.
export async function readStripeSecret(
  admin: Admin,
  spaceId: string,
  secretRef: string | null | undefined,
): Promise<string | null> {
  if (!secretRef) return null
  const { data } = await admin
    .from('secrets')
    .select('encryption_version, encrypted_value, value')
    .eq('id', secretRef)
    .eq('space_id', spaceId)
    .maybeSingle()
  if (!data) return null
  if (data.encryption_version === 1 && data.encrypted_value) {
    const raw = data.encrypted_value as unknown
    const buf =
      typeof raw === 'string'
        ? Buffer.from((raw as string).replace(/^\\x/, ''), 'hex')
        : Buffer.from(raw as Uint8Array)
    try {
      return decryptSecret(buf, 1)
    } catch {
      return null
    }
  }
  return (data.value as string | null) ?? null
}

export async function getStripeConfig(admin: Admin, spaceId: string): Promise<StripeConfig | null> {
  const { data } = await admin
    .from('integrations')
    .select('config')
    .eq('space_id', spaceId)
    .eq('platform', 'stripe')
    .maybeSingle()
  return (data?.config as StripeConfig | null) ?? null
}
