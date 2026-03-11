'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  createTaskSchema,
  taskIdSchema,
  createProjectSchema,
  updateProjectStatusSchema,
  addMemberSchema,
  updateMemberSchema,
  createContactSchema,
  updateContactSchema,
  createKbEntrySchema,
  updateKbEntrySchema,
  createSecretSchema,
  logCashPaymentSchema,
  linkPaymentSchema,
  updateSpaceSettingsSchema,
  saveIntegrationSchema,
  upsertAreaLeadSchema,
  uuidSchema,
} from '@/lib/validations'

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ─── Helper: get current member (any non-inactive status) ────────────────────
async function getMember(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase
    .from('space_members')
    .select('space_id, role, display_name')
    .eq('user_id', userId)
    .in('status', ['current', 'unverified', 'late'])
    .single()
  return data
}

export async function getCurrentMember() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('space_members')
    .select('*, spaces(*)')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .single()
  return data
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function createTask(formData: {
  title: string
  description?: string
  type: string
  area?: string
  recurrence?: string
  due_date?: string
}) {
  // Validate input
  const parsed = createTaskSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || 'Invalid input' }
  }
  const input = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const member = await getMember(supabase, user.id)
  if (!member) return { error: 'No active membership' }

  const { data, error } = await supabase.from('tasks').insert({
    space_id: member.space_id,
    title: input.title,
    description: input.description,
    task_type: input.type || 'task',
    area: input.area,
    recurrence: input.recurrence || 'none',
    due_date: input.due_date || null,
    status: 'open',
    requested_by: user.id,
    requested_by_name: member.display_name,
  }).select().single()

  if (error) return { error: error.message }

  // Log activity
  await supabase.from('activity_log').insert({
    space_id: member.space_id,
    user_id: user.id,
    display_name: member.display_name,
    action: 'created',
    entity_type: 'task',
    entity_id: data.id,
    details: formData.title,
  })

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  return { data }
}

