'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberWithRole, parseInput } from '@/lib/auth-helpers'
import { ADMIN_ROLES } from '@/lib/permissions'
import { createSecretSchema, uuidSchema } from '@/lib/validations'

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

  const { data, error } = await supabase
    .from('secrets')
    .insert({
      space_id: member.space_id,
      title: v.data.title,
      label: v.data.title,
      value: v.data.value,
      description: v.data.description ?? null,
      area: v.data.area ?? null,
      icon: v.data.icon ?? null,
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/ops')
  return { data }
}

export async function deleteSecret(secretId: string) {
  const v = parseInput(uuidSchema, secretId)
  if (!v.ok) return { error: 'Invalid secret ID' }

  const supabase = await createClient()
  // Admin-only per RLS secrets_delete.
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
