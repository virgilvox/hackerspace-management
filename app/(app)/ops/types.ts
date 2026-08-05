// Shared shapes and constants for the Ops & Facilities hub. The row/modal
// components and tab panels share these prop contracts; the page passes the
// same rows through the orchestrator.

import type { Tables } from '@/types/database'

export type KbEntry = Tables<'knowledge_base'>
export type AreaLead = Tables<'area_leads'>
export type Secret = Tables<'secrets'>

export type Tab = 'kb' | 'processes' | 'secrets' | 'area-leads'

export interface AclRoleOption {
  value: string
  label: string
}

export interface OpsClientProps {
  member: Tables<'space_members'>
  spaceId: string
  kbEntries: KbEntry[]
  areaLeads: AreaLead[]
  secrets: Secret[]
  canSeeSecrets: boolean
  canManageAcl?: boolean
  aclRoleOptions?: AclRoleOption[]
  aclByEntity?: Record<string, string[]>
}

export const TABS: { id: Tab; label: string }[] = [
  { id: 'kb', label: 'Knowledge Base' },
  { id: 'processes', label: 'Processes' },
  { id: 'secrets', label: 'Secrets & Credentials' },
  { id: 'area-leads', label: 'Area Leads' },
]

export const VISIBILITY_LABELS: Record<string, string> = {
  all_members: 'All Members',
  board: 'Board',
  admin_only: 'Admin Only',
}

export const VISIBILITY_COLORS: Record<string, string> = {
  admin_only: 'text-red-600 bg-red-50 border-red-200',
  board: 'text-amber-600 bg-amber-50 border-amber-200',
  all_members: 'text-primary bg-primary/5 border-primary/20',
}
