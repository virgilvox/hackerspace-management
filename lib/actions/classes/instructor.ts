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
  sessionIdSchema,
  markAttendanceSchema,
  listSessionSignupsSchema,
} from '@/lib/validations'
import { requirePermission } from './_guard'
import { grantCertification } from '../certifications'

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
  const { member } = gate
  const supabase = await createClient()

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

  const cls = session.classes
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
