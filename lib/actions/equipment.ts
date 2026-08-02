'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  requireMember,
  logActivity,
  parseInput,
  type Member,
  type ServerSupabase,
} from '@/lib/auth-helpers'
import {
  createEquipmentSchema,
  updateEquipmentSchema,
  equipmentIdSchema,
  reserveEquipmentSchema,
  cancelReservationSchema,
  listEquipmentReservationsSchema,
} from '@/lib/validations'
import { reservationEligibility, hasConflict } from '@/lib/equipment-logic'
import { isCertificationActive } from '@/lib/certifications-logic'
import { renderBookingEmail, bookingDedupeKey } from '@/lib/notifications-logic'
import {
  enqueueNotification,
  resolveMemberContact,
  getSpaceName,
  buildManageUrl,
} from '@/lib/notifications/enqueue'

type Gate =
  | { ok: true; supabase: ServerSupabase; member: Member }
  | { ok: false; error: string }

async function requireEquipmentManager(): Promise<Gate> {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { ok: false, error: auth.error }
  const { member } = auth
  const { data: allowed, error } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm: 'equipment.manage',
  })
  if (error) return { ok: false, error: error.message }
  if (!allowed) return { ok: false, error: 'You do not have permission to manage equipment' }
  return { ok: true, supabase, member }
}

async function holdsActiveCert(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  memberId: string,
  certificationId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('member_certifications')
    .select('revoked_at, expires_at')
    .eq('space_id', spaceId)
    .eq('member_id', memberId)
    .eq('certification_id', certificationId)
  return (data ?? []).some(r =>
    isCertificationActive({
      revoked_at: (r as { revoked_at: string | null }).revoked_at,
      expires_at: (r as { expires_at: string | null }).expires_at,
    }),
  )
}

// ─── Registry (equipment.manage) ─────────────────────────────────────────────

export async function createEquipment(input: unknown) {
  const gate = await requireEquipmentManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(createEquipmentSchema, input)
  if (!v.ok) return { error: v.error }
  const e = v.data

  if (e.required_certification_id) {
    const { data: cert } = await supabase
      .from('certifications')
      .select('id')
      .eq('id', e.required_certification_id)
      .eq('space_id', member.space_id)
      .maybeSingle()
    if (!cert) return { error: 'The selected certification was not found in this space.' }
  }

  const { data, error } = await supabase
    .from('equipment')
    .insert({
      space_id: member.space_id,
      name: e.name,
      description: e.description ?? null,
      location: e.location ?? null,
      status: e.status,
      required_certification_id: e.required_certification_id ?? null,
      asset_tag: e.asset_tag ?? null,
      created_by: member.id,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'created', 'equipment', data.id as string, e.name)
  revalidatePath('/equipment')
  revalidatePath('/equipment/manage')
  return { data: { id: data.id as string } }
}

export async function updateEquipment(input: unknown) {
  const gate = await requireEquipmentManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(updateEquipmentSchema, input)
  if (!v.ok) return { error: v.error }
  const u = v.data

  if (u.required_certification_id) {
    const { data: cert } = await supabase
      .from('certifications')
      .select('id')
      .eq('id', u.required_certification_id)
      .eq('space_id', member.space_id)
      .maybeSingle()
    if (!cert) return { error: 'The selected certification was not found in this space.' }
  }

  const patch: Record<string, unknown> = {}
  if (u.name !== undefined) patch.name = u.name
  if (u.description !== undefined) patch.description = u.description ?? null
  if (u.location !== undefined) patch.location = u.location ?? null
  if (u.status !== undefined) patch.status = u.status
  if (u.required_certification_id !== undefined) patch.required_certification_id = u.required_certification_id ?? null
  if (u.asset_tag !== undefined) patch.asset_tag = u.asset_tag ?? null
  if (u.is_active !== undefined) patch.is_active = u.is_active
  if (Object.keys(patch).length === 0) return { data: { id: u.equipmentId } }

  const { error } = await supabase
    .from('equipment')
    .update(patch)
    .eq('id', u.equipmentId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'updated', 'equipment', u.equipmentId)
  revalidatePath('/equipment')
  revalidatePath('/equipment/manage')
  return { data: { id: u.equipmentId } }
}

export async function deleteEquipment(input: unknown) {
  const gate = await requireEquipmentManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(equipmentIdSchema, input)
  if (!v.ok) return { error: v.error }

  const { count } = await supabase
    .from('equipment_reservations')
    .select('id', { count: 'exact', head: true })
    .eq('equipment_id', v.data.equipmentId)
  if ((count ?? 0) > 0) {
    return { error: 'This equipment has reservations. Archive it instead of deleting.' }
  }

  const { error } = await supabase
    .from('equipment')
    .delete()
    .eq('id', v.data.equipmentId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'deleted', 'equipment', v.data.equipmentId)
  revalidatePath('/equipment')
  revalidatePath('/equipment/manage')
  return { data: { id: v.data.equipmentId } }
}

export async function listEquipment() {
  const gate = await requireEquipmentManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const { data, error } = await supabase
    .from('equipment')
    .select('id, name, description, location, status, required_certification_id, asset_tag, is_active, certifications(name)')
    .eq('space_id', member.space_id)
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}

// ─── Member browse + reserve / cancel ────────────────────────────────────────

// Active equipment for the catalog. Any member. RLS already restricts to
// is_active for non-managers. Returns the required-cert name and whether the
// caller holds it (so the UI can show the gate before they try).
export async function listEquipmentForMembers() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('equipment')
    .select('id, name, description, location, status, required_certification_id, certifications(name)')
    .eq('space_id', member.space_id)
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (error) return { error: error.message }

  const admin = createAdminClient()
  const rows = await Promise.all(
    (data ?? []).map(async (e: Record<string, unknown>) => {
      const certId = e.required_certification_id as string | null
      const member_certified = certId
        ? await holdsActiveCert(admin, member.space_id, member.id, certId)
        : true
      return { ...e, member_certified }
    }),
  )
  return { data: rows }
}

