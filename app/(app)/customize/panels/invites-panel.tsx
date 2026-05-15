'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createInvite, updateInvite, deleteInvite } from '@/lib/actions'
import { Card } from './card'
import type { Invite } from './types'

function inviteLink(code: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/signup?invite=${encodeURIComponent(code)}`
}

export function InvitesPanel({ isAdmin, invites: initial }: { isAdmin: boolean; invites: Invite[] }) {
  const [invites, setInvites] = useState<Invite[]>(initial)
  const [showNew, setShowNew] = useState(false)
  const [d, setD] = useState({ code: '', label: '', expires_at: '', max_uses: '' })

  return (
    <Card
      title="Invite codes"
      blurb="Generate codes for new members. Share the code or the one-click join link. Set an expiry, a max-use cap, or leave both blank for a permanent code. Disable to revoke."
      action={isAdmin ? <button onClick={() => setShowNew(v => !v)} className="font-mono text-[10px] border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary transition whitespace-nowrap">{showNew ? 'Cancel' : '+ New invite'}</button> : undefined}
    >
      {showNew && (
        <form
          onSubmit={async e => {
            e.preventDefault()
            const result = await createInvite({ code: d.code.trim().toUpperCase() || undefined, label: d.label.trim() || undefined, expires_at: d.expires_at || undefined, max_uses: d.max_uses ? Number(d.max_uses) : undefined })
            if ('error' in result && result.error) { toast.error(result.error); return }
            const c = result as { id: string; code: string }
            toast.success(`Invite created: ${c.code}`)
            setInvites(prev => [{ id: c.id, code: c.code, label: d.label.trim() || null, expires_at: d.expires_at || null, max_uses: d.max_uses ? Number(d.max_uses) : null, uses_count: 0, is_enabled: true, created_at: new Date().toISOString() }, ...prev])
            setShowNew(false); setD({ code: '', label: '', expires_at: '', max_uses: '' })
          }}
          className="mb-4 p-4 border border-border rounded bg-background grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <input type="text" maxLength={32} value={d.code} onChange={e => setD({ ...d, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} placeholder="CODE (blank = auto)" className="bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <input type="text" maxLength={100} value={d.label} onChange={e => setD({ ...d, label: e.target.value })} placeholder="Label (optional)" className="bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <input type="datetime-local" value={d.expires_at} onChange={e => setD({ ...d, expires_at: e.target.value })} className="bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <input type="number" min="1" value={d.max_uses} onChange={e => setD({ ...d, max_uses: e.target.value })} placeholder="Max uses (blank = unlimited)" className="bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <button type="submit" className="md:col-span-2 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition">Create invite</button>
        </form>
      )}
      <ul className="divide-y divide-border">
        {invites.length === 0 && <li className="py-6 text-center font-sans text-sm text-muted-foreground">No invites yet.</li>}
        {invites.map(inv => {
          const expired = inv.expires_at ? new Date(inv.expires_at) < new Date() : false
          const usedUp = inv.max_uses !== null && inv.uses_count >= inv.max_uses
          return (
            <li key={inv.id} className="py-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-sm font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">{inv.code}</code>
                  {inv.label && <span className="font-sans text-sm text-foreground">{inv.label}</span>}
                  {!inv.is_enabled && <span className="font-mono text-[10px] text-red-500">disabled</span>}
                  {expired && <span className="font-mono text-[10px] text-red-500">expired</span>}
                  {usedUp && <span className="font-mono text-[10px] text-red-500">at cap</span>}
                </div>
                <p className="font-mono text-[10px] text-muted-foreground/70 mt-0.5">{inv.expires_at ? `expires ${new Date(inv.expires_at).toLocaleString()}` : 'permanent'} · uses {inv.uses_count}{inv.max_uses ? ` / ${inv.max_uses}` : ' (unlimited)'}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => { navigator.clipboard.writeText(inv.code); toast.success('Code copied') }} className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-primary hover:text-primary transition">Copy code</button>
                <button onClick={() => { navigator.clipboard.writeText(inviteLink(inv.code)); toast.success('Invite link copied') }} className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-primary hover:text-primary transition">Copy link</button>
                {isAdmin && (
                  <>
                    <button onClick={async () => { const res = await updateInvite(inv.id, { is_enabled: !inv.is_enabled }); if (res.error) { toast.error(res.error); return } setInvites(prev => prev.map(x => x.id === inv.id ? { ...x, is_enabled: !x.is_enabled } : x)) }} className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-primary hover:text-primary transition">{inv.is_enabled ? 'Disable' : 'Enable'}</button>
                    <button onClick={async () => { if (!confirm(`Delete invite "${inv.code}"?`)) return; const res = await deleteInvite(inv.id); if (res.error) { toast.error(res.error); return } setInvites(prev => prev.filter(x => x.id !== inv.id)); toast.success('Deleted') }} className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-red-500 hover:text-red-500 transition">Delete</button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
