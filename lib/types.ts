// Enum values match live DB exactly
export type MemberTier = 'plus' | 'basic' | 'associate'
export type MemberRole = 'admin' | 'board' | 'treasurer' | 'member' | 'associate'
export type MemberStatus = 'current' | 'late' | 'inactive' | 'unverified'
export type TaskType = 'chore' | 'task'
export type TaskStatus = 'open' | 'claimed' | 'in_progress' | 'overdue' | 'due_today' | 'completed' | 'done' | 'blocked'
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly'
export type ProjectStatus = 'backlog' | 'in_progress' | 'review' | 'done' | 'blocked'
export type KBVisibility = 'all_members' | 'board' | 'admin_only'
export type ContactType = 'vendor' | 'supplier' | 'partner' | 'landlord' | 'city'
export type PaymentPlatform = 'paypal' | 'zeffy' | 'venmo' | 'cash'
export type PaymentLinkStatus = 'linked' | 'unlinked'
export type ChannelType = 'general' | 'area' | 'ops' | 'project'
export type AreaLeadStatus = 'active' | 'vacant' | 'handoff'

export interface Space {
  id: string
  name: string
  slug: string
  city?: string
  invite_code: string
  require_approval: boolean
  public_member_directory: boolean
  webhook_secret?: string
  created_at: string
  updated_at: string
}

export interface SpaceMember {
  id: string
  space_id: string
  user_id: string
  display_name: string
  handle?: string
  email?: string
  phone?: string
  tier: MemberTier
  role: MemberRole
  status: MemberStatus
  joined_at: string
  approved: boolean
  has_card_access: boolean
  last_payment_at?: string
  last_paid_at?: string
  payment_status?: string
  payment_note?: string
}

export interface Task {
  id: string
  space_id: string
  type: TaskType
  title: string
  description?: string
  status: TaskStatus
  area?: string
  assigned_to?: string
  assigned_to_name?: string
  claimed_by?: string
  claimed_by_name?: string
  requested_by?: string
  requested_by_name?: string
  due_date?: string
  recurrence: TaskRecurrence
  last_done_at?: string
  subtask_completed?: number
  subtask_total?: number
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  space_id: string
  title: string
  description?: string
  status: ProjectStatus
  area?: string
  tags?: string[]
  assignee_names?: string[]
  task_count?: number
  tasks_completed?: number
  due_date?: string
  created_at: string
  updated_at: string
}

export interface KnowledgeBase {
  id: string
  space_id: string
  title: string
  content?: string
  description?: string
  area?: string
  tags?: string[]
  visibility: KBVisibility
  access_level?: string
  is_pinned: boolean
  pinned?: boolean
  icon?: string
  updated_by_id?: string
  updated_by_name?: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface Secret {
  id: string
  space_id: string
  title: string
  description?: string
  value: string
  area?: string
  icon?: string
  created_at: string
  updated_at: string
}

export interface AreaLead {
  id: string
  space_id: string
  area_code: string
  area_name: string
  lead_id?: string
  lead_handle?: string
  status: AreaLeadStatus
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  space_id: string
  contact_type: ContactType
  code: string
  name: string
  email?: string
  phone?: string
  details?: string
  tags?: string[]
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  space_id: string
  platform: PaymentPlatform
  amount: number
  from_identifier: string
  from_note?: string
  member_id?: string
  member_name?: string
  link_status: PaymentLinkStatus
  transaction_date: string
  created_at: string
}

export interface CommsChannel {
  id: string
  space_id: string
  name: string
  channel_type: ChannelType
  icon?: string
  area_reference?: string
  project_id?: string
  member_count?: number
  created_at: string
}

export interface CommsMessage {
  id: string
  space_id: string
  channel_id: string
  user_id: string
  display_name: string
  handle?: string
  content: string
  created_at: string
}

export interface Integration {
  id: string
  space_id: string
  platform: string
  name: string
  description?: string
  is_connected: boolean
  config?: any
  created_at: string
  updated_at: string
}

export interface ActivityLog {
  id: string
  space_id: string
  user_id: string
  display_name: string
  action: string
  entity_type: string
  entity_id: string
  details?: string
  created_at: string
}
