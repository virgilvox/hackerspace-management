'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  requireMember,
  requireMemberWithRole,
  logActivity,
  parseInput,
} from '@/lib/auth-helpers'
import { TREASURER_ROLES } from '@/lib/permissions'
import {
  logCashPaymentSchema,
  linkPaymentSchema,
  importPaymentsCsvSchema,
} from '@/lib/validations'
import { resolveDuesAdvance } from '@/lib/dues-payments-logic'
import type { Enums, TablesInsert } from '@/types/database'

type PaymentPlatform = Enums<'payment_platform'>

export async function logCashPayment(formData: {
  amount: number
  from_note: string
  member_id?: string
  transaction_date?: string
}) {
  const v = parseInput(logCashPaymentSchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, TREASURER_ROLES, 'Treasurer access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const transactionDate = v.data.transaction_date ?? new Date().toISOString()

  // A supplied member_id must belong to the caller's space before we stamp it
  // onto the payment, mirroring reserveEquipment. Without this a treasurer
  // could link a cash payment to a member id from another space.
  if (v.data.member_id) {
    const { data: tgt } = await supabase
      .from('space_members')
      .select('id')
      .eq('id', v.data.member_id)
      .eq('space_id', member.space_id)
      .maybeSingle()
    if (!tgt) return { error: 'That member was not found in this space.' }
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      space_id: member.space_id,
      platform: 'cash',
      amount: v.data.amount,
      from_identifier: 'Cash',
      from_note: v.data.from_note,
      member_id: v.data.member_id ?? null,
      link_status: v.data.member_id ? 'linked' : 'unlinked',
      transaction_date: transactionDate,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  if (v.data.member_id) {
    // Advance-only: a backdated cash payment must not move dues state backward.
    const { data: existing } = await supabase
      .from('space_members')
      .select('last_paid_at')
      .eq('id', v.data.member_id)
      .eq('space_id', member.space_id)
      .single()

    await supabase
      .from('space_members')
      .update(resolveDuesAdvance(existing?.last_paid_at ?? null, transactionDate))
      .eq('id', v.data.member_id)
      .eq('space_id', member.space_id)
  }

  await logActivity(
    supabase,
    member,
    'logged',
    'payment',
    data.id,
    `$${v.data.amount} cash, ${v.data.from_note}`,
  )

  revalidatePath('/payments')
  revalidatePath('/dashboard')
  return { data }
}

export async function linkPaymentToMember(paymentId: string, memberId: string) {
  const v = parseInput(linkPaymentSchema, { paymentId, memberId })
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, TREASURER_ROLES, 'Treasurer access required')
  if (!auth.ok) return { error: auth.error }
  const { member: self } = auth

  // The target member must belong to the caller's space before we link the
  // payment to it, mirroring reserveEquipment. Without this a treasurer could
  // link a payment to a member id from another space.
  const { data: tgt } = await supabase
    .from('space_members')
    .select('id')
    .eq('id', v.data.memberId)
    .eq('space_id', self.space_id)
    .maybeSingle()
  if (!tgt) return { error: 'That member was not found in this space.' }

  const { data: payment } = await supabase
    .from('payments')
    .select('amount, transaction_date')
    .eq('id', v.data.paymentId)
    .single()

  const { error } = await supabase
    .from('payments')
    .update({ member_id: v.data.memberId, link_status: 'linked' })
    .eq('id', v.data.paymentId)
    .eq('space_id', self.space_id)

  if (error) return { error: error.message }

  if (payment?.transaction_date) {
    // Advance-only: linking a historical payment must not move dues state
    // backward if the member has a more recent payment on file.
    const { data: existing } = await supabase
      .from('space_members')
      .select('last_paid_at')
      .eq('id', v.data.memberId)
      .eq('space_id', self.space_id)
      .single()

    await supabase
      .from('space_members')
      .update(resolveDuesAdvance(existing?.last_paid_at ?? null, payment.transaction_date))
      .eq('id', v.data.memberId)
      .eq('space_id', self.space_id)
  }

  revalidatePath('/payments')
  revalidatePath('/members')
  revalidatePath('/dashboard')
  return { success: true as const }
}

export async function importPaymentsCsv(rows: unknown) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: 'No rows to import' }
  }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, TREASURER_ROLES, 'Treasurer access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // Per-row validation: platform enum, positive finite amount, normalized
  // transaction_date. Invalid rows are skipped and counted, not silently
  // dropped without feedback.
  const rowSchema = importPaymentsCsvSchema.element
  const inserts: Array<TablesInsert<'payments'>> = []
  let skipped = 0
  for (const raw of rows) {
    const r = rowSchema.safeParse(raw)
    if (!r.success) { skipped++; continue }
    inserts.push({
      space_id: member.space_id,
      platform: r.data.platform as PaymentPlatform,
      amount: r.data.amount,
      from_identifier: r.data.from_identifier,
      from_note: r.data.from_note ?? null,
      link_status: 'unlinked' as const,
      transaction_date: r.data.transaction_date ?? new Date().toISOString(),
    })
  }

  if (inserts.length === 0) {
    return { error: `No valid rows to import (${skipped} skipped: bad platform, amount, or date).` }
  }

  const { data, error } = await supabase.from('payments').insert(inserts).select()
  if (error) return { error: error.message }

  revalidatePath('/payments')
  revalidatePath('/dashboard')
  return { data, count: data.length, skipped }
}

// The caller's own payment history. `payments` SELECT is treasurer-scoped
// (RLS), so the member self-view goes through the validated service client,
// strictly scoped to their own space_id + member_id (same convention as
// getMyBilling / getMyNotifications).
export async function getMyPayments() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data } = await createAdminClient()
    .from('payments')
    .select('id, amount, currency, platform, description, status, transaction_date, payment_date, created_at')
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .order('transaction_date', { ascending: false, nullsFirst: false })
    .limit(50)

  return {
    data: (data ?? []).map(p => ({
      id: p.id as string,
      amount: p.amount as number,
      currency: (p.currency as string | null) ?? 'USD',
      platform: p.platform as string,
      description: (p.description as string | null) ?? null,
      status: p.status as string,
      date:
        (p.transaction_date as string | null) ??
        (p.payment_date as string | null) ??
        (p.created_at as string),
    })),
  }
}
