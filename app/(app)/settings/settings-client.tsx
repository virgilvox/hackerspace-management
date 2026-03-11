'use client'

import { useState } from 'react'
import { X, Check, Copy, Eye, EyeOff, RotateCcw } from 'lucide-react'
import { updateSpaceSettings, saveIntegration, disconnectIntegration, rotateWebhookSecret } from '@/lib/actions'
import type { Tables } from '@/types/database'

type Space = Tables<'spaces'>
type Integration = Tables<'integrations'>

interface Props {
  space: Space
  isAdmin: boolean
  integrations: Integration[]
  currentRole: string
}

const ROLES_INFO = [
  { name: 'Admin', color: 'text-primary', description: 'Full access. Secrets, roles, integrations, all data.', permissions: ['ALL ACCESS'] },
  { name: 'Board', color: 'text-primary', description: 'Members, payments, projects, board secrets.', permissions: ['MEMBERS', 'PAYMENTS', 'PROJECTS'] },
  { name: 'Treasurer', color: 'text-primary', description: 'Payments, financial secrets, member payment status.', permissions: [] },
  { name: 'Member', color: 'text-foreground', description: 'Tasks, chores, projects, public KB, comms.', permissions: [] },
  { name: 'Associate', color: 'text-foreground', description: 'Read-only most areas. Can claim chores.', permissions: [] },
]

const INTEGRATIONS_CONFIG = [
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
  {
    platform: 'stripe',
    name: 'Stripe',
    description: 'Accept card payments and subscriptions',
    icon: (
      <svg className="w-6 h-6 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
      </svg>
    ),
    fields: [
      { key: 'publishable_key', label: 'Publishable Key', type: 'text', placeholder: 'pk_test_...' },
      { key: 'secret_key', label: 'Secret Key', type: 'password', placeholder: 'sk_test_...' },
      { key: 'webhook_secret', label: 'Webhook Secret', type: 'password', placeholder: 'whsec_...' },
    ],
    docs: 'https://stripe.com/docs/api',
  },
]

