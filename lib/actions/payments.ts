'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  requireMemberWithRole,
  logActivity,
  parseInput,
} from '@/lib/auth-helpers'
import { TREASURER_ROLES } from '@/lib/permissions'
import {
  logCashPaymentSchema,
  linkPaymentSchema,
} from '@/lib/validations'
import type { Enums } from '@/types/database'

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
    await supabase
      .from('space_members')
      .update({
        last_paid_at: transactionDate,
        payment_status: 'current',
      })
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

  if (payment) {
    await supabase
      .from('space_members')
      .update({
        last_paid_at: payment.transaction_date,
        payment_status: 'current',
      })
      .eq('id', v.data.memberId)
      .eq('space_id', self.space_id)
  }

  revalidatePath('/payments')
  revalidatePath('/members')
  revalidatePath('/dashboard')
  return { success: true as const }
}

export async function importPaymentsCsv(
  rows: Array<{
    platform: string
    amount: number
    from_identifier: string
    from_note?: string
    transaction_date: string
  }>,
) {
  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, TREASURER_ROLES, 'Treasurer access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const validPlatforms: PaymentPlatform[] = ['paypal', 'zeffy', 'venmo', 'cash']

  const inserts = rows
    .filter(r => validPlatforms.includes(r.platform as PaymentPlatform))
    .map(r => ({
      space_id: member.space_id,
      platform: r.platform as PaymentPlatform,
      amount: r.amount,
      from_identifier: r.from_identifier,
      from_note: r.from_note ?? null,
      link_status: 'unlinked' as const,
      transaction_date: r.transaction_date,
    }))

  if (inserts.length === 0) {
    return { error: 'No valid rows to import' }
  }

  const { data, error } = await supabase.from('payments').insert(inserts).select()
  if (error) return { error: error.message }

  revalidatePath('/payments')
  revalidatePath('/dashboard')
  return { data, count: data.length }
}
