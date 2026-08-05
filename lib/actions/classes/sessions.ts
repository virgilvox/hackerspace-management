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
  createSessionSchema,
  updateSessionSchema,
  sessionIdSchema,
} from '@/lib/validations'
import { requirePermission } from './_guard'
import { renderClassEmail, classDedupeKey } from '@/lib/notifications-logic'
import {
  enqueueNotification,
  resolveMemberContact,
  getSpaceName,
  buildManageUrl,
} from '@/lib/notifications/enqueue'

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

  // Session-cancellation fan-out: when an instructor/manager flips a session
  // to 'cancelled', every signed-up member needs to know (the only other
  // place that lives is /me, and they probably aren't checking it). One
  // outbox row per (session, member); dedupe collapses a re-cancel.
  // Wrapped: the session update is committed; transient DB errors in the
  // fan-out must never surface to the action's result.
  if (u.status === 'cancelled') {
    try {
      const admin = createAdminClient()
      const { data: sessRow } = await admin
        .from('class_sessions')
        .select('starts_at, ends_at, location, classes(title)')
        .eq('id', u.sessionId)
        .eq('space_id', member.space_id)
        .maybeSingle()
      const sessShape = sessRow as {
        starts_at: string | null
        ends_at: string | null
        location: string | null
        classes?: { title: string | null } | null
      } | null
      const { data: signups } = await admin
        .from('class_signups')
        .select('member_id')
        .eq('space_id', member.space_id)
        .eq('session_id', u.sessionId)
        .neq('status', 'cancelled')
      const memberIds = Array.from(
        new Set(((signups ?? []) as Array<{ member_id: string }>).map(s => s.member_id)),
      )
      if (memberIds.length > 0) {
        const spaceName = await getSpaceName(admin, member.space_id)
        const manageUrl = buildManageUrl(null)
        for (const affectedMemberId of memberIds) {
          const contact = await resolveMemberContact(admin, member.space_id, affectedMemberId)
          if (!contact?.email) continue
          const { subject, html, text } = renderClassEmail({
            type: 'class_session_cancelled',
            spaceName,
            memberName: contact.displayName,
            className: sessShape?.classes?.title ?? '',
            location: sessShape?.location ?? null,
            startsAt: sessShape?.starts_at ?? null,
            endsAt: sessShape?.ends_at ?? null,
            manageUrl,
          })
          await enqueueNotification(admin, {
            spaceId: member.space_id,
            memberId: affectedMemberId,
            type: 'class_session_cancelled',
            recipient: contact.email,
            subject,
            bodyHtml: html,
            bodyText: text,
            dedupeKey: classDedupeKey('class_session_cancelled', {
              sessionId: u.sessionId,
              memberId: affectedMemberId,
            }),
          })
        }
      }
    } catch (e) {
      console.error('[updateSession] class_session_cancelled fan-out failed:', e instanceof Error ? e.message : e)
    }
  }

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
    (s) => s.classes?.is_active !== false,
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
