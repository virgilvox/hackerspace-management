'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMember, logActivity, parseInput } from '@/lib/auth-helpers'
import { checkInSchema, checkOutSchema } from '@/lib/validations'
import { presenceStatus, hostEligibility } from '@/lib/presence-logic'

function isUniqueViolation(message: string): boolean {
  return /duplicate key value|already exists|unique constraint/i.test(message)
}

function revalidatePresence() {
  revalidatePath('/dashboard')
  revalidatePath('/attendance')
  revalidatePath('/me')
}

// Check the signed-in member in. Self-only: the member is resolved
// server-side, never taken from input. At most one open visit per member is
// enforced by a partial unique index; a stale open visit (forgotten
// check-out) is auto-closed first. Checking in as a host may require an
// active access card depending on the space's host_requires_card setting.
export async function checkIn(input: unknown) {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const v = parseInput(checkInSchema, input)
  if (!v.ok) return { error: v.error }
  const { asHost, note } = v.data

  const admin = createAdminClient()

  if (asHost) {
    const { data: space } = await admin
      .from('spaces')
      .select('host_requires_card')
      .eq('id', member.space_id)
      .maybeSingle()
    const hostRequiresCard = space?.host_requires_card ?? true
    const { count: cardCount } = await admin
      .from('member_cards')
      .select('id', { count: 'exact', head: true })
      .eq('space_id', member.space_id)
      .eq('member_id', member.id)
      .eq('is_active', true)
    const elig = hostEligibility({
      asHost: true,
      hasActiveCard: (cardCount ?? 0) > 0,
      hostRequiresCard,
    })
    if (!elig.ok) return { error: elig.reason }
  }

  // One open visit per member. If a stale open visit exists, auto-close it
  // and continue; if a fresh one exists, they are already here.
  const { data: open } = await admin
    .from('space_visits')
    .select('id, checked_in_at')
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .is('checked_out_at', null)
    .maybeSingle()
  if (open) {
    if (presenceStatus(open.checked_in_at as string, null) === 'present') {
      return { error: 'You are already checked in. Check out first if you are leaving.' }
    }
    await admin
      .from('space_visits')
      .update({ checked_out_at: new Date().toISOString(), check_out_note: 'auto-closed (forgotten check-out)' })
      .eq('id', open.id)
      .eq('space_id', member.space_id)
  }

  const { data, error } = await admin
    .from('space_visits')
    .insert({
      space_id: member.space_id,
      member_id: member.id,
      is_host: asHost,
      check_in_note: note ?? null,
    })
    .select('id')
    .single()
  if (error) {
    if (isUniqueViolation(error.message)) {
      return { error: 'You are already checked in.' }
    }
    return { error: error.message }
  }

  await logActivity(supabase, member, asHost ? 'checked in (host)' : 'checked in', 'space_visit', data.id as string)
  revalidatePresence()
  return { data: { id: data.id as string, is_host: asHost } }
}

// Check the signed-in member out of their current open visit.
export async function checkOut(input: unknown) {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const v = parseInput(checkOutSchema, input)
  if (!v.ok) return { error: v.error }

  const admin = createAdminClient()
  const { data: open } = await admin
    .from('space_visits')
    .select('id')
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .is('checked_out_at', null)
    .maybeSingle()
  if (!open) return { error: 'You are not checked in.' }

  const { error } = await admin
    .from('space_visits')
    .update({ checked_out_at: new Date().toISOString(), check_out_note: v.data.note ?? null })
    .eq('id', open.id)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'checked out', 'space_visit', open.id as string)
  revalidatePresence()
  return { data: { id: open.id as string } }
}

type VisitRow = {
  id: string
  member_id: string
  checked_in_at: string
  checked_out_at: string | null
  is_host: boolean
  check_in_note: string | null
  check_out_note: string | null
  space_members: { display_name: string | null } | { display_name: string | null }[] | null
}

function memberName(r: VisitRow): string {
  const sm = r.space_members
  const name = Array.isArray(sm) ? sm[0]?.display_name : sm?.display_name
  return name ?? 'Member'
}

// Who is here right now. Any space member may see this (presence is social).
// Service client scoped by space_id; staleness is applied in pure logic so a
// forgotten check-out does not show as present.
export async function listPresentNow() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await createAdminClient()
    .from('space_visits')
    .select('id, member_id, checked_in_at, checked_out_at, is_host, check_in_note, check_out_note, space_members!space_visits_member_id_fkey(display_name)')
    .eq('space_id', member.space_id)
    .is('checked_out_at', null)
    .order('checked_in_at', { ascending: true })
  if (error) return { error: error.message }

  const rows = (data ?? []) as unknown as VisitRow[]
  return {
    data: rows
      .filter(r => presenceStatus(r.checked_in_at, r.checked_out_at) === 'present')
      .map(r => ({
        id: r.id,
        memberId: r.member_id,
        name: memberName(r),
        isHost: r.is_host,
        isMe: r.member_id === member.id,
        checkedInAt: r.checked_in_at,
        note: r.check_in_note,
      })),
  }
}

// The signed-in member's own recent visits (for /me).
export async function getMyVisits() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await createAdminClient()
    .from('space_visits')
    .select('id, checked_in_at, checked_out_at, is_host, check_in_note, check_out_note')
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .order('checked_in_at', { ascending: false })
    .limit(50)
  if (error) return { error: error.message }
  return { data: data ?? [] }
}

// Org-wide attendance history. Visible to any space member (product
// decision). Service client scoped by space_id; most recent first.
export async function listAttendance() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await createAdminClient()
    .from('space_visits')
    .select('id, member_id, checked_in_at, checked_out_at, is_host, check_in_note, check_out_note, space_members!space_visits_member_id_fkey(display_name)')
    .eq('space_id', member.space_id)
    .order('checked_in_at', { ascending: false })
    .limit(250)
  if (error) return { error: error.message }

  const rows = (data ?? []) as unknown as VisitRow[]
  return {
    data: rows.map(r => ({
      id: r.id,
      name: memberName(r),
      isHost: r.is_host,
      status: presenceStatus(r.checked_in_at, r.checked_out_at),
      checkedInAt: r.checked_in_at,
      checkedOutAt: r.checked_out_at,
      checkInNote: r.check_in_note,
      checkOutNote: r.check_out_note,
    })),
  }
}
