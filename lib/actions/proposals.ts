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
  createProposalSchema,
  openProposalSchema,
  castVoteSchema,
  decideProposalSchema,
  withdrawProposalSchema,
  uuidSchema,
} from '@/lib/validations'

/**
 * Create a proposal. Defaults to draft status. Pass `open_immediately: true`
 * to skip the draft step and go straight to voting (trigger computes quorum
 * and voting window from space defaults).
 */
export async function createProposal(formData: {
  title: string
  body?: string
  proposal_type?: string
  threshold?: string
  policy_ref_id?: string | null
  parent_incident_id?: string | null
  voting_opens_at?: string | null
  voting_closes_at?: string | null
  open_immediately?: boolean
}) {
  const v = parseInput(createProposalSchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const status = v.data.open_immediately ? 'open' : 'draft'

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      space_id: member.space_id,
      proposer_id: member.id,
      proposer_name: member.display_name,
      title: v.data.title,
      body: v.data.body,
      proposal_type: v.data.proposal_type,
      threshold: v.data.threshold ?? 'simple_majority',
      policy_ref_id: v.data.policy_ref_id ?? null,
      parent_incident_id: v.data.parent_incident_id ?? null,
      voting_opens_at: v.data.voting_opens_at ?? null,
      voting_closes_at: v.data.voting_closes_at ?? null,
      status,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await logActivity(supabase, member, 'created', 'proposal', data.id, v.data.title)

  revalidatePath('/proposals')
  return { data }
}

/**
 * Move a draft proposal to open. Trigger computes quorum_required and the
 * voting window from the space's defaults if voting_closes_at is null.
 */
export async function openProposal(proposalId: string, voting_closes_at?: string | null) {
  const v = parseInput(openProposalSchema, { proposalId, voting_closes_at })
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const updates: Record<string, unknown> = { status: 'open' }
  if (v.data.voting_closes_at) updates.voting_closes_at = v.data.voting_closes_at

  const { error } = await supabase
    .from('proposals')
    .update(updates)
    .eq('id', v.data.proposalId)
    .eq('space_id', member.space_id)
    .eq('status', 'draft')

  if (error) return { error: error.message }

  await logActivity(supabase, member, 'opened', 'proposal', v.data.proposalId)

  revalidatePath('/proposals')
  revalidatePath(`/proposals/${v.data.proposalId}`)
  return { success: true as const }
}

/**
 * Withdraw a proposal. Proposer can withdraw their own (any status pre-decided);
 * admin/board can withdraw any. Status becomes 'withdrawn'.
 */
export async function withdrawProposal(proposalId: string) {
  const v = parseInput(withdrawProposalSchema, { proposalId })
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('proposals')
    .update({ status: 'withdrawn' })
    .eq('id', v.data.proposalId)
    .eq('space_id', member.space_id)
    .in('status', ['draft', 'open'])

  if (error) return { error: error.message }

  await logActivity(supabase, member, 'withdrew', 'proposal', v.data.proposalId)

  revalidatePath('/proposals')
  revalidatePath(`/proposals/${v.data.proposalId}`)
  return { success: true as const }
}

/**
 * Cast or update a vote. Upserts on (proposal_id, member_id). The DB-level
 * trigger refreshes the proposal's tally on every change. Voting window is
 * enforced by RLS, not here.
 */
export async function castVote(formData: {
  proposalId: string
  position: string
  recusal_reason?: string | null
  comment?: string | null
}) {
  const v = parseInput(castVoteSchema, formData)
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMember(supabase)
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('proposal_votes')
    .upsert(
      {
        proposal_id: v.data.proposalId,
        member_id: member.id,
        position: v.data.position,
        recusal_reason: v.data.recusal_reason ?? null,
        comment: v.data.comment ?? null,
        voted_at: new Date().toISOString(),
      },
      { onConflict: 'proposal_id,member_id' },
    )

  if (error) return { error: error.message }

  await logActivity(supabase, member, 'voted', 'proposal', v.data.proposalId, v.data.position)

  revalidatePath('/proposals')
  revalidatePath(`/proposals/${v.data.proposalId}`)
  return { success: true as const }
}

/**
 * Decide a proposal: flip status to 'decided' and freeze the outcome. The
 * tally is already maintained live by the refresh_proposal_tally trigger;
 * this just commits the decision and stamps decided_at.
 */
export async function decideProposal(proposalId: string) {
  const v = parseInput(decideProposalSchema, { proposalId })
  if (!v.ok) return { error: v.error }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('proposals')
    .update({ status: 'decided', decided_at: new Date().toISOString() })
    .eq('id', v.data.proposalId)
    .eq('space_id', member.space_id)
    .eq('status', 'open')

  if (error) return { error: error.message }

  await logActivity(supabase, member, 'decided', 'proposal', v.data.proposalId)

  revalidatePath('/proposals')
  revalidatePath(`/proposals/${v.data.proposalId}`)
  return { success: true as const }
}

/**
 * Delete a proposal. Admin/board only. Use sparingly; prefer withdraw.
 */
export async function deleteProposal(proposalId: string) {
  const v = parseInput(uuidSchema, proposalId)
  if (!v.ok) return { error: 'Invalid proposal ID' }

  const supabase = await createClient()
  const auth = await requireMemberWithRole(supabase, ADMIN_ROLES, 'Admin or board access required')
  if (!auth.ok) return { error: auth.error }
  const { member } = auth

  const { error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', v.data)
    .eq('space_id', member.space_id)

  if (error) return { error: error.message }

  await logActivity(supabase, member, 'deleted', 'proposal', v.data)

  revalidatePath('/proposals')
  return { success: true as const }
}
