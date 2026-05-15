'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberWithRole, parseInput } from '@/lib/auth-helpers'
import { ADMIN_ROLES } from '@/lib/permissions'
import { createSecretSchema, updateSecretSchema, uuidSchema } from '@/lib/validations'
import { encryptSecret, decryptSecret, encryptionAvailable } from '@/lib/secrets/crypto'

const SECRETS_RW_ROLES = ['admin', 'board'] as const

export async function createSecret(formData: {
  title: string
  value: string
  description?: string
  area?: string
  icon?: string
}) {
  const v = parseInput(createSecretSchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const row: Record<string, unknown> = {
    space_id: member.space_id,
    title: v.data.title,
    label: v.data.title,
    description: v.data.description ?? null,
    area: v.data.area ?? null,
    icon: v.data.icon ?? null,
  }

  if (encryptionAvailable()) {
    const { ciphertext, version } = encryptSecret(v.data.value)
    row.encrypted_value = ciphertext
    row.encryption_version = version
    row.value = ''
  } else {
    row.value = v.data.value
    row.encryption_version = 0
  }

  const { data, error } = await supabase
    .from('secrets')
    .insert(row)
    .select('id, title, label, area, description, icon, encryption_version, created_at, updated_at, space_id, created_by')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/ops')
  return { data }
}

export async function updateSecret(secretId: string, updates: {
  title?: string
  value?: string
  description?: string | null
  area?: string | null
  icon?: string | null
}) {
  const idCheck = parseInput(uuidSchema, secretId)
  if (!idCheck.ok) return { error: 'Invalid secret ID' }
  const v = parseInput(updateSecretSchema, updates)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, SECRETS_RW_ROLES, 'Board or admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const patch: Record<string, unknown> = {}
  if (v.data.title !== undefined) {
    patch.title = v.data.title
    patch.label = v.data.title
  }
  if (v.data.description !== undefined) patch.description = v.data.description
  if (v.data.area        !== undefined) patch.area = v.data.area
  if (v.data.icon        !== undefined) patch.icon = v.data.icon
  if (v.data.value       !== undefined) {
    if (encryptionAvailable()) {
      const { ciphertext, version } = encryptSecret(v.data.value)
      patch.encrypted_value = ciphertext
      patch.encryption_version = version
      patch.value = ''
    } else {
      patch.value = v.data.value
      patch.encryption_version = 0
    }
  }

  const { error } = await supabase
    .from('secrets')
    .update(patch)
    .eq('id', idCheck.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/ops')
  return { success: true as const }
}

// Reveal returns the plaintext for a single secret. The list endpoint must
// NEVER send the plaintext or ciphertext to the client; only this action does,
// and only when the caller is board/admin in the owning space.
export async function revealSecret(secretId: string) {
  const idCheck = parseInput(uuidSchema, secretId)
  if (!idCheck.ok) return { error: 'Invalid secret ID' }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, SECRETS_RW_ROLES, 'Board or admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('secrets')
    .select('id, encryption_version, encrypted_value, value, title')
    .eq('id', idCheck.data)
    .eq('space_id', member.space_id)
    .single()

  if (error || !data) return { error: error?.message ?? 'Not found' }

  let plaintext: string
  try {
    if (data.encryption_version === 1 && data.encrypted_value) {
      const raw = data.encrypted_value as unknown
      const buf = typeof raw === 'string'
        ? Buffer.from((raw as string).replace(/^\\x/, ''), 'hex')
        : Buffer.from(raw as Uint8Array)
      plaintext = decryptSecret(buf, 1)
    } else {
      plaintext = (data.value ?? '') as string
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Decryption failed' }
  }

  if (user?.id) {
    await supabase.from('activity_log').insert({
      space_id: member.space_id,
      user_id: user.id,
      action: 'secret.revealed',
      entity_type: 'secret',
      entity_id: data.id,
      details: `Revealed secret "${data.title}"`,
    })
  }

  return { value: plaintext }
}

export async function deleteSecret(secretId: string) {
  const v = parseInput(uuidSchema, secretId)
  if (!v.ok) return { error: 'Invalid secret ID' }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ['admin'], 'Admin access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('secrets')
    .delete()
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/ops')
  return { success: true as const }
}
