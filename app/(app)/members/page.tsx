import { createClient } from '@/lib/supabase/server'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { MembersClient } from './members-client'
import { InvitesPanel } from '../customize/panels/invites-panel'

// member_directory_visibility values come from space settings:
//   admin_only       — only admins see the directory
//   board_visible    — admins + board + treasurer see the directory
//   members_visible  — every member of the space sees the directory (default)
const ELEVATED_ROLES = new Set(['admin', 'board', 'treasurer'])

export default async function MembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: self } = await supabase
    .from('space_members')
    .select('space_id, role, spaces(slug)')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .single()

  if (!self) return null

  const { data: space } = await supabase
    .from('spaces')
    .select('member_directory_visibility')
    .eq('id', self.space_id)
    .single()

  const visibility = space?.member_directory_visibility ?? 'members_visible'
  const isAdmin = self.role === 'admin'
  const isElevated = ELEVATED_ROLES.has(self.role)

  const allowed =
    visibility === 'members_visible' ||
    (visibility === 'board_visible' && isElevated) ||
    (visibility === 'admin_only' && isAdmin)

  if (!allowed) {
    return (
      <div>
        <PageHeader>
          <PageTitle>Members</PageTitle>
        </PageHeader>
        <div className="p-8 max-w-2xl">
          <div className="bg-card border border-border rounded p-6">
            <p className="font-sans text-sm text-foreground mb-2">The member directory is restricted in this space.</p>
            <p className="font-sans text-sm text-muted-foreground">
              A space admin has set member directory visibility to <code className="font-mono text-xs px-1 py-0.5 bg-muted rounded">{visibility}</code>.
              Contact an admin if you need access.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const { data: members } = await supabase
    .from('space_members')
    .select('*')
    .eq('space_id', self.space_id)
    .order('joined_at')

  // Area-lead roles, so admin/board can assign a lead straight from a member
  // row (the same capability also lives in Customize -> Area leads).
  const canManageLeads = self.role === 'admin' || self.role === 'board'
  const { data: areaLeadRoles } = canManageLeads
    ? await supabase
        .from('area_leads')
        .select('id, area_name, lead_id')
        .eq('space_id', self.space_id)
        .order('area_name')
    : { data: [] }

  // Admin/board can create and share join links straight from this page (the
  // same InvitesPanel used in Customize). This is where the first-run
  // "Invite or add members" step sends people, so the UI has to be here.
  const canInvite = self.role === 'admin' || self.role === 'board'
  const spaceSlug = (self.spaces as { slug?: string } | null)?.slug ?? ''
  const { data: invites } = canInvite
    ? await supabase
        .from('space_invites')
        .select('id, code, label, expires_at, max_uses, uses_count, is_enabled, role, created_at')
        .eq('space_id', self.space_id)
        .order('created_at', { ascending: false })
    : { data: [] }

  // certifications.grant (the Instructor capability) is independent of
  // admin/board, so check it explicitly to decide whether to show the
  // per-member certifications panel.
  const { data: canGrantCerts } = await supabase.rpc('user_has_permission', {
    uid: user.id,
    sid: self.space_id,
    perm: 'certifications.grant',
  })

  return (
    <MembersClient
      members={members ?? []}
      currentRole={self.role}
      canGrantCerts={!!canGrantCerts}
      areaLeadRoles={(areaLeadRoles ?? []) as Array<{ id: string; area_name: string; lead_id: string | null }>}
      inviteSlot={
        canInvite ? (
          <InvitesPanel
            isAdmin={isAdmin}
            creatorRole={self.role}
            spaceSlug={spaceSlug}
            invites={(invites ?? []) as Array<{ id: string; code: string; label: string | null; expires_at: string | null; max_uses: number | null; uses_count: number; is_enabled: boolean; role: string; created_at: string }>}
          />
        ) : undefined
      }
    />
  )
}
