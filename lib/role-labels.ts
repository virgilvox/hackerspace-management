import type { SupabaseClient } from '@supabase/supabase-js'

// The five built-in roles. The member_role enum still drives all RLS; these
// labels are presentation only. A space can override the display name and
// color of any built-in role via space_role_labels.
export const BUILTIN_ROLES = ['admin', 'board', 'treasurer', 'member', 'associate'] as const
export type BuiltinRole = (typeof BUILTIN_ROLES)[number]

export const DEFAULT_ROLE_LABELS: Record<BuiltinRole, { name: string; color: string }> = {
  admin:     { name: 'Admin',     color: '#d4ff00' },
  board:     { name: 'Board',     color: '#7dd3fc' },
  treasurer: { name: 'Treasurer', color: '#86efac' },
  member:    { name: 'Member',    color: '#e5e7eb' },
  associate: { name: 'Associate', color: '#cbd5e1' },
}

export interface RoleLabel {
  role: string
  name: string
  description: string | null
  color: string
}

// Resolves the effective label set for a space: defaults merged with any
// space_role_labels overrides. Safe to call from server components.
export async function getRoleLabelMap(
  supabase: SupabaseClient,
  spaceId: string,
): Promise<Record<string, RoleLabel>> {
  const map: Record<string, RoleLabel> = {}
  for (const r of BUILTIN_ROLES) {
    map[r] = { role: r, name: DEFAULT_ROLE_LABELS[r].name, description: null, color: DEFAULT_ROLE_LABELS[r].color }
  }
  const { data } = await supabase
    .from('space_role_labels')
    .select('role, display_name, description, color')
    .eq('space_id', spaceId)
  for (const row of data ?? []) {
    const base = map[row.role] ?? { role: row.role, name: row.role, description: null, color: '#e5e7eb' }
    map[row.role] = {
      role: row.role,
      name: row.display_name?.trim() || base.name,
      description: row.description ?? null,
      color: row.color?.trim() || base.color,
    }
  }
  return map
}

export function roleDisplayName(map: Record<string, RoleLabel> | null | undefined, role: string): string {
  if (map && map[role]) return map[role].name
  const d = DEFAULT_ROLE_LABELS[role as BuiltinRole]
  return d ? d.name : role
}
