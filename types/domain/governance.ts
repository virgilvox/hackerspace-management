/**
 * Hand-written governance-kernel domain types (proposals, votes, incidents,
 * policies, areas) and their enums.
 *
 * NOTE: the underlying tables and enums now ALSO exist in the generated
 * `types/database.ts` (proposals, proposal_votes, incidents, incident_updates,
 * policies, space_areas; proposal_type, incident_status, etc.). These shapes
 * were hand-authored before that regeneration and are kept verbatim here to
 * avoid a behavior change. Follow-up: after verifying field parity, replace the
 * row types with `Tables<'proposals'>` etc. and the enums with
 * `Enums<'proposal_type'>` etc., and delete the duplication.
 */

export type ProposalType =
  | 'bylaw_change'
  | 'board_action'
  | 'membership_vote'
  | 'advisory_poll'
  | 'recall'
  | 'budget'

export type ProposalStatus =
  | 'draft'
  | 'open'
  | 'decided'
  | 'withdrawn'
  | 'expired'

export type ThresholdRule =
  | 'simple_majority'
  | 'two_thirds'
  | 'three_fourths'
  | 'unanimous'

export type VotePosition = 'yes' | 'no' | 'abstain' | 'recused'

export type IncidentStatus =
  | 'received'
  | 'under_review'
  | 'decided'
  | 'appealed'
  | 'closed'

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'

export type IncidentUpdateVisibility =
  | 'reporter_only'
  | 'all_parties'
  | 'board_only'

export type PolicyStatus = 'draft' | 'active' | 'deprecated' | 'superseded'

export type SpaceArea = {
  id: string
  space_id: string
  code: string
  name: string
  icon: string | null
  sort_order: number
  is_archived: boolean
  created_at: string
  updated_at: string
}

export type FinancialVisibility = 'treasurer_only' | 'board_visible' | 'all_members_visible'

export type DirectoryVisibility =
  | 'board_only'
  | 'member_count_visible'
  | 'members_visible'
  | 'public_members_visible'

export type Proposal = {
  id: string
  space_id: string
  proposer_id: string | null
  proposer_name: string | null
  title: string
  body: string
  proposal_type: ProposalType
  status: ProposalStatus
  quorum_required: number
  quorum_percent: number
  quorum_floor: number
  threshold: ThresholdRule
  voting_opens_at: string | null
  voting_closes_at: string | null
  policy_ref_id: string | null
  parent_incident_id: string | null
  outcome_yes: number
  outcome_no: number
  outcome_abstain: number
  outcome_recused: number
  total_voters: number
  quorum_met: boolean | null
  passed: boolean | null
  created_at: string
  updated_at: string
  decided_at: string | null
}

export type ProposalVote = {
  id: string
  proposal_id: string
  member_id: string
  position: VotePosition
  recusal_reason: string | null
  comment: string | null
  voted_at: string
}

export type Incident = {
  id: string
  space_id: string
  reporter_id: string | null
  reporter_token: string | null
  is_anonymous: boolean
  subjects: string[]
  category: string
  severity: IncidentSeverity
  title: string
  body: string
  status: IncidentStatus
  disposition: string | null
  decision_maker_ids: string[]
  appeal_proposal_id: string | null
  sla_response_by: string | null
  created_at: string
  updated_at: string
  acknowledged_at: string | null
  decided_at: string | null
  closed_at: string | null
}

export type IncidentUpdateRow = {
  id: string
  incident_id: string
  author_id: string | null
  author_name: string | null
  body: string
  visibility: IncidentUpdateVisibility
  created_at: string
}

export type Policy = {
  id: string
  space_id: string
  slug: string
  section_ref: string | null
  parent_policy_id: string | null
  title: string
  body_formal: string
  body_plain: string | null
  version: number
  prior_version_id: string | null
  status: PolicyStatus
  effective_at: string | null
  adopted_by_proposal_id: string | null
  created_at: string
  updated_at: string
}
