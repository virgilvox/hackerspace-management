/**
 * Hand-written domain types — the friendly, application-facing type surface.
 *
 * The generated Supabase types live in `types/database.ts` (a build artifact,
 * never hand-edited). This layer re-aliases those generated rows/enums to
 * friendlier names and adds composite / convenience types. Keeping the two on
 * opposite sides of this seam is deliberate: regenerating `types/database.ts`
 * never clobbers anything here.
 *
 * Import domain types from `@/types/domain`.
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

// ─── Governance kernel + auth re-exports ──────────────────────────────────────
export * from './governance'
export * from './reexports'
