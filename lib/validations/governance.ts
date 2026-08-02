import { z } from 'zod'
import { flexibleDateTime } from './primitives'

// ─── Governance: proposals ───────────────────────────────────────────────────

export const proposalTypes = ['bylaw_change','board_action','membership_vote','advisory_poll','recall','budget'] as const
export const proposalStatuses = ['draft','open','decided','withdrawn','expired'] as const
export const thresholdRules = ['simple_majority','two_thirds','three_fourths','unanimous'] as const
export const votePositions = ['yes','no','abstain','recused'] as const

export const createProposalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  body: z.string().max(20000).default(''),
  proposal_type: z.enum(proposalTypes).default('advisory_poll'),
  threshold: z.enum(thresholdRules).optional(),
  policy_ref_id: z.string().uuid().optional().nullable(),
  parent_incident_id: z.string().uuid().optional().nullable(),
  voting_opens_at: flexibleDateTime().optional(),
  voting_closes_at: flexibleDateTime().optional(),
  open_immediately: z.boolean().optional(),
})

export const openProposalSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
  voting_closes_at: flexibleDateTime().optional(),
})

export const castVoteSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
  position: z.enum(votePositions),
  recusal_reason: z.string().max(1000).optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
}).refine(
  v => v.position !== 'recused' || (v.recusal_reason && v.recusal_reason.trim().length > 0),
  { message: 'Recusal requires a reason', path: ['recusal_reason'] },
)

export const decideProposalSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
})

export const withdrawProposalSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
})

// ─── Governance: incidents ───────────────────────────────────────────────────

export const incidentSeverities = ['low','medium','high','critical'] as const
export const incidentStatuses = ['received','under_review','decided','appealed','closed'] as const
export const incidentUpdateVisibilities = ['reporter_only','all_parties','board_only'] as const

export const fileIncidentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().min(1, 'Description is required').max(20000),
  category: z.string().max(50).default('general'),
  severity: z.enum(incidentSeverities).default('medium'),
  subjects: z.array(z.string().uuid()).max(20).optional(),
  is_anonymous: z.boolean().optional(),
})

export const updateIncidentStatusSchema = z.object({
  incidentId: z.string().uuid('Invalid incident ID'),
  status: z.enum(incidentStatuses),
  disposition: z.string().max(20000).optional().nullable(),
})

export const addIncidentUpdateSchema = z.object({
  incidentId: z.string().uuid('Invalid incident ID'),
  body: z.string().min(1, 'Update body is required').max(20000),
  visibility: z.enum(incidentUpdateVisibilities).default('all_parties'),
})

export const appealIncidentSchema = z.object({
  incidentId: z.string().uuid('Invalid incident ID'),
  title: z.string().min(1).max(200),
  body: z.string().max(20000).default(''),
})

// Anonymous reporters look their case up with the opaque token they were
// given at filing time (48 hex chars today; bound loosely so the format can
// evolve without breaking old tokens).
export const trackIncidentSchema = z.object({
  token: z.string().trim().min(16).max(128),
})

// ─── Governance: policies ────────────────────────────────────────────────────

export const policyStatuses = ['draft','active','deprecated','superseded'] as const

export const createPolicySchema = z.object({
  slug: z.string().min(1, 'Slug is required').max(80).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  title: z.string().min(1, 'Title is required').max(200),
  section_ref: z.string().max(80).optional().nullable(),
  parent_policy_id: z.string().uuid().optional().nullable(),
  body_formal: z.string().max(100000).default(''),
  body_plain: z.string().max(100000).optional().nullable(),
  effective_at: flexibleDateTime().optional(),
})

export const supersedePolicySchema = z.object({
  policyId: z.string().uuid('Invalid policy ID'),
  body_formal: z.string().max(100000).default(''),
  body_plain: z.string().max(100000).optional().nullable(),
  section_ref: z.string().max(80).optional().nullable(),
  title: z.string().min(1).max(200).optional(),
  adopted_by_proposal_id: z.string().uuid().optional().nullable(),
  effective_at: flexibleDateTime().optional(),
})

export const updatePolicyStatusSchema = z.object({
  policyId: z.string().uuid('Invalid policy ID'),
  status: z.enum(policyStatuses),
})