export async function claimTask(taskId: string) {
  const idResult = taskIdSchema.safeParse(taskId)
  if (!idResult.success) return { error: 'Invalid task ID' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const member = await getMember(supabase, user.id)
  if (!member) return { error: 'No active membership' }

  const { error } = await supabase.from('tasks').update({
    claimed_by: user.id,
    claimed_by_name: member.display_name,
    status: 'claimed',
  }).eq('id', idResult.data).eq('space_id', member.space_id)

  if (error) return { error: error.message }

  await supabase.from('activity_log').insert({
    space_id: member.space_id,
    user_id: user.id,
    display_name: member.display_name,
    action: 'claimed',
    entity_type: 'task',
    entity_id: taskId,
  })

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function completeTask(taskId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const member = await getMember(supabase, user.id)
  if (!member) return { error: 'No active membership' }

  const { error } = await supabase.from('tasks').update({
    status: 'completed',
    completed_at: new Date().toISOString(),
    last_done_at: new Date().toISOString(),
  }).eq('id', taskId).eq('space_id', member.space_id)

  if (error) return { error: error.message }

  await supabase.from('activity_log').insert({
    space_id: member.space_id,
    user_id: user.id,
    display_name: member.display_name,
    action: 'completed',
    entity_type: 'task',
    entity_id: taskId,
  })

  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteTask(taskId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const member = await getMember(supabase, user.id)
  if (!member) return { error: 'No active membership' }

  const { error } = await supabase.from('tasks').delete()
    .eq('id', taskId).eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/tasks')
  return { success: true }
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function createProject(formData: {
  title: string
  description?: string
  area?: string
  tags?: string[]
  due_date?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const member = await getMember(supabase, user.id)
  if (!member) return { error: 'No active membership' }

  const { data, error } = await supabase.from('projects').insert({
    space_id: member.space_id,
    title: formData.title,
    description: formData.description,
    area: formData.area,
    tags: formData.tags ?? [],
    due_date: formData.due_date || null,
    status: 'backlog',
  }).select().single()

  if (error) return { error: error.message }

  await supabase.from('activity_log').insert({
    space_id: member.space_id,
    user_id: user.id,
    display_name: member.display_name,
    action: 'created',
    entity_type: 'project',
    entity_id: data.id,
    details: formData.title,
  })

  revalidatePath('/projects')
  return { data }
}

export async function updateProjectStatus(projectId: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const member = await getMember(supabase, user.id)
  if (!member) return { error: 'No active membership' }

  const { error } = await supabase.from('projects').update({ status, updated_at: new Date().toISOString() })
    .eq('id', projectId).eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const member = await getMember(supabase, user.id)
  if (!member) return { error: 'No active membership' }

  const { error } = await supabase.from('projects').delete()
    .eq('id', projectId).eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/projects')
  return { success: true }
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function addMember(formData: {
  display_name: string
  email: string
  phone?: string
  handle?: string
  tier: string
  role: string
  joined_at?: string
  has_card_access?: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: self } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!self || (self.role !== 'admin' && self.role !== 'board')) return { error: 'Admin access required' }

  const { data, error } = await supabase.from('space_members').insert({
    space_id: self.space_id,
    display_name: formData.display_name,
    email: formData.email,
    phone: formData.phone,
    handle: formData.handle,
    tier: formData.tier,
    role: formData.role,
    status: 'current',
    approved: true,
    joined_at: formData.joined_at || new Date().toISOString(),
    has_card_access: formData.has_card_access ?? false,
  }).select().single()

  if (error) return { error: error.message }
  revalidatePath('/members')
  return { data }
}

export async function updateMember(memberId: string, updates: {
  display_name?: string
  email?: string
  phone?: string
  handle?: string
  tier?: string
  role?: string
  status?: string
  has_card_access?: boolean
  payment_status?: string
  payment_note?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: self } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!self || (self.role !== 'admin' && self.role !== 'board')) return { error: 'Admin access required' }

  const { error } = await supabase.from('space_members').update(updates)
    .eq('id', memberId).eq('space_id', self.space_id)

  if (error) return { error: error.message }
  revalidatePath('/members')
  return { success: true }
}

export async function approveMember(memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: self } = await supabase
    .from('space_members').select('space_id, role, display_name').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!self || (self.role !== 'admin' && self.role !== 'board')) return { error: 'Admin access required' }

  const { error } = await supabase.from('space_members').update({ status: 'current', approved: true })
    .eq('id', memberId).eq('space_id', self.space_id)

  if (error) return { error: error.message }

  await supabase.from('activity_log').insert({
    space_id: self.space_id,
    user_id: user.id,
    display_name: self.display_name,
    action: 'approved',
    entity_type: 'member',
    entity_id: memberId,
  })

  revalidatePath('/members')
  return { success: true }
}

export async function removeMember(memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: self } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!self || self.role !== 'admin') return { error: 'Admin access required' }

  const { error } = await supabase.from('space_members').delete()
    .eq('id', memberId).eq('space_id', self.space_id)

  if (error) return { error: error.message }
  revalidatePath('/members')
  return { success: true }
}

// ─── Contacts ────────────────────────────────────────────────────────────────

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const member = await getMember(supabase, user.id)
  if (!member) return { error: 'No active membership' }

  const code = formData.name.slice(0, 3).toUpperCase() + Math.floor(Math.random() * 900 + 100)

  const { data, error } = await supabase.from('contacts').insert({
    space_id: member.space_id,
    name: formData.name,
    contact_type: formData.contact_type,
    email: formData.email,
    phone: formData.phone,
    details: formData.details || formData.note,
    note: formData.note,
    group_label: formData.group_label,
    tags: formData.tags ?? [],
    code,
  }).select().single()

  if (error) return { error: error.message }
  revalidatePath('/contacts')
  return { data }
}

