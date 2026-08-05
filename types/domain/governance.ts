/**
 * Governance-kernel domain types (proposals, votes, incidents, policies,
 * areas) and their enums.
 *
 * These are thin aliases over the generated database types (`types/database.ts`,
 * regenerated from the canonical schema). Keep them as `Tables<>` / `Enums<>`
 * aliases — do NOT hand-maintain the row shapes here; regenerate the database
 * types instead.
 */
import type { Tables, Enums } from '@/types/database'

// Enums
export type ProposalType = Enums<'proposal_type'>
export type ProposalStatus = Enums<'proposal_status'>
export type ThresholdRule = Enums<'threshold_rule'>
export type VotePosition = Enums<'vote_position'>
export type IncidentStatus = Enums<'incident_status'>
export type IncidentSeverity = Enums<'incident_severity'>
export type IncidentUpdateVisibility = Enums<'incident_update_visibility'>
export type PolicyStatus = Enums<'policy_status'>
export type FinancialVisibility = Enums<'financial_visibility'>
export type DirectoryVisibility = Enums<'directory_visibility'>

// Rows
export type SpaceArea = Tables<'space_areas'>
export type Proposal = Tables<'proposals'>
export type ProposalVote = Tables<'proposal_votes'>
export type Incident = Tables<'incidents'>
export type IncidentUpdateRow = Tables<'incident_updates'>
export type Policy = Tables<'policies'>
