'use client'

import { useState } from 'react'
import { RolesPanel } from './panels/roles-panel'
import { TiersPanel } from './panels/tiers-panel'
import { AreasPanel } from './panels/areas-panel'
import { InvitesPanel } from './panels/invites-panel'
import { OnboardingPanel } from './panels/onboarding-panel'
import type { RoleLabelRow, CustomRole, Tier, Invite, Step, Area } from './panels/types'

type Section = 'roles' | 'tiers' | 'areas' | 'invites' | 'onboarding'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'roles', label: 'Roles' },
  { key: 'tiers', label: 'Membership tiers' },
  { key: 'areas', label: 'Areas' },
  { key: 'invites', label: 'Invite codes' },
  { key: 'onboarding', label: 'Onboarding' },
]

interface Props {
  isAdmin: boolean
  roleLabels: RoleLabelRow[]
  customRoles: CustomRole[]
  tiers: Tier[]
  invites: Invite[]
  onboardingSteps: Step[]
  areas: Area[]
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
          {section === 'tiers' && <TiersPanel isAdmin={props.isAdmin} tiers={props.tiers} />}
          {section === 'areas' && <AreasPanel isAdmin={props.isAdmin} areas={props.areas} />}
          {section === 'invites' && <InvitesPanel isAdmin={props.isAdmin} invites={props.invites} />}
          {section === 'onboarding' && <OnboardingPanel isAdmin={props.isAdmin} steps={props.onboardingSteps} />}
        </div>
      </div>
    </div>
  )
}