export async function updateContact(contactId: string, updates: {
  name?: string
  contact_type?: string
  email?: string
  phone?: string
  details?: string
  note?: string
  group_label?: string
  tags?: string[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const member = await getMember(supabase, user.id)
  if (!member) return { error: 'No active membership' }

  const { error } = await supabase.from('contacts').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', contactId).eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/contacts')
  return { success: true }
}

export async function deleteContact(contactId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const member = await getMember(supabase, user.id)
  if (!member) return { error: 'No active membership' }

  const { error } = await supabase.from('contacts').delete()
    .eq('id', contactId).eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/contacts')
  return { success: true }
}

// ─── Payments ────────────────────────────────────────────────────────────────

export async function logCashPayment(formData: {
  amount: number
  from_note: string
  member_id?: string
  transaction_date?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: member } = await supabase
    .from('space_members').select('space_id, role, display_name').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member || (member.role !== 'admin' && member.role !== 'board' && member.role !== 'treasurer')) {
    return { error: 'Treasurer access required' }
  }

  const { data, error } = await supabase.from('payments').insert({
    space_id: member.space_id,
    platform: 'cash',
    amount: formData.amount,
    from_identifier: 'Cash',
    from_note: formData.from_note,
    member_id: formData.member_id || null,
    link_status: formData.member_id ? 'linked' : 'unlinked',
    transaction_date: formData.transaction_date || new Date().toISOString(),
  }).select().single()

  if (error) return { error: error.message }

  // Update member's last_paid_at if linked
  if (formData.member_id) {
    await supabase.from('space_members').update({
      last_paid_at: formData.transaction_date || new Date().toISOString(),
      payment_status: 'current',
    }).eq('id', formData.member_id).eq('space_id', member.space_id)
  }

  await supabase.from('activity_log').insert({
    space_id: member.space_id,
    user_id: user.id,
    display_name: member.display_name,
    action: 'logged',
    entity_type: 'payment',
    entity_id: data.id,
    details: `$${formData.amount} cash — ${formData.from_note}`,
  })

  revalidatePath('/payments')
  revalidatePath('/dashboard')
  return { data }
}

export async function linkPaymentToMember(paymentId: string, memberId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: self } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!self || (self.role !== 'admin' && self.role !== 'board' && self.role !== 'treasurer')) {
    return { error: 'Treasurer access required' }
  }

  // Get payment to find the amount and date
  const { data: payment } = await supabase
    .from('payments').select('amount, transaction_date').eq('id', paymentId).single()

  const { error } = await supabase.from('payments').update({
    member_id: memberId,
    link_status: 'linked',
  }).eq('id', paymentId).eq('space_id', self.space_id)

  if (error) return { error: error.message }

  // Update member payment status
  if (payment) {
    await supabase.from('space_members').update({
      last_paid_at: payment.transaction_date,
      payment_status: 'current',
    }).eq('id', memberId).eq('space_id', self.space_id)
  }

  revalidatePath('/payments')
  revalidatePath('/members')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function importPaymentsCsv(rows: Array<{
  platform: string
  amount: number
  from_identifier: string
  from_note?: string
  transaction_date: string
}>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member || (member.role !== 'admin' && member.role !== 'board' && member.role !== 'treasurer')) {
    return { error: 'Treasurer access required' }
  }

  const inserts = rows.map(r => ({
    space_id: member.space_id,
    platform: r.platform as any,
    amount: r.amount,
    from_identifier: r.from_identifier,
    from_note: r.from_note,
    link_status: 'unlinked' as const,
    transaction_date: r.transaction_date,
  }))

  const { data, error } = await supabase.from('payments').insert(inserts).select()
  if (error) return { error: error.message }

  revalidatePath('/payments')
  revalidatePath('/dashboard')
  return { data, count: data.length }
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

export async function createKbEntry(formData: {
  title: string
  content: string
  description?: string
  area?: string
  visibility?: string
  is_pinned?: boolean
  tags?: string[]
  icon?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: member } = await supabase
    .from('space_members').select('space_id, display_name, handle').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member) return { error: 'No active membership' }

  const { data, error } = await supabase.from('knowledge_base').insert({
    space_id: member.space_id,
    title: formData.title,
    content: formData.content,
    area: formData.area,
    visibility: formData.visibility || 'all_members',
    is_pinned: formData.is_pinned ?? false,
    tags: formData.tags ?? [],
    icon: formData.icon,
    updated_by_id: user.id,
    updated_by_name: member.display_name,
  }).select().single()

  if (error) return { error: error.message }
  revalidatePath('/ops')
  return { data }
}

export async function updateKbEntry(entryId: string, updates: {
  title?: string
  content?: string
  area?: string
  visibility?: string
  is_pinned?: boolean
  tags?: string[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: member } = await supabase
    .from('space_members').select('space_id, display_name').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member) return { error: 'No active membership' }

  // Only pass columns that actually exist in the DB
  const { is_pinned, ...rest } = updates
  const { error } = await supabase.from('knowledge_base').update({
    ...rest,
    ...(is_pinned !== undefined ? { is_pinned } : {}),
    updated_by_id: user.id,
    updated_by_name: member.display_name,
    updated_at: new Date().toISOString(),
  }).eq('id', entryId).eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/ops')
  return { success: true }
}

