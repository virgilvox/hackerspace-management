// Server-only. Load + decrypt a door connection's secret from the AES-256-GCM
// secrets vault. Used for both the OUTBOUND door password (secret_ref) and the
// INBOUND webhook secret (inbound_secret_ref). The plaintext is decrypted
// server-side only and never returned to the browser or logged. Returns null
// when no secret is referenced.

import type { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret } from '@/lib/secrets/crypto'

export async function resolveDoorSecret(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  secretRef: string | null,
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
