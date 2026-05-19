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
  createClassSchema,
  updateClassSchema,
  classIdSchema,
  createSessionSchema,
  updateSessionSchema,
  sessionIdSchema,
  signUpForClassSchema,
  cancelSignupSchema,
  markAttendanceSchema,
  listSessionSignupsSchema,
} from '@/lib/validations'
import {
  canSignUp,
  signupFormEligibility,
} from '@/lib/classes-logic'
import { grantCertification } from './certifications'

// A class manager need not hold forms.manage, so form lookups + the
// submission gate use the service client (scoped by space_id) and never
// return form answers -- only existence/metadata.
async function findSpaceForm(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  formId: string,
): Promise<{ id: string; status: string; title: string; slug: string } | null> {
  const { data } = await admin
    .from('forms')
    .select('id, status, title, slug')
    .eq('id', formId)
    .eq('space_id', spaceId)
    .maybeSingle()
  return data
    ? {
        id: data.id as string,
        status: data.status as string,
        title: data.title as string,
        slug: data.slug as string,
      }
    : null
}

async function hasFormSubmission(
  admin: ReturnType<typeof createAdminClient>,
  spaceId: string,
  memberId: string,
  formId: string,
): Promise<boolean> {
  const { count } = await admin
    .from('form_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('space_id', spaceId)
    .eq('form_id', formId)
    .eq('member_id', memberId)
  return (count ?? 0) > 0
}

type Gate =
  | { ok: true; supabase: ServerSupabase; member: Member }
  | { ok: false; error: string }

async function requirePermission(
  perm: 'classes.manage' | 'classes.instruct',
): Promise<Gate> {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { ok: false, error: auth.error }
  const { member } = auth
  const { data: allowed, error } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm,
  })
  if (error) return { ok: false, error: error.message }
  if (!allowed) {
    return {
      ok: false,
      error:
        perm === 'classes.manage'
          ? 'You do not have permission to manage classes'
          : 'You do not have permission to run classes',
    }
  }
  return { ok: true, supabase, member }
}

// ─── Class definitions (classes.manage) ──────────────────────────────────────

