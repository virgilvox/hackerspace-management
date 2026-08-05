'use client'

import { useState } from 'react'
import { PageTitle } from '@/components/ui/page-title'
import { SpacePanel } from './panels/space-panel'
import { IntegrationsPanel } from './panels/integrations-panel'
import { DuesPanel } from './panels/dues-panel'
import { WebhooksPanel } from './panels/webhooks-panel'
import type { Integration, SaveMessage, Space } from './types'

// Roles, tiers, areas, invites, and onboarding moved to the dedicated
// /customize hub. This page now owns space identity, visibility,
// integrations, and webhooks only.
interface Props {
  space: Space
  isAdmin: boolean
  integrations: Integration[]
  currentRole: string
}

export default function SettingsClient({ space, isAdmin, integrations }: Props) {
  const [activeTab, setActiveTab] = useState<'space' | 'integrations' | 'dues' | 'webhooks'>('space')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<SaveMessage>(null)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center">
        <PageTitle>Settings & Admin</PageTitle>
      </div>

      <div className="flex">
        {/* Main content */}
        <div className="flex-1 p-4 md:p-6">
          {/* Tabs */}
          <div className="bg-card border-b border-border flex gap-4 md:gap-6 px-2 mb-6 rounded-t overflow-x-auto">
            {(['space', 'integrations', 'dues', 'webhooks'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`font-sans text-sm py-3 border-b-2 transition capitalize whitespace-nowrap ${
                  activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {message && (
            <div className={`mb-4 px-4 py-2 rounded text-sm font-sans ${
              message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          {activeTab === 'space' && (
            <SpacePanel space={space} isAdmin={isAdmin} saving={saving} setSaving={setSaving} setMessage={setMessage} />
          )}

          {activeTab === 'integrations' && (
            <IntegrationsPanel integrations={integrations} isAdmin={isAdmin} saving={saving} setSaving={setSaving} setMessage={setMessage} />
          )}

          {activeTab === 'dues' && (
            <DuesPanel spaceId={space.id} />
          )}

          {activeTab === 'webhooks' && (
            <WebhooksPanel space={space} isAdmin={isAdmin} saving={saving} setSaving={setSaving} setMessage={setMessage} />
          )}
        </div>

      </div>
    </div>
  )
}
