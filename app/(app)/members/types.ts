// Shared shapes for the Members page: the Props contract from the server page,
// plus the local types the toolbar/table/form-dialog pass between each other.

import type { ReactNode } from 'react'
import type { Tables } from '@/types/database'

export type Member = Tables<'space_members'>

export type SortKey = 'name' | 'tier' | 'joined' | 'last_payment' | 'status'

export type MemberTab = 'all' | 'payment_issues' | 'unverified' | 'inactive'

export type AreaLeadRole = { id: string; area_name: string; lead_id: string | null }

// The add/edit form shares one state shape; both dialogs write into it.
export interface MemberForm {
  display_name: string
  email: string
  phone: string
  handle: string
  tier: string
  role: string
  joined_at: string
  has_card_access: boolean
}

export interface MembersClientProps {
  members: Member[]
  currentRole: string
  areaLeadRoles?: AreaLeadRole[]
  // Composed by the server page for admin/board: the existing InvitesPanel,
  // so the members page is a real place to create and share a join link
  // (the first-run "Invite or add members" step lands here).
  inviteSlot?: ReactNode
  // True when the viewer holds certifications.grant (the Instructor
  // capability), independent of admin/board. Adds a per-member
  // certifications panel reachable by non-admin instructors.
  canGrantCerts?: boolean
  // True when the viewer holds door.manage. Adds a per-member access-cards
  // panel (card UID is a credential; managers only).
  canManageCards?: boolean
  // True when the viewer holds forms.manage. Adds a per-member panel
  // listing the forms that member has submitted.
  canViewForms?: boolean
}
