import { createClient } from '@/lib/supabase/server'
import { OpsClient } from './ops-client'
import type { Tables } from '@/types/database'

export default async function OpsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('space_members').select('space_id, role, display_name, user_id').eq('user_id', user.id).in('status', ['current', 'unverified', 'late']).single()
  if (!member) return null

  const canSeeSecrets = member.role === 'admin' || member.role === 'board'
  const canManageAcl = member.role === 'admin' || member.role === 'board'

  const [{ data: kbEntries }, { data: areaLeads }, secretsResult, { data: customRoles }, { data: acl }] = await Promise.all([
    supabase.from('knowledge_base').select('*').eq('space_id', member.space_id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('area_leads').select('*').eq('space_id', member.space_id).order('area_name'),
    canSeeSecrets
      // CRITICAL: never select `value` or `encrypted_value` here. The list
      // endpoint only returns metadata; the plaintext is fetched on demand
      // through the revealSecret() server action.
      ? supabase.from('secrets').select('id, title, area, created_at, label, description, icon, space_id, created_by, updated_at, category, notes, encryption_version').eq('space_id', member.space_id)
      : Promise.resolve({ data: [] as Tables<'secrets'>[] }),
    supabase.from('space_custom_roles').select('slug, name').eq('space_id', member.space_id),
    supabase.from('ops_acl').select('entity_type, entity_id, role').eq('space_id', member.space_id),
  ])

  // Selectable ACL roles: built-in roles, custom-role slugs, and area-lead
  // sentinels labelled by area name.
  const aclRoleOptions = [
    { value: 'treasurer', label: 'treasurer' },
    { value: 'member', label: 'member' },
    { value: 'associate', label: 'associate' },
    ...((customRoles ?? []).map(c => ({ value: c.slug, label: c.name }))),
    ...((areaLeads ?? []).map(al => ({ value: `area_lead:${al.id}`, label: `${al.area_name} lead` }))),
  ]

  const aclByEntity: Record<string, string[]> = {}
  for (const row of acl ?? []) {
    const k = `${row.entity_type}:${row.entity_id}`
    ;(aclByEntity[k] ??= []).push(row.role)
  }

  return (
    <OpsClient
      member={member as Tables<'space_members'>}
      spaceId={member.space_id}
      kbEntries={kbEntries ?? []}
      areaLeads={areaLeads ?? []}
      secrets={secretsResult.data ?? []}
      canSeeSecrets={canSeeSecrets}
      canManageAcl={canManageAcl}
      aclRoleOptions={aclRoleOptions}
      aclByEntity={aclByEntity}
    />
  )
}