export async function reserveEquipment(input: unknown) {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const v = parseInput(reserveEquipmentSchema, input)
  if (!v.ok) return { error: v.error }
  const r = v.data

  const { data: isMgr } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm: 'equipment.manage',
  })
  const managerOverride = !!isMgr

  // Only a manager may book on someone else's behalf.
  const targetMemberId = managerOverride && r.memberId ? r.memberId : member.id

  const { data: equip } = await supabase
    .from('equipment')
    .select('id, name, location, space_id, status, is_active, required_certification_id')
    .eq('id', r.equipmentId)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!equip) return { error: 'Equipment not found' }

  const admin = createAdminClient()

  // When booking on someone else's behalf, the target must belong to the
  // caller's space, mirroring signUpForClass. Without this a manager could
  // pass a member id from another space and stamp a reservation there.
  if (targetMemberId !== member.id) {
    const { data: tgt } = await admin
      .from('space_members')
      .select('id')
      .eq('id', targetMemberId)
      .eq('space_id', member.space_id)
      .maybeSingle()
    if (!tgt) return { error: 'That member was not found in this space.' }
  }

  const { data: existing } = await admin
    .from('equipment_reservations')
    .select('starts_at, ends_at, status')
    .eq('equipment_id', r.equipmentId)
  const conflict = hasConflict(
    r.starts_at,
    r.ends_at,
    (existing ?? []) as Array<{ starts_at: string; ends_at: string; status: string }>,
  )

  const requiresCert = !!equip.required_certification_id
  const memberHasCert = requiresCert
    ? await holdsActiveCert(admin, member.space_id, targetMemberId, equip.required_certification_id as string)
    : false

  const eligible = reservationEligibility({
    equipmentStatus: equip.status as string,
    equipmentActive: equip.is_active as boolean,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    conflict,
    requiresCert,
    memberHasCert,
    managerOverride,
  })
  if (!eligible.ok) return { error: eligible.reason }

  const { data, error } = await admin
    .from('equipment_reservations')
    .insert({
      equipment_id: r.equipmentId,
      space_id: member.space_id,
      member_id: targetMemberId,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      notes: r.notes ?? null,
      created_by: member.id,
    })
    .select('id')
    .single()
  if (error) {
    // The GiST exclusion constraint is the concurrency-safe arbiter: a
    // simultaneous request that passed the in-memory pre-check still loses
    // here. Surface the same friendly message as the pre-check.
    if (/exclusion constraint|equipment_reservations_no_overlap|23P01/i.test(error.message)) {
      return { error: 'That time overlaps an existing reservation.' }
    }
    return { error: error.message }
  }

  await logActivity(supabase, member, 'reserved', 'equipment', r.equipmentId)

  // Booking confirmation goes to the affected member (target), not the actor.
  // A manager booking on behalf of someone else still emails the booked-for
  // member. Wrapped: the reservation row is already committed, so a transient
  // DB error in the email path must NOT surface as an action error to the
  // client. enqueueNotification is internally best-effort; the wrap covers
  // resolveMemberContact, getSpaceName, and any other lookup that could throw.
  try {
    const contact = await resolveMemberContact(admin, member.space_id, targetMemberId)
    if (contact?.email) {
      const { subject, html, text } = renderBookingEmail({
        type: 'booking_confirmed',
        spaceName: await getSpaceName(admin, member.space_id),
        memberName: contact.displayName,
        equipmentName: (equip.name as string | null) ?? 'equipment',
        location: (equip.location as string | null) ?? null,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        manageUrl: buildManageUrl(null),
      })
      await enqueueNotification(admin, {
        spaceId: member.space_id,
        memberId: targetMemberId,
        type: 'booking_confirmed',
        recipient: contact.email,
        subject,
        bodyHtml: html,
        bodyText: text,
        dedupeKey: bookingDedupeKey('booking_confirmed', data.id as string),
      })
    }
  } catch (e) {
    console.error('[reserveEquipment] booking_confirmed enqueue failed:', e instanceof Error ? e.message : e)
  }

  revalidatePath('/equipment')
  revalidatePath('/me')
  return { data: { id: data.id as string } }
}