export default function SettingsClient({ space, isAdmin, integrations, currentRole }: Props) {
  const [activeTab, setActiveTab] = useState<'space' | 'roles' | 'integrations' | 'webhooks'>('space')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Space form
  const [spaceForm, setSpaceForm] = useState({
    name: space.name || '',
    slug: space.slug || '',
    city: space.city || '',
    require_approval: space.require_approval ?? true,
    public_member_directory: space.public_member_directory ?? false,
  })

  // Integration config modal
  const [editingIntegration, setEditingIntegration] = useState<typeof INTEGRATIONS_CONFIG[0] | null>(null)
  const [integrationForm, setIntegrationForm] = useState<Record<string, string>>({})
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  // Webhook
  const [webhookSecret, setWebhookSecret] = useState(space.webhook_secret || '')
  const [copiedWebhook, setCopiedWebhook] = useState(false)

  async function handleSaveSpace(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdmin) return
    setSaving(true)
    setMessage(null)
    const result = await updateSpaceSettings(spaceForm)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Settings saved!' })
    }
    setSaving(false)
  }

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

  async function handleRotateWebhook() {
    if (!isAdmin) return
    setSaving(true)
    const result = await rotateWebhookSecret()
    if (result.secret) {
      setWebhookSecret(result.secret)
      setMessage({ type: 'success', text: 'Webhook secret rotated!' })
    }
    setSaving(false)
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopiedWebhook(true)
    setTimeout(() => setCopiedWebhook(false), 2000)
  }

  function openIntegrationModal(config: typeof INTEGRATIONS_CONFIG[0]) {
    const existing = integrations.find(i => i.platform === config.platform)
    const initialForm: Record<string, string> = {}
    config.fields.forEach(f => {
      initialForm[f.key] = existing?.config?.[f.key] || ''
    })
    setIntegrationForm(initialForm)
    setEditingIntegration(config)
  }

  const getIntegrationStatus = (platform: string) => integrations.find(i => i.platform === platform)?.is_connected ?? false

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center">
        <h1 className="text-white font-sans text-lg font-semibold">Settings & Admin</h1>
      </div>

      <div className="flex">
        {/* Main content */}
        <div className="flex-1 p-4 md:p-6">
          {/* Tabs */}
          <div className="bg-card border-b border-border flex gap-4 md:gap-6 px-2 mb-6 rounded-t overflow-x-auto">
            {(['space', 'roles', 'integrations', 'webhooks'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`font-sans text-sm py-3 border-b-2 transition capitalize ${
                  activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'roles' ? 'Users & Roles' : tab.charAt(0).toUpperCase() + tab.slice(1)}
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

          {/* Space Settings Tab */}
          {activeTab === 'space' && (
            <div className="bg-card rounded border border-border p-6">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-6">Space Settings</p>

              <form onSubmit={handleSaveSpace} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="font-sans text-sm text-foreground block mb-1.5">Space Name</label>
                    <input
                      type="text"
                      value={spaceForm.name}
                      onChange={e => setSpaceForm(f => ({ ...f, name: e.target.value }))}
                      disabled={!isAdmin}
                      className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground disabled:opacity-50 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="font-sans text-sm text-foreground block mb-1.5">URL Slug</label>
                    <div className="flex items-center">
                      <span className="font-mono text-xs text-muted-foreground mr-2">hackerspace.sh/</span>
                      <input
                        type="text"
                        value={spaceForm.slug}
                        onChange={e => setSpaceForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                        disabled={!isAdmin}
                        className="flex-1 bg-background border border-border rounded px-3 py-2 font-mono text-sm text-foreground disabled:opacity-50 focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-sans text-sm text-foreground block mb-1.5">City / Location (optional)</label>
                  <input
                    type="text"
                    value={spaceForm.city}
                    onChange={e => setSpaceForm(f => ({ ...f, city: e.target.value }))}
                    placeholder="Mesa, AZ"
                    disabled={!isAdmin}
                    className="w-full max-w-md bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50 focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between py-3 border-b border-border">
                    <div>
                      <p className="font-sans text-sm text-foreground">Require approval to join</p>
                      <p className="font-sans text-xs text-muted-foreground">New members must be approved by an admin</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => isAdmin && setSpaceForm(f => ({ ...f, require_approval: !f.require_approval }))}
                      disabled={!isAdmin}
                      className={`w-11 h-6 rounded-full transition relative ${spaceForm.require_approval ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${spaceForm.require_approval ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-sans text-sm text-foreground">Public member directory</p>
                      <p className="font-sans text-xs text-muted-foreground">Anyone can see member list (names only)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => isAdmin && setSpaceForm(f => ({ ...f, public_member_directory: !f.public_member_directory }))}
                      disabled={!isAdmin}
                      className={`w-11 h-6 rounded-full transition relative ${spaceForm.public_member_directory ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${spaceForm.public_member_directory ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <p className="font-sans text-sm text-foreground mb-1.5">Invite code</p>
                  <div className="flex items-center gap-2">
                    <code className="bg-primary/5 border border-primary/20 text-primary font-mono text-sm px-3 py-2 rounded">
                      {space.invite_code || 'No code set'}
                    </code>
                    {space.invite_code && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(space.invite_code!)}
                        className="text-muted-foreground hover:text-primary transition p-2"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-primary text-white font-sans text-sm px-6 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Users & Roles Tab */}
          {activeTab === 'roles' && (
            <div className="bg-card rounded border border-border p-6">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-6">Roles & Permissions</p>

              <div className="space-y-4">
                {ROLES_INFO.map(role => (
                  <div key={role.name} className="flex items-start gap-4 py-3 border-b border-border last:border-0">
                    <div className="flex-1">
                      <p className={`font-sans text-sm font-medium ${role.color}`}>{role.name}</p>
                      <p className="font-sans text-xs text-muted-foreground mt-0.5">{role.description}</p>
                    </div>
                    {role.permissions.length > 0 && (
                      <div className="flex gap-1.5">
                        {role.permissions.map(p => (
                          <span key={p} className="font-mono text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
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
          )}

          {/* Webhooks Tab */}
          {activeTab === 'webhooks' && (
            <div className="bg-card rounded border border-border p-6">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-6">Webhook Endpoint</p>

              <p className="font-sans text-sm text-muted-foreground mb-4">
                POST members to this endpoint for external integration or automation.
              </p>

              <div className="bg-muted/50 border border-border rounded p-4 mb-4">
                <code className="font-mono text-xs text-primary break-all">
                  https://api.hackerspace.sh/{space.slug}/members
                </code>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(`https://api.hackerspace.sh/${space.slug}/members`)}
                  className="font-mono text-[10px] border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary transition flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {copiedWebhook ? 'Copied!' : 'Copy'}
                </button>
                <a
                  href="https://docs.hackerspace.sh/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary transition"
                >
                  View Docs
                </a>
                {isAdmin && (
                  <button
                    onClick={handleRotateWebhook}
                    disabled={saving}
                    className="font-mono text-[10px] border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary transition flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Rotate Secret
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar - Roles panel (visible on roles tab) */}
        {activeTab === 'roles' && (
          <div className="w-80 border-l border-border p-6 bg-card/50">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-4">Role Assignment</p>
            <p className="font-sans text-sm text-muted-foreground">
              Member roles can be changed from the Members page. Only admins can change roles.
            </p>
          </div>
        )}
      </div>

      {/* Integration Config Modal */}
      {editingIntegration && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 flex items-center justify-center">{editingIntegration.icon}</div>
                <h2 className="font-sans text-base font-semibold text-foreground">{editingIntegration.name}</h2>
              </div>
              <button onClick={() => setEditingIntegration(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIntegration} className="p-6 space-y-4">
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
          </div>
        </div>
      )}
    </div>
  )
}
