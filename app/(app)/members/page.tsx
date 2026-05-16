import { createClient } from '@/lib/supabase/server'
import { MembersClient } from './members-client'

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
    .select('space_id, role')
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
      <div className="p-8 max-w-2xl">
        <h1 className="font-mono text-sm tracking-widest uppercase text-muted-foreground mb-3">Members</h1>
        <div className="bg-card border border-border rounded p-6">
          <p className="font-sans text-sm text-foreground mb-2">The member directory is restricted in this space.</p>
          <p className="font-sans text-sm text-muted-foreground">
            A space admin has set member directory visibility to <code className="font-mono text-xs px-1 py-0.5 bg-muted rounded">{visibility}</code>.
            Contact an admin if you need access.
          </p>
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

  return (
    <MembersClient
      members={members ?? []}
      currentRole={self.role}
      areaLeadRoles={(areaLeadRoles ?? []) as Array<{ id: string; area_name: string; lead_id: string | null }>}
    />
  )
}
