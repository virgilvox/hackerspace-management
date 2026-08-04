'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  requireMember,
  logActivity,
  parseInput,
} from '@/lib/auth-helpers'
import {
  signUpForClassSchema,
  cancelSignupSchema,
} from '@/lib/validations'
import {
  canSignUp,
  signupFormEligibility,
} from '@/lib/classes-logic'
import { hasFormSubmission } from './_forms'
import { renderClassEmail, classDedupeKey } from '@/lib/notifications-logic'
import {
  enqueueNotification,
  resolveMemberContact,
  getSpaceName,
  buildManageUrl,
} from '@/lib/notifications/enqueue'

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
    .select('id, space_id, status, starts_at, ends_at, location, capacity, classes(title, capacity, is_active, required_form_id)')
    .eq('id', v.data.sessionId)
    .eq('space_id', member.space_id)
    .maybeSingle()
  if (!session) return { error: 'Session not found' }
  // TODO(types): remove after regenerating types/database.ts (missing FK relationship metadata)
  const cls = (session as unknown as {
    classes?: { title: string | null; capacity: number | null; is_active: boolean; required_form_id: string | null } | null
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

  // Signup confirmation to the affected member (target, not actor): a manager
  // signing someone else up still emails the booked-for member. Registered
  // and waitlisted use different copy; the type derives from the RPC's
  // signup_status. Wrapped: the signup is already written by the RPC, so the
  // email path must never surface an error to the action's result.
  const signupType =
    status === 'registered'
      ? ('class_signup_registered' as const)
      : status === 'waitlisted'
        ? ('class_signup_waitlisted' as const)
        : null
  if (signupType) {
    try {
      const contact = await resolveMemberContact(admin, member.space_id, targetMemberId)
      if (contact?.email) {
        const { subject, html, text } = renderClassEmail({
          type: signupType,
          spaceName: await getSpaceName(admin, member.space_id),
          memberName: contact.displayName,
          className: cls?.title ?? '',
          location: (session.location as string | null) ?? null,
          startsAt: session.starts_at as string,
          endsAt: (session.ends_at as string | null) ?? null,
          manageUrl: buildManageUrl(null),
        })
        await enqueueNotification(admin, {
          spaceId: member.space_id,
          memberId: targetMemberId,
          type: signupType,
          recipient: contact.email,
          subject,
          bodyHtml: html,
          bodyText: text,
          dedupeKey: classDedupeKey(signupType, { signupId: row.signup_id }),
        })
      }
    } catch (e) {
      console.error(`[signUpForClass] ${signupType} enqueue failed:`, e instanceof Error ? e.message : e)
    }
  }

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

  // Waitlist promotion: someone else was bumped from waitlist into the
  // session by this cancel. Tell them, since the only place that information
  // lives otherwise is /me. Wrapped: cancel + promotion are already committed
  // by class_cancel_tx; the email path must never surface an error.
  if (row.promoted_id) {
    try {
      const { data: promo } = await admin
        .from('class_signups')
        .select(
          'id, member_id, class_sessions(starts_at, ends_at, location, classes(title))',
        )
        .eq('id', row.promoted_id)
        .eq('space_id', member.space_id)
        .maybeSingle()
      const promotedMemberId = (promo?.member_id as string | null) ?? null
      const promoSession = (promo as { class_sessions?: {
        starts_at: string | null
        ends_at: string | null
        location: string | null
        classes?: { title: string | null } | null
      } | null } | null)?.class_sessions
      if (promotedMemberId) {
        const contact = await resolveMemberContact(admin, member.space_id, promotedMemberId)
        if (contact?.email) {
          const { subject, html, text } = renderClassEmail({
            type: 'class_signup_promoted',
            spaceName: await getSpaceName(admin, member.space_id),
            memberName: contact.displayName,
            className: promoSession?.classes?.title ?? '',
            location: promoSession?.location ?? null,
            startsAt: promoSession?.starts_at ?? null,
            endsAt: promoSession?.ends_at ?? null,
            manageUrl: buildManageUrl(null),
          })
          await enqueueNotification(admin, {
            spaceId: member.space_id,
            memberId: promotedMemberId,
            type: 'class_signup_promoted',
            recipient: contact.email,
            subject,
            bodyHtml: html,
            bodyText: text,
            dedupeKey: classDedupeKey('class_signup_promoted', { signupId: row.promoted_id }),
          })
        }
      }
    } catch (e) {
      console.error('[cancelMySignup] class_signup_promoted enqueue failed:', e instanceof Error ? e.message : e)
    }
  }

  revalidatePath('/classes')
  revalidatePath('/me')
  return { data: { id: row.cancelled_id as string } }
}
