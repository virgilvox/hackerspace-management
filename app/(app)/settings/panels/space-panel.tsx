'use client'

import { useState } from 'react'
import { Copy } from 'lucide-react'
import { updateSpaceSettings, updateSpaceVisibility } from '@/lib/actions'
import { financialVisibilities, directoryVisibilities } from '@/lib/validations'
import type { SaveStatus, Space, SpaceExt } from '../types'

interface Props extends SaveStatus {
  space: Space
  isAdmin: boolean
}

export function SpacePanel({ space, isAdmin, saving, setSaving, setMessage }: Props) {
  const spaceExt = space as SpaceExt

  // Space form (basic + mission statement)
  const [spaceForm, setSpaceForm] = useState({
    name: space.name || '',
    slug: space.slug || '',
    city: space.city || '',
    require_approval: space.require_approval ?? true,
    public_member_directory: space.public_member_directory ?? false,
    mission_statement: spaceExt.mission_statement || '',
  })

  // Visibility form (governance) — separate server action, separate save.
  const [visibilityForm, setVisibilityForm] = useState({
    financial_visibility: (spaceExt.financial_visibility as string | undefined) || 'board_visible',
    member_directory_visibility: (spaceExt.member_directory_visibility as string | undefined) || 'members_visible',
  })

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

  async function handleSaveVisibility(e: React.FormEvent) {
    e.preventDefault()
    if (!isAdmin) return
    setSaving(true)
    setMessage(null)
    const result = await updateSpaceVisibility(visibilityForm)
    if ('error' in result && result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: 'Visibility updated.' })
    }
    setSaving(false)
  }

  return (
    <>
      {/* Space Settings */}
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
            <label className="font-sans text-sm text-foreground block mb-1.5">Mission statement</label>
            <textarea
              value={spaceForm.mission_statement}
              onChange={e => setSpaceForm(f => ({ ...f, mission_statement: e.target.value }))}
              disabled={!isAdmin}
              maxLength={5000}
              rows={4}
              placeholder="One or two sentences. Rendered at the foot of every page as a reminder to members and the platform itself."
              className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground disabled:opacity-50 focus:outline-none focus:border-primary"
            />
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
                  onClick={() => navigator.clipboard.writeText(space.invite_code!)}
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

      {/* Governance Visibility (still under Space tab) */}
      <div className="bg-card rounded border border-border p-6 mt-6">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-1">Visibility</p>
        <p className="font-mono text-[10px] text-muted-foreground mb-6">
          Who sees financial data and the member directory. These flags propagate to the
          /financials page and (in a future pass) to the members directory.
        </p>

        <form onSubmit={handleSaveVisibility} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="font-sans text-sm text-foreground block mb-1.5">Financial data visibility</label>
              <select
                value={visibilityForm.financial_visibility}
                onChange={e => setVisibilityForm(f => ({ ...f, financial_visibility: e.target.value }))}
                disabled={!isAdmin}
                className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground disabled:opacity-50 focus:outline-none focus:border-primary"
              >
                {financialVisibilities.map(v => (
                  <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <p className="font-mono text-[10px] text-muted-foreground mt-1">
                Treasurer-only is the default in cooperatives historically. Board-visible is
                the recommended default. All-members-visible is full transparency.
              </p>
            </div>
            <div>
              <label className="font-sans text-sm text-foreground block mb-1.5">Member directory visibility</label>
              <select
                value={visibilityForm.member_directory_visibility}
                onChange={e => setVisibilityForm(f => ({ ...f, member_directory_visibility: e.target.value }))}
                disabled={!isAdmin}
                className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground disabled:opacity-50 focus:outline-none focus:border-primary"
              >
                {directoryVisibilities.map(v => (
                  <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <p className="font-mono text-[10px] text-muted-foreground mt-1">
                Public-members-visible exposes the directory at a public URL. Count-only
                surfaces the headcount but no individual names.
              </p>
            </div>
          </div>

          {isAdmin && (
            <div>
              <button
                type="submit"
                disabled={saving}
                className="bg-primary text-white font-sans text-sm px-6 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save visibility'}
              </button>
            </div>
          )}
        </form>
      </div>
    </>
  )
}
