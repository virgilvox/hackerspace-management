'use client'

import { useState } from 'react'
import { RolesPanel } from './panels/roles-panel'
import { PermissionsPanel } from './panels/permissions-panel'
import { TiersPanel } from './panels/tiers-panel'
import { AreasPanel } from './panels/areas-panel'
import { AreaLeadsPanel } from './panels/area-leads-panel'
import { InvitesPanel } from './panels/invites-panel'
import { OnboardingPanel } from './panels/onboarding-panel'
import type { RoleLabelRow, CustomRole, Tier, Invite, Step, Area, FormOption } from './panels/types'

type Section = 'roles' | 'permissions' | 'tiers' | 'areas' | 'area-leads' | 'invites' | 'onboarding'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'roles', label: 'Roles' },
  { key: 'permissions', label: 'Permissions' },
  { key: 'tiers', label: 'Membership tiers' },
  { key: 'areas', label: 'Areas' },
  { key: 'area-leads', label: 'Area leads' },
  { key: 'invites', label: 'Invite codes' },
  { key: 'onboarding', label: 'Onboarding' },
]

interface AreaLead {
  id: string
  area_code: string | null
  area_name: string
  lead_id: string | null
  lead_handle: string | null
  status: string
}

interface Props {
  isAdmin: boolean
  roleLabels: RoleLabelRow[]
  customRoles: CustomRole[]
  tiers: Tier[]
  invites: Invite[]
  onboardingSteps: Step[]
  forms: FormOption[]
  areas: Area[]
  rolePerms: Array<{ subject: string; permission: string }>
  areaLeads: AreaLead[]
  members: Array<{ id: string; display_name: string | null; handle: string | null }>
}

export function CustomizeClient(props: Props) {
  const [section, setSection] = useState<Section>('roles')

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-mono text-sm tracking-widest uppercase text-muted-foreground mb-1">Customize</h1>
        <p className="font-sans text-sm text-muted-foreground">
          Make the space yours. Operational settings (identity, integrations, webhooks) live under Settings.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <nav className="md:w-56 shrink-0 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`text-left px-3 py-2 rounded text-sm font-sans transition whitespace-nowrap ${
                section === s.key ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-muted hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0">
          {section === 'roles' && <RolesPanel isAdmin={props.isAdmin} roleLabels={props.roleLabels} customRoles={props.customRoles} />}
          {section === 'permissions' && <PermissionsPanel isAdmin={props.isAdmin} customRoles={props.customRoles} rolePerms={props.rolePerms} />}
          {section === 'tiers' && <TiersPanel isAdmin={props.isAdmin} tiers={props.tiers} />}
          {section === 'areas' && <AreasPanel isAdmin={props.isAdmin} areas={props.areas} />}
          {section === 'area-leads' && <AreaLeadsPanel isAdmin={props.isAdmin} areaLeads={props.areaLeads} members={props.members} />}
          {section === 'invites' && <InvitesPanel isAdmin={props.isAdmin} invites={props.invites} />}
          {section === 'onboarding' && <OnboardingPanel isAdmin={props.isAdmin} steps={props.onboardingSteps} forms={props.forms} />}
        </div>
      </div>
    </div>
  )
}
