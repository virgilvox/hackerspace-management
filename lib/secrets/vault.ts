// Generic per-space secret vault helpers. This is the canonical store/read
// pair for any third-party credential (the AES-256-GCM `secrets` table, the
// same layout the door subsystem and Stripe config use). NOT a 'use server'
// module: it takes a Supabase admin client and is imported by server actions
// and route handlers. Secrets are server-only and never returned to a client.
import type { createAdminClient } from '@/lib/supabase/admin'
import { encryptSecret, decryptSecret, encryptionAvailable } from '@/lib/secrets/crypto'

type Admin = ReturnType<typeof createAdminClient>

// Store a credential in the encrypted vault. Returns the secret row id to
// keep (as a *_ref) in integrations.config. null on failure.
export async function storeSecret(
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
  const { data, error } = await admin.from('secrets').insert(row).select('id').single()
  if (error || !data) return null
  return data.id as string
}

// Read + decrypt a stored credential by ref, space-scoped. Server-only.
export async function readSecret(
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

// Config key naming convention for credentials that must be vaulted rather
// than stored plaintext in integrations.config. Derived keys (*_set, *_ref)
// are never themselves secrets.
export function isSecretConfigField(key: string): boolean {
  if (key.endsWith('_set') || key.endsWith('_ref')) return false
  const k = key.toLowerCase()
  return (
    k === 'client_secret' ||
    k === 'api_key' ||
    k === 'secret_key' ||
    k === 'password' ||
    k === 'token' ||
    k === 'private_key' ||
    k === 'access_token' ||
    k === 'refresh_token' ||
    k.endsWith('_secret') ||
    k.endsWith('_token') ||
    k.endsWith('_password')
  )
}
