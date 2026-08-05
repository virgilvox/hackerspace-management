'use client'

import { useState } from 'react'
import { Check, Eye, EyeOff } from 'lucide-react'
import { saveIntegration, disconnectIntegration } from '@/lib/actions'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { IntegrationConfig, Integration, SaveStatus } from '../types'

const INTEGRATIONS_CONFIG: IntegrationConfig[] = [
  {
    platform: 'paypal',
    name: 'PayPal',
    description: 'Sync transactions for member dues',
    icon: (
      <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.5 2h9.3c2.7 0 4.5 1.9 4 4.5l-1.3 8.4c-.4 2.6-2.5 4.1-5.2 4.1H10l-.6 3H5.8L7.5 2zm2 2.2L7.6 17h3.8c1.6 0 2.8-.9 3-2.5l1.3-8.4c.2-1.2-.5-1.9-1.7-1.9H9.5z"/>
      </svg>
    ),
    fields: [
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'Sandbox or Live Client ID' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: 'Client Secret from PayPal Developer' },
      { key: 'mode', label: 'Mode', type: 'select', options: ['sandbox', 'live'] },
    ],
    docs: 'https://developer.paypal.com/api/rest/',
  },
  {
    platform: 'zeffy',
    name: 'Zeffy',
    description: 'Nonprofit payment and donation sync',
    icon: (
      <svg className="w-6 h-6 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.512M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477" />
      </svg>
    ),
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Zeffy API Key' },
      { key: 'organization_id', label: 'Organization ID', type: 'text', placeholder: 'Your Zeffy Org ID' },
    ],
    docs: 'https://docs.zeffy.com/',
  },
  {
    platform: 'venmo',
    name: 'Venmo',
    description: 'Pull Venmo business transactions',
    icon: (
      <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.5 3c.7 1.3 1 2.6 1 4.1 0 4.3-3.7 9.8-6.7 13.9H7.1L4.5 3h5.3l1.4 11.4C12.5 12 14.1 8.7 14.1 6.3c0-1.3-.2-2.2-.6-2.9L19.5 3z"/>
      </svg>
    ),
    fields: [
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'Venmo API Access Token' },
    ],
    docs: 'https://developer.venmo.com/',
  },
  // Stripe is intentionally NOT listed here. Stripe recurring dues is
  // configured in the dedicated Dues tab (saveStripeSettings: mode, tier->price
  // map, grace days, vaulted keys). The generic saveIntegration path OVERWRITES
  // integrations.config with a different shape, which would clobber the dues
  // config (drop prices/mode/grace_days). One Stripe config UI, in Dues.
]

interface Props extends SaveStatus {
  integrations: Integration[]
  isAdmin: boolean
}

export function IntegrationsPanel({ integrations, isAdmin, saving, setSaving, setMessage }: Props) {
  const [editingIntegration, setEditingIntegration] = useState<IntegrationConfig | null>(null)
  const [integrationForm, setIntegrationForm] = useState<Record<string, string>>({})
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  async function handleSaveIntegration(e: React.FormEvent) {
    e.preventDefault()
    if (!editingIntegration || !isAdmin) return
    setSaving(true)
    setMessage(null)
    const result = await saveIntegration(editingIntegration.platform, integrationForm)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: `${editingIntegration.name} connected!` })
      setEditingIntegration(null)
    }
    setSaving(false)
  }

  async function handleDisconnect(platform: string) {
    if (!isAdmin) return
    setSaving(true)
    await disconnectIntegration(platform)
    setSaving(false)
  }

  function openIntegrationModal(config: IntegrationConfig) {
    const existing = integrations.find(i => i.platform === config.platform)
    const initialForm: Record<string, string> = {}
    config.fields.forEach(f => {
      initialForm[f.key] = (existing?.config as Record<string, string> | undefined)?.[f.key] || ''
    })
    setIntegrationForm(initialForm)
    setEditingIntegration(config)
  }

  const getIntegrationStatus = (platform: string) => integrations.find(i => i.platform === platform)?.is_connected ?? false

  return (
    <>
      <div className="bg-card rounded border border-border p-6">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-6">Integrations</p>

        <div className="space-y-3">
          {INTEGRATIONS_CONFIG.map(config => {
            const connected = getIntegrationStatus(config.platform)
            return (
              <div key={config.platform} className="flex items-center gap-4 p-4 border border-border rounded hover:border-primary/30 transition">
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">{config.icon}</div>
                <div className="flex-1">
                  <p className="font-sans text-sm font-medium text-foreground">{config.name}</p>
                  <p className="font-sans text-xs text-muted-foreground">{config.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {connected ? (
                    <>
                      <span className="flex items-center gap-1 font-mono text-[10px] text-primary">
                        <Check className="w-3 h-3" /> Connected
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => openIntegrationModal(config)}
                          className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-primary hover:text-primary transition"
                        >
                          Manage
                        </button>
                      )}
                    </>
                  ) : isAdmin ? (
                    <button
                      onClick={() => openIntegrationModal(config)}
                      className="font-mono text-[10px] bg-primary text-white px-3 py-1 rounded hover:bg-primary/90 transition"
                    >
                      Connect
                    </button>
                  ) : (
                    <span className="font-mono text-[10px] text-muted-foreground">Not connected</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Integration Config Modal */}
      <Dialog open={!!editingIntegration} onOpenChange={(o) => { if (!o) setEditingIntegration(null) }}>
        <DialogContent className="sm:max-w-md">
          {editingIntegration && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center">{editingIntegration.icon}</div>
                  {editingIntegration.name}
                </DialogTitle>
              </DialogHeader>

            <form onSubmit={handleSaveIntegration} className="space-y-4">
              {editingIntegration.fields.map(field => (
                <div key={field.key}>
                  <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      value={integrationForm[field.key] || ''}
                      onChange={e => setIntegrationForm(f => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="">Select...</option>
                      {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type={field.type === 'password' && !showSecrets[field.key] ? 'password' : 'text'}
                        value={integrationForm[field.key] || ''}
                        onChange={e => setIntegrationForm(f => ({ ...f, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full bg-background border border-border rounded px-3 py-2 pr-10 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                      />
                      {field.type === 'password' && (
                        <button
                          type="button"
                          onClick={() => setShowSecrets(s => ({ ...s, [field.key]: !s[field.key] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showSecrets[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div className="flex items-center justify-between pt-2">
                <a
                  href={editingIntegration.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-primary hover:underline"
                >
                  View API Docs →
                </a>
              </div>

              <div className="flex gap-3 pt-2">
                {getIntegrationStatus(editingIntegration.platform) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleDisconnect(editingIntegration.platform)
                      setEditingIntegration(null)
                    }}
                    className="flex-1 border border-red-200 text-red-600 font-sans text-sm py-2 rounded hover:bg-red-50 transition"
                  >
                    Disconnect
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditingIntegration(null)}
                  className="flex-1 border border-border text-foreground font-sans text-sm py-2 rounded hover:border-primary/50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary text-white font-sans text-sm py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
