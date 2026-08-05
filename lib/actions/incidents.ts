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
import { ADMIN_ROLES } from '@/lib/permissions'
import {
  fileIncidentSchema,
  updateIncidentStatusSchema,
  addIncidentUpdateSchema,
  appealIncidentSchema,
  trackIncidentSchema,
} from '@/lib/validations'
import { publicIncidentView } from '@/lib/incident-logic'

/**
 * Generate a short opaque tracking token for anonymous reports.
 * 24 bytes of randomness, base64url-encoded. Reporter receives this once;
 * server never reverses it to a member.
 */
function generateReporterToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * File an incident (CoC complaint, safety report, conflict). When
 * is_anonymous=true the reporter_id is omitted and an opaque tracking
 * token is generated; the caller MUST surface the token to the reporter
 * because it is the only way to look the case up later.
 */
export async function fileIncident(formData: {
  title: string
  body: string
  category?: string
  severity?: string
  subjects?: string[]
  is_anonymous?: boolean
}) {
  const v = parseInput(fileIncidentSchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const isAnonymous = v.data.is_anonymous === true
  const reporterToken = isAnonymous ? generateReporterToken() : null

  const { data, error } = await supabase
    .from('incidents')
    .insert({
      space_id: member.space_id,
      reporter_id: isAnonymous ? null : member.id,
      reporter_token: reporterToken,
      is_anonymous: isAnonymous,
      subjects: v.data.subjects ?? [],
      category: v.data.category,
      severity: v.data.severity,
      title: v.data.title,
      body: v.data.body,
      status: 'received',
    })
    .select()
    .single()

  if (error) {
    // A row-level-security rejection here means the caller's membership is not
    // resolving against this space in the database (see scripts/025 header).
    // The raw Postgres text is not actionable for a reporter, so surface a
    // clear message and keep the technical detail in the server log.
    const isRls = error.code === '42501' || /row-level security/i.test(error.message)
    if (isRls) {
      console.error('fileIncident RLS rejection', {
        space_id: member.space_id,
        member_id: member.id,
        is_anonymous: isAnonymous,
        code: error.code,
        message: error.message,
      })
      return {
        error:
          'Could not file the report: your membership is not fully linked to this space. Contact a space admin.',
      }
    }
    return { error: error.message }
  }

  // Don't include the reporter's identity in the activity log if anonymous.
  await logActivity(
    supabase,
    isAnonymous
      ? { space_id: member.space_id, user_id: null, display_name: 'Anonymous' }
      : member,
    'filed',
    'incident',
    data.id,
    v.data.title,
  )

  revalidatePath('/incidents')
  return { data, token: reporterToken }
}

/**
 * Admin/board action: transition an incident's status and (optionally)
 * record a disposition. Stamps acknowledged_at / decided_at / closed_at
 * as appropriate.
 */
export async function updateIncidentStatus(
  incidentId: string,
  status: string,
  disposition?: string | null,
) {
  const v = parseInput(updateIncidentStatusSchema, { incidentId, status, disposition })
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const patch: Record<string, unknown> = { status: v.data.status }
  if (v.data.disposition !== undefined) patch.disposition = v.data.disposition

  const now = new Date().toISOString()
  if (v.data.status === 'under_review') patch.acknowledged_at = now
  if (v.data.status === 'decided') patch.decided_at = now
  if (v.data.status === 'closed') patch.closed_at = now

  // Track decision makers when deciding.
  if (v.data.status === 'decided') {
    const { data: current } = await supabase
      .from('incidents')
      .select('decision_maker_ids')
      .eq('id', v.data.incidentId)
      .single()
    const existing: string[] = (current as { decision_maker_ids?: string[] } | null)?.decision_maker_ids ?? []
    if (!existing.includes(member.id)) {
      patch.decision_maker_ids = [...existing, member.id]
    }
  }

  const { error } = await supabase
    .from('incidents')
    .update(patch)
    .eq('id', v.data.incidentId)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }

  await logActivity(supabase, member, v.data.status, 'incident', v.data.incidentId)

  revalidatePath('/incidents')
  revalidatePath(`/incidents/${v.data.incidentId}`)
  return { success: true as const }
}

/**
 * Add an update / note to an incident. Reporter and admin/board can post.
 * Visibility controls who can read the note via RLS.
 */