export async function createClass(input: unknown) {
  const gate = await requirePermission('classes.manage')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(createClassSchema, input)
  if (!v.ok) return { error: v.error }
  const c = v.data

  if (c.grants_certification_id) {
    const { data: cert } = await supabase
      .from('certifications')
      .select('id')
      .eq('id', c.grants_certification_id)
      .eq('space_id', member.space_id)
      .maybeSingle()
    if (!cert) return { error: 'The selected certification was not found in this space.' }
  }

  if (c.required_form_id) {
    const form = await findSpaceForm(createAdminClient(), member.space_id, c.required_form_id)
    if (!form) return { error: 'The selected form was not found in this space.' }
    if (form.status !== 'published') return { error: 'The required form must be published before it can gate signups.' }
  }

  const { data, error } = await supabase
    .from('classes')
    .insert({
      space_id: member.space_id,
      title: c.title,
      description: c.description ?? null,
      payment_link: c.payment_link ?? null,
      capacity: c.capacity ?? null,
      grants_certification_id: c.grants_certification_id ?? null,
      required_form_id: c.required_form_id ?? null,
      created_by: member.id,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'created', 'class', data.id as string, c.title)
  revalidatePath('/classes')
  return { data: { id: data.id as string } }
}

export async function updateClass(input: unknown) {
  const gate = await requirePermission('classes.manage')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(updateClassSchema, input)
  if (!v.ok) return { error: v.error }
  const u = v.data

  if (u.grants_certification_id) {
    const { data: cert } = await supabase
      .from('certifications')
      .select('id')
      .eq('id', u.grants_certification_id)
      .eq('space_id', member.space_id)
      .maybeSingle()
    if (!cert) return { error: 'The selected certification was not found in this space.' }
  }

  if (u.required_form_id) {
    const form = await findSpaceForm(createAdminClient(), member.space_id, u.required_form_id)
    if (!form) return { error: 'The selected form was not found in this space.' }
    if (form.status !== 'published') return { error: 'The required form must be published before it can gate signups.' }
  }

  const patch: Record<string, unknown> = {}
  if (u.title !== undefined) patch.title = u.title
  if (u.description !== undefined) patch.description = u.description ?? null
  if (u.payment_link !== undefined) patch.payment_link = u.payment_link ?? null
  if (u.capacity !== undefined) patch.capacity = u.capacity ?? null
  if (u.grants_certification_id !== undefined) patch.grants_certification_id = u.grants_certification_id ?? null
  if (u.required_form_id !== undefined) patch.required_form_id = u.required_form_id ?? null
  if (u.is_active !== undefined) patch.is_active = u.is_active
  if (Object.keys(patch).length === 0) return { data: { id: u.classId } }

  const { error } = await supabase
    .from('classes')
    .update(patch)
    .eq('id', u.classId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'updated', 'class', u.classId)
  revalidatePath('/classes')
  return { data: { id: u.classId } }
}

export async function deleteClass(input: unknown) {
  const gate = await requirePermission('classes.manage')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(classIdSchema, input)
  if (!v.ok) return { error: v.error }

  const { count } = await supabase
    .from('class_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', v.data.classId)
  if ((count ?? 0) > 0) {
    return { error: 'This class has scheduled sessions. Archive it instead of deleting.' }
  }

  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', v.data.classId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'deleted', 'class', v.data.classId)
  revalidatePath('/classes')
  return { data: { id: v.data.classId } }
}

export async function listClasses() {
  const gate = await requirePermission('classes.manage')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const { data, error } = await supabase
    .from('classes')
    .select('id, title, description, payment_link, capacity, is_active, grants_certification_id, required_form_id, created_at, updated_at')
    .eq('space_id', member.space_id)
    .order('is_active', { ascending: false })
    .order('title', { ascending: true })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}


// ─── Sessions (classes.manage) ───────────────────────────────────────────────

export async function createSession(input: unknown) {
  const gate = await requirePermission('classes.manage')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(createSessionSchema, input)
  if (!v.ok) return { error: v.error }
  const s = v.data

  const { data: cls } = await supabase
    .from('classes')
    .select('id')
    .eq('id', s.classId)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!cls) return { error: 'Class not found in this space' }

  const { data, error } = await supabase
    .from('class_sessions')
    .insert({
      class_id: s.classId,
      space_id: member.space_id,
      starts_at: s.starts_at,
      ends_at: s.ends_at ?? null,
      location: s.location ?? null,
      capacity: s.capacity ?? null,
      notes: s.notes ?? null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'created', 'class_session', data.id as string)
  revalidatePath('/classes')
  return { data: { id: data.id as string } }
}

export async function updateSession(input: unknown) {
  const gate = await requirePermission('classes.manage')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(updateSessionSchema, input)
  if (!v.ok) return { error: v.error }
  const u = v.data

  // Completion runs cert-on-completion side effects; force it through
  // completeSession instead of a bare status flip here.
  if (u.status === 'completed') {
    return { error: 'Use completeSession to complete a session.' }
  }

  const patch: Record<string, unknown> = {}
  if (u.starts_at !== undefined) patch.starts_at = u.starts_at
  if (u.ends_at !== undefined) patch.ends_at = u.ends_at ?? null
  if (u.location !== undefined) patch.location = u.location ?? null
  if (u.capacity !== undefined) patch.capacity = u.capacity ?? null
  if (u.notes !== undefined) patch.notes = u.notes ?? null
  if (u.status !== undefined) patch.status = u.status
  if (Object.keys(patch).length === 0) return { data: { id: u.sessionId } }

  const { error } = await supabase
    .from('class_sessions')
    .update(patch)
    .eq('id', u.sessionId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'updated', 'class_session', u.sessionId)
  revalidatePath('/classes')
  return { data: { id: u.sessionId } }
}

export async function deleteSession(input: unknown) {
  const gate = await requirePermission('classes.manage')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(sessionIdSchema, input)
  if (!v.ok) return { error: v.error }

  const { count } = await supabase
    .from('class_signups')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', v.data.sessionId)
    .neq('status', 'cancelled')
  if ((count ?? 0) > 0) {
    return { error: 'This session has signups. Cancel it instead of deleting.' }
  }

  const { error } = await supabase
    .from('class_sessions')
    .delete()
    .eq('id', v.data.sessionId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  await logActivity(supabase, member, 'deleted', 'class_session', v.data.sessionId)
  revalidatePath('/classes')
  return { data: { id: v.data.sessionId } }
}

// Upcoming sessions for the member catalog/calendar. Any space member. Counts
// come from the service client so a member sees "spots left" without being
// able to read who else signed up (class_signups SELECT hides other members).
export async function listUpcomingSessions() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const nowIso = new Date().toISOString()
  const { data: sessions, error } = await supabase
    .from('class_sessions')
    .select('id, class_id, starts_at, ends_at, location, capacity, status, notes, classes(title, description, payment_link, capacity, is_active, grants_certification_id, required_form_id)')
    .eq('space_id', member.space_id)
    .neq('status', 'cancelled')
    .gte('starts_at', nowIso)
    .order('starts_at', { ascending: true })
  if (error) return { error: error.message }

  const rows = (sessions ?? []).filter(
    (s: { classes?: { is_active?: boolean } | null }) => s.classes?.is_active !== false,
  )
  const ids = rows.map((s: { id: string }) => s.id)

  const counts: Record<string, number> = {}
  const mine: Record<string, string> = {}
  // required_form_id -> { slug, title } and whether THIS member has it on file.
  const formMeta: Record<string, { slug: string; title: string }> = {}
  const mySatisfiedForms = new Set<string>()
  let spaceSlug: string | null = null
  if (ids.length > 0) {
    const admin = createAdminClient()
    const { data: agg } = await admin
      .from('class_signups')
      .select('session_id, status')
      .in('session_id', ids)
    for (const r of agg ?? []) {
      if ((r as { status: string }).status === 'registered') {
        const sid = (r as { session_id: string }).session_id
        counts[sid] = (counts[sid] ?? 0) + 1
      }
    }
    const { data: my } = await supabase
      .from('class_signups')
      .select('session_id, status')
      .in('session_id', ids)
      .eq('member_id', member.id)
      .neq('status', 'cancelled')
    for (const r of my ?? []) {
      mine[(r as { session_id: string }).session_id] = (r as { status: string }).status
    }

    const formIds = Array.from(
      new Set(
        rows
          .map((s: { classes?: { required_form_id?: string | null } | null }) => s.classes?.required_form_id)
          .filter((x): x is string => !!x),
      ),
    )
    if (formIds.length > 0) {
      const { data: forms } = await admin
        .from('forms')
        .select('id, slug, title')
        .in('id', formIds)
      for (const f of forms ?? []) {
        formMeta[f.id as string] = { slug: f.slug as string, title: f.title as string }
      }
      const { data: subs } = await admin
        .from('form_submissions')
        .select('form_id')
        .eq('space_id', member.space_id)
        .eq('member_id', member.id)
        .in('form_id', formIds)
      for (const sub of subs ?? []) mySatisfiedForms.add(sub.form_id as string)
      const { data: space } = await admin
        .from('spaces')
        .select('slug')
        .eq('id', member.space_id)
        .maybeSingle()
      spaceSlug = (space?.slug as string | undefined) ?? null
    }
  }

  return {
    data: rows.map((s: Record<string, unknown>) => {
      const cls = s.classes as { required_form_id?: string | null } | null
      const rfid = cls?.required_form_id ?? null
      const meta = rfid ? formMeta[rfid] ?? null : null
      return {
        ...s,
        registered_count: counts[s.id as string] ?? 0,
        my_status: mine[s.id as string] ?? null,
        required_form:
          rfid && meta
            ? {
                title: meta.title,
                url: spaceSlug ? `/f/${spaceSlug}/${meta.slug}` : null,
                satisfied: mySatisfiedForms.has(rfid),
              }
            : null,
      }
    }),
  }
}

// ─── Member signup / cancel (validated, service-client) ──────────────────────

export async function signUpForClass(input: unknown) {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const v = parseInput(signUpForClassSchema, input)
  if (!v.ok) return { error: v.error }

  const { data: session } = await supabase
    .from('class_sessions')
    .select('id, space_id, status, starts_at, ends_at, capacity, classes(capacity, is_active, required_form_id)')
    .eq('id', v.data.sessionId)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!session) return { error: 'Session not found' }
  const cls = (session as {
    classes?: { capacity: number | null; is_active: boolean; required_form_id: string | null } | null
  }).classes
  if (cls && cls.is_active === false) return { error: 'This class is no longer available.' }

  const { data: isMgr } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm: 'classes.manage',
  })
  const managerOverride = !!isMgr
  // Only a manager may sign someone else up.
  const targetMemberId = managerOverride && v.data.memberId ? v.data.memberId : member.id

  const admin = createAdminClient()

  if (targetMemberId !== member.id) {
    const { data: tgt } = await admin
      .from('space_members')
      .select('id')
      .eq('id', targetMemberId)
      .eq('space_id', member.space_id)
      .maybeSingle()
    if (!tgt) return { error: 'That member was not found in this space.' }
  }

  const eligible = canSignUp({
    sessionStatus: session.status as string,
    startsAt: session.starts_at as string,
    endsAt: session.ends_at as string | null,
  })
  if (!eligible.ok) return { error: eligible.reason }

  // Optional per-class form gate (waiver-on-file). A manager override
  // bypasses it, mirroring the equipment required-cert gate.
  const requiredFormId = cls?.required_form_id ?? null
  const memberHasForm = requiredFormId
    ? await hasFormSubmission(admin, member.space_id, targetMemberId, requiredFormId)
    : false
  const formOk = signupFormEligibility({
    requiresForm: !!requiredFormId,
    memberHasForm,
    managerOverride,
  })
  if (!formOk.ok) return { error: formOk.reason }

  // Capacity decision + dup-check + insert run atomically inside
  // class_signup_tx under a per-session advisory lock, so concurrent signups
  // at the capacity boundary cannot over-enroll. computeSignupStatus stays
  // the documented rule; the RPC is the runtime authority (045).
  const { data: rpc, error } = await admin.rpc('class_signup_tx', {
    p_session_id: v.data.sessionId,
    p_space_id: member.space_id,
    p_member_id: targetMemberId,
  })
  if (error) return { error: error.message }
  const row = (Array.isArray(rpc) ? rpc[0] : rpc) as
    | { signup_id: string | null; signup_status: string | null; err: string | null }
    | undefined
  if (!row || row.err) {
    if (row?.err === 'already') {
      return { error: targetMemberId === member.id ? 'You are already signed up for this session.' : 'That member is already signed up for this session.' }
    }
    if (row?.err === 'no_session') return { error: 'Session not found' }
    return { error: 'Could not complete signup. Please try again.' }
  }
  const status = row.signup_status as string

  await logActivity(supabase, member, 'signed_up', 'class_session', v.data.sessionId)
  revalidatePath('/classes')
  revalidatePath('/me')
  return { data: { id: row.signup_id as string, status } }
}

