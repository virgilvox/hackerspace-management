'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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
} from '@/lib/validations'

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

  if (error) return { error: error.message }

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
 * The reporter or admin/board can trigger the appeal; the proposal goes
 * to draft status so the petitioner (or board) can review before opening.
 */
export async function appealIncident(formData: {
  incidentId: string
  title: string
  body?: string
}) {
  const v = parseInput(appealIncidentSchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
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

  // Mark the incident as appealed and link it to the proposal.
  const { error: linkErr } = await supabase
    .from('incidents')
    .update({ status: 'appealed', appeal_proposal_id: proposal.id })
    .eq('id', v.data.incidentId)
  if (linkErr) return { error: linkErr.message }

  await logActivity(supabase, member, 'appealed', 'incident', v.data.incidentId)

  revalidatePath('/incidents')
  revalidatePath(`/incidents/${v.data.incidentId}`)
  revalidatePath(`/proposals/${proposal.id}`)
  return { data: proposal }
}
