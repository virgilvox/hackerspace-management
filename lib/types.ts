/**
 * Project-wide TypeScript types.
 *
 * Source of truth for row and enum shapes is `types/database.ts`, which is
 * generated from the live Supabase schema. This file re-exports those types
 * with friendlier names and adds composite / convenience types that the
 * application layer uses.
 *
 * To regenerate the underlying types after a schema change:
 *   supabase gen types typescript --project-id <ref> > types/database.ts
 */

import type { Tables, Enums } from '@/types/database'

// ─── Table Row Types ───────────────────────────────────────────────────────────
export type Space = Tables<'spaces'>
export type SpaceMember = Tables<'space_members'>
export type Task = Tables<'tasks'>
export type Project = Tables<'projects'>
export type KnowledgeBase = Tables<'knowledge_base'>
export type Secret = Tables<'secrets'>
export type AreaLead = Tables<'area_leads'>
export type Contact = Tables<'contacts'>
export type Payment = Tables<'payments'>
export type CommsChannel = Tables<'comms_channels'>
export type CommsMessage = Tables<'comms_messages'>
export type Integration = Tables<'integrations'>
export type ActivityLog = Tables<'activity_log'>

// ─── Enum Types ────────────────────────────────────────────────────────────────
export type MemberTier = Enums<'member_tier'>
export type MemberRole = Enums<'member_role'>
export type MemberStatus = Enums<'member_status'>
export type TaskType = Enums<'task_type'>
export type TaskStatus = Enums<'task_status'>
export type TaskRecurrence = Enums<'recurrence_type'>
export type ProjectStatus = Enums<'project_status'>
export type KBVisibility = Enums<'kb_visibility'>
export type ContactType = Enums<'contact_type'>
export type PaymentPlatform = Enums<'payment_platform'>
export type PaymentLinkStatus = Enums<'payment_link_status'>
export type ChannelType = Enums<'channel_type'>
export type AreaLeadStatus = Enums<'area_lead_status'>

// ─── Convenience aliases ─────────────────────────────────────────────────────
/** Common projection of `space_members` used by sidebars / props. */
export type MemberSummary = Pick<
  SpaceMember,
  'id' | 'space_id' | 'user_id' | 'role' | 'display_name' | 'handle'
>

/** Standard return shape for server actions. */
export type ActionResult<T = void> =
  | { error: string; data?: undefined; success?: undefined }
  | { error?: undefined; data: T; success?: undefined }
  | { error?: undefined; data?: undefined; success: true }

// ─── Governance kernel (Tier 1 — migration 016) ──────────────────────────────
// These tables are not yet in types/database.ts (regenerate via supabase CLI
// to surface them in the generated types). Until then, hand-typed here.

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

// ─── Re-exports from permissions/auth-helpers for one-stop imports ───────────
export type { Role } from '@/lib/permissions'
export {
  ROLES,
  ADMIN_ROLES,
  TREASURER_ROLES,
  ALL_ROLES,
  ACTIVE_STATUSES,
  hasRole,
} from '@/lib/permissions'
export type {
  Member,
  Result,
  MemberResult,
  ServerSupabase,
} from '@/lib/auth-helpers'