export async function cancelMySignup(input: unknown) {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const v = parseInput(cancelSignupSchema, input)
  if (!v.ok) return { error: v.error }

  const admin = createAdminClient()
  // Cancel + waitlist promotion run atomically inside class_cancel_tx under
  // the same per-session advisory lock, so concurrent cancels cannot double-
  // promote. pickPromotion stays the documented rule; the RPC is the runtime
  // authority (045). p_space_id pins every write cross-space-safe.
  const { data: rpc, error } = await admin.rpc('class_cancel_tx', {
    p_session_id: v.data.sessionId,
    p_space_id: member.space_id,
    p_member_id: member.id,
  })
  if (error) return { error: error.message }
  const row = (Array.isArray(rpc) ? rpc[0] : rpc) as
    | { cancelled_id: string | null; promoted_id: string | null; err: string | null }
    | undefined
  if (!row || row.err) {
    if (row?.err === 'not_signed_up') return { error: 'You are not signed up for this session.' }
    return { error: 'Could not cancel. Please try again.' }
  }

  await logActivity(supabase, member, 'cancelled_signup', 'class_session', v.data.sessionId)
  revalidatePath('/classes')
  revalidatePath('/me')
  return { data: { id: row.cancelled_id as string } }
}

// ─── Instructor: attendees, attendance, completion ───────────────────────────