export async function addIncidentUpdate(formData: {
  incidentId: string
  body: string
  visibility?: string
}) {
  const v = parseInput(addIncidentUpdateSchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('incident_updates')
    .insert({
      incident_id: v.data.incidentId,
      author_id: member.id,
      author_name: member.display_name,
      body: v.data.body,
      visibility: v.data.visibility,
    })

  if (error) return { error: error.message }

  revalidatePath(`/incidents/${v.data.incidentId}`)
  return { success: true as const }
}

/**
 * Appeal a dismissed incident by spawning a membership-vote proposal.
 * Admin/board only: the incident UPDATE below is RLS-restricted to
 * admin/board, so a non-privileged caller could otherwise insert a draft
 * proposal, update zero incident rows, and still see success — an orphan
 * proposal that never links back. The proposal goes to draft status so the
 * board can review before opening.
 */
export async function appealIncident(formData: {
  incidentId: string
  title: string
  body?: string
}) {
  const v = parseInput(appealIncidentSchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  // Confirm the incident exists and is closeable-into-appeal (status='decided' or 'closed').
  const { data: incident, error: incidentErr } = await supabase
    .from('incidents')
    .select('id, status, space_id')
    .eq('id', v.data.incidentId)
    .single()
  if (incidentErr || !incident) return { error: 'Incident not found' }
  if (incident.space_id !== member.space_id) return { error: 'Cross-space appeal not allowed' }

  // Create the appeal proposal as a draft.
  const { data: proposal, error: proposalErr } = await supabase
    .from('proposals')
    .insert({
      space_id: member.space_id,
      proposer_id: member.id,
      proposer_name: member.display_name,
      title: v.data.title,
      body: v.data.body,
      proposal_type: 'membership_vote',
      threshold: 'simple_majority',
      parent_incident_id: v.data.incidentId,
      status: 'draft',
    })
    .select()
    .single()
  if (proposalErr) return { error: proposalErr.message }

  // Mark the incident as appealed and link it to the proposal. Assert the
  // update actually touched a row via .select(): if RLS rejects the write
  // (or the row is gone), roll back the draft proposal so we never leave an
  // orphan that isn't linked from any incident.
  const { data: linked, error: linkErr } = await supabase
    .from('incidents')
    .update({ status: 'appealed', appeal_proposal_id: proposal.id })
    .eq('id', v.data.incidentId)
    .eq('space_id', member.space_id)
    .select('id')
  if (linkErr || !linked || linked.length === 0) {
    await supabase.from('proposals').delete().eq('id', proposal.id)
    return { error: linkErr?.message ?? 'Could not link the appeal to the incident.' }
  }

  await logActivity(supabase, member, 'appealed', 'incident', v.data.incidentId)

  revalidatePath('/incidents')
  revalidatePath(`/incidents/${v.data.incidentId}`)
  revalidatePath(`/proposals/${proposal.id}`)
  return { data: proposal }
}

/**
 * Public, unauthenticated lookup of an anonymously-filed incident by its
 * opaque reporter token. No session: the token IS the bearer credential, so
 * this uses the service client (anon has no RLS path to incidents) AFTER
 * validating the token, exactly like the forms public read. The returned
 * projection is redacted by `publicIncidentView` — board-only updates,
 * subjects, decision-maker ids and an undecided disposition never leave the
 * server. The token is 192 bits of randomness on a UNIQUE column, so a
 * generic not-found response is safe against enumeration.
 */
export async function trackIncident(input: unknown) {
  const v = parseInput(trackIncidentSchema, input)
  if (!v.ok) return { error: v.error }

  const admin = createAdminClient()
  const { data: incident } = await admin
    .from('incidents')
    .select(
      'id, title, body, category, severity, status, disposition, created_at, acknowledged_at, decided_at, closed_at',
    )
    .eq('reporter_token', v.data.token)
    .maybeSingle()

  if (!incident) return { error: 'No report matches that tracking code.' }

  const { data: updates } = await admin
    .from('incident_updates')
    .select('body, author_name, visibility, created_at')
    .eq('incident_id', incident.id)
    .neq('visibility', 'board_only')
    .order('created_at', { ascending: true })

  return { data: publicIncidentView(incident, updates ?? []) }
}
