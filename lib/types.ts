/**
 * Re-export types from the generated database types.
 * These types are auto-generated from the Supabase schema.
 * 
 * To regenerate: Use the supabase_generate_typescript_types tool
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