export async function listSessionSignups(input: unknown) {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const v = parseInput(listSessionSignupsSchema, input)
  if (!v.ok) return { error: v.error }

  const { data: canManage } = await supabase.rpc('user_has_permission', {
    uid: member.user_id as string,
    sid: member.space_id,
    perm: 'classes.manage',
  })
  let permitted = !!canManage
  if (!permitted) {
    const { data: canInstruct } = await supabase.rpc('user_has_permission', {
      uid: member.user_id as string,
      sid: member.space_id,
      perm: 'classes.instruct',
    })
    permitted = !!canInstruct
  }
  if (!permitted) return { error: 'You do not have permission to view attendees' }

  const { data, error } = await supabase
    .from('class_signups')
    .select('id, member_id, status, attended, signed_up_at, space_members(display_name, email)')
    .eq('space_id', member.space_id)
    .eq('session_id', v.data.sessionId)
    .order('signed_up_at', { ascending: true })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function markAttendance(input: unknown) {
  const gate = await requirePermission('classes.instruct')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(markAttendanceSchema, input)
  if (!v.ok) return { error: v.error }

  const { error } = await supabase
    .from('class_signups')
    .update({ attended: v.data.attended })
    .eq('id', v.data.signupId)
    .eq('space_id', member.space_id)
  if (error) return { error: error.message }

  revalidatePath('/classes')
  return { data: { id: v.data.signupId } }
}

// Complete a session: mark it completed and, if the class grants a
// certification, award it to every attended member. The cert award goes
// through the normal certifications path, so it only happens if the acting
// instructor also holds certifications.grant; otherwise completion still
// succeeds and the response says certificates were not issued.
export async function completeSession(input: unknown) {
  const gate = await requirePermission('classes.instruct')
  if (!gate.ok) return { error: gate.error }
  const { supabase, member } = gate

  const v = parseInput(sessionIdSchema, input)
  if (!v.ok) return { error: v.error }

  const { data: session } = await supabase
    .from('class_sessions')
    .select('id, space_id, status, class_id, classes(title, grants_certification_id)')
    .eq('id', v.data.sessionId)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!session) return { error: 'Session not found' }
  if (session.status === 'completed') return { error: 'This session is already completed.' }

  // The class_sessions UPDATE policy is classes.manage; completing is an
  // instructor action, so this validated transition is written with the
  // service client (same funnel pattern as member signup).
  const admin = createAdminClient()
  const { error: upErr } = await admin
    .from('class_sessions')
    .update({ status: 'completed' })
    .eq('id', v.data.sessionId)
    .eq('space_id', member.space_id)
  if (upErr) return { error: upErr.message }

  const cls = (session as { classes?: { title: string; grants_certification_id: string | null } | null }).classes
  let issued = 0
  let certSkipped = false
  if (cls?.grants_certification_id) {
    const { data: attended } = await supabase
      .from('class_signups')
      .select('member_id')
      .eq('space_id', member.space_id)
      .eq('session_id', v.data.sessionId)
      .eq('attended', true)
      .neq('status', 'cancelled')
    for (const a of attended ?? []) {
      const res = await grantCertification({
        memberId: (a as { member_id: string }).member_id,
        certificationId: cls.grants_certification_id,
      })
      if ('error' in res && res.error) {
        // Permission error -> instructor lacks certifications.grant; stop and
        // report. "Already holds" is fine to skip silently.
        if (/permission/i.test(res.error)) {
          certSkipped = true
          break
        }
      } else {
        issued += 1
      }
    }
  }

  await logActivity(supabase, member, 'completed', 'class_session', v.data.sessionId, cls?.title ?? null)
  revalidatePath('/classes')
  revalidatePath('/me')
  return {
    data: {
      id: v.data.sessionId,
      certificatesIssued: issued,
      certificatesSkipped: certSkipped,
    },
  }
}

// The signed-in member's own signups (the /me view). No params; RLS
// independently restricts a member to their own rows.
export async function getMyClassSignups() {
  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { data, error } = await supabase
    .from('class_signups')
    .select('id, status, attended, signed_up_at, class_sessions(id, starts_at, ends_at, location, status, classes(title))')
    .eq('space_id', member.space_id)
    .eq('member_id', member.id)
    .order('signed_up_at', { ascending: false })
  if (error) return { error: error.message }
  return { data: data ?? [] }
}
