'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMember, parseInput } from '@/lib/auth-helpers'
import {
  createContactSchema,
  updateContactSchema,
  uuidSchema,
} from '@/lib/validations'

function generateContactCode(name: string): string {
  const prefix = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X').padEnd(3, 'X')
  const suffix = Math.floor(Math.random() * 900 + 100).toString()
  return `${prefix}${suffix}`
}

export async function createContact(formData: {
  name: string
  contact_type: string
  email?: string
  phone?: string
  details?: string
  note?: string
  group_label?: string
  tags?: string[]
}) {
  const v = parseInput(createContactSchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      space_id: member.space_id,
      name: v.data.name,
      contact_type: v.data.contact_type,
      email: v.data.email ?? null,
      phone: v.data.phone ?? null,
      details: v.data.details ?? v.data.note ?? null,
      note: v.data.note ?? null,
      group_label: v.data.group_label ?? null,
      tags: v.data.tags ?? [],
      code: v.data.code ?? generateContactCode(v.data.name),
    })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/contacts')
  return { data }
}

export async function updateContact(
  contactId: string,
  updates: {
    name?: string
    contact_type?: string
    email?: string
    phone?: string
    details?: string
    note?: string
    group_label?: string
    tags?: string[]
  },
) {
  const v = parseInput(updateContactSchema, { contactId, ...updates })
  if (!v.ok) return { error: v.error }
  const { contactId: id, ...patch } = v.data

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('contacts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/contacts')
  return { success: true as const }
}

export async function deleteContact(contactId: string) {
  const v = parseInput(uuidSchema, contactId)
  if (!v.ok) return { error: 'Invalid contact ID' }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/contacts')
  return { success: true as const }
}