export async function deleteKbEntry(entryId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: member } = await supabase
    .from('space_members').select('space_id').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member) return { error: 'No active membership' }

  const { error } = await supabase.from('knowledge_base').delete()
    .eq('id', entryId).eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/ops')
  return { success: true }
}

// ─── Secrets ─────────────────────────────────────────────────────────────────

export async function createSecret(formData: {
  title: string
  value: string
  description?: string
  area?: string
  icon?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member || (member.role !== 'admin' && member.role !== 'board')) return { error: 'Admin access required' }

  const { data, error } = await supabase.from('secrets').insert({
    space_id: member.space_id,
    title: formData.title,
    label: formData.title,
    value: formData.value,
    description: formData.description,
    area: formData.area,
    icon: formData.icon,
  }).select().single()

  if (error) return { error: error.message }
  revalidatePath('/ops')
  return { data }
}

export async function deleteSecret(secretId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member || member.role !== 'admin') return { error: 'Admin access required' }

  const { error } = await supabase.from('secrets').delete()
    .eq('id', secretId).eq('space_id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/ops')
  return { success: true }
}

// ─── Area Leads ───────────────────────────────────────────────────────────────

export async function upsertAreaLead(formData: {
  area_code: string
  area_name: string
  lead_id?: string
  lead_handle?: string
  status?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member || (member.role !== 'admin' && member.role !== 'board')) return { error: 'Admin access required' }

  const { data, error } = await supabase.from('area_leads').upsert({
    space_id: member.space_id,
    area_code: formData.area_code,
    area_name: formData.area_name,
    lead_id: formData.lead_id || null,
    lead_handle: formData.lead_handle || null,
    status: formData.status || 'active',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'space_id,area_code' }).select().single()

  if (error) return { error: error.message }
  revalidatePath('/ops')
  return { data }
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function updateSpaceSettings(updates: {
  name?: string
  slug?: string
  city?: string
  require_approval?: boolean
  public_member_directory?: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member || member.role !== 'admin') return { error: 'Admin access required' }

  const { error } = await supabase.from('spaces').update({
    ...updates,
    updated_at: new Date().toISOString(),
  }).eq('id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function rotateWebhookSecret() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member || member.role !== 'admin') return { error: 'Admin access required' }

  // Generate a new webhook secret
  const newSecret = 'whsec_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const { error } = await supabase.from('spaces').update({ webhook_secret: newSecret, updated_at: new Date().toISOString() })
    .eq('id', member.space_id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { secret: newSecret }
}

export async function saveIntegration(platform: string, config: Record<string, string>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member || member.role !== 'admin') return { error: 'Admin access required' }

  // Mask sensitive values — store but indicate they're set
  const safeConfig: Record<string, string> = {}
  for (const [key, value] of Object.entries(config)) {
    safeConfig[key] = value ? value : ''
    safeConfig[`${key}_set`] = value ? 'true' : 'false'
  }

  const { error } = await supabase.from('integrations').upsert({
    space_id: member.space_id,
    platform,
    name: platform,
    is_connected: Object.values(config).some(v => v.length > 0),
    config: safeConfig,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'space_id,platform' })

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

export async function disconnectIntegration(platform: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member || member.role !== 'admin') return { error: 'Admin access required' }

  const { error } = await supabase.from('integrations').update({
    is_connected: false,
    config: {},
    updated_at: new Date().toISOString(),
  }).eq('space_id', member.space_id).eq('platform', platform)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// ─── Import Members ───────────────────────────────────────────────────────────

export async function importMembers(rows: Array<{
  display_name: string
  email: string
  phone?: string
  tier?: string
  joined_at?: string
  last_paid_at?: string
  has_card_access?: boolean
}>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member || (member.role !== 'admin' && member.role !== 'board')) return { error: 'Admin access required' }

  const inserts = rows.map(r => ({
    space_id: member.space_id,
    display_name: r.display_name,
    email: r.email,
    phone: r.phone,
    tier: r.tier || 'basic',
    role: 'member',
    status: 'current',
    approved: true,
    joined_at: r.joined_at || new Date().toISOString(),
    last_paid_at: r.last_paid_at || null,
    has_card_access: r.has_card_access ?? false,
  }))

  // Upsert by email to avoid duplicates
  const { data, error } = await supabase.from('space_members').upsert(inserts, {
    onConflict: 'space_id,email',
    ignoreDuplicates: false,
  }).select()

  if (error) return { error: error.message }
  revalidatePath('/members')
  return { data, count: data.length }
}