export async function cancelReservation(input: unknown) {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const v = parseInput(cancelReservationSchema, input)
  if (!v.ok) return { error: v.error }

  const admin = createAdminClient()
  const { data: res } = await admin
    .from('equipment_reservations')
    .select('id, space_id, member_id, status, equipment_id, starts_at, ends_at')
    .eq('id', v.data.reservationId)
    .maybeSingle()
  if (!res || res.space_id !== member.space_id) return { error: 'Reservation not found' }
  if (res.status === 'cancelled') return { error: 'That reservation is already cancelled.' }

  const ownIt = res.member_id === member.id
  let permitted = ownIt
  if (!permitted) {
    const { data: isMgr } = await supabase.rpc('user_has_permission', {
      uid: member.user_id as string,
      sid: member.space_id,
      perm: 'equipment.manage',
    })
    permitted = !!isMgr
  }
  if (!permitted) return { error: 'You can only cancel your own reservations.' }

  const { error } = await admin
    .from('equipment_reservations')
    .update({ status: 'cancelled' })
    .eq('id', v.data.reservationId)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'cancelled_reservation', 'equipment', res.equipment_id as string)

  // Cancel emails fire ONLY when someone other than the affected member
  // cancelled (a manager cancelling on the member's behalf). A self-cancel is
  // silent: the actor already saw the UI confirm and an email would be noise.
  // Wrapped: cancel is committed; transient errors in the email path must not
  // surface to the client.
  if (!ownIt) {
    try {
      const affectedMemberId = res.member_id as string
      const contact = await resolveMemberContact(admin, member.space_id, affectedMemberId)
      if (contact?.email) {
        const { data: equip } = await admin
          .from('equipment')
          .select('name, location')
          .eq('id', res.equipment_id as string)
          .eq('space_id', member.space_id)
          .maybeSingle()
        const { subject, html, text } = renderBookingEmail({
          type: 'booking_cancelled',
          spaceName: await getSpaceName(admin, member.space_id),
          memberName: contact.displayName,
          equipmentName: (equip?.name as string | null) ?? 'equipment',
          location: (equip?.location as string | null) ?? null,
          startsAt: res.starts_at as string,
          endsAt: res.ends_at as string,
          manageUrl: buildManageUrl(null),
        })
        await enqueueNotification(admin, {
          spaceId: member.space_id,
          memberId: affectedMemberId,
          type: 'booking_cancelled',
          recipient: contact.email,
          subject,
          bodyHtml: html,
          bodyText: text,
          dedupeKey: bookingDedupeKey('booking_cancelled', v.data.reservationId),
        })
      }
    } catch (e) {
      console.error('[cancelReservation] booking_cancelled enqueue failed:', e instanceof Error ? e.message : e)
    }
  }

  revalidatePath('/equipment')
  revalidatePath('/me')
  return { data: { id: v.data.reservationId } }
}

export async function listEquipmentReservations(input: unknown) {
  const gate = await requireEquipmentManager()
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(listEquipmentReservationsSchema, input)
  if (!v.ok) return { error: v.error }

  const { data, error } = await supabase
    .from('equipment_reservations')
    .select('id, member_id, starts_at, ends_at, status, notes, space_members(display_name, email)')
    .eq('space_id', member.space_id)
    .eq('equipment_id', v.data.equipmentId)
    .order('starts_at', { ascending: true })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function getMyReservations() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('equipment_reservations')
    .select('id, starts_at, ends_at, status, notes, equipment(name, location)')
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .order('starts_at', { ascending: false })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}
