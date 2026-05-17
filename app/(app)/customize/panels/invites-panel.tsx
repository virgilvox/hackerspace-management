'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Ticket } from 'lucide-react'
import { createInvite, updateInvite, deleteInvite } from '@/lib/actions'
import { Card } from './card'
import { useConfirm } from '@/components/ui/confirm'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import type { Invite } from './types'
import { INVITE_ROLES, canAssignInviteRole } from '@/lib/invite-logic'

export function InvitesPanel({
  isAdmin,
  invites: initial,
  creatorRole,
  spaceSlug,
}: {
  isAdmin: boolean
  invites: Invite[]
  creatorRole: string
  spaceSlug: string
}) {
  const confirm = useConfirm()
  const [invites, setInvites] = useState<Invite[]>(initial)
  const [showNew, setShowNew] = useState(false)
  const [d, setD] = useState({ code: '', label: '', expires_at: '', max_uses: '', role: 'member', singleUse: false })

  const assignableRoles = INVITE_ROLES.filter(r => canAssignInviteRole(creatorRole, r))

  function inviteLink(code: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/join/${spaceSlug}?code=${encodeURIComponent(code)}`
  }

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
            const maxUses = d.singleUse ? 1 : (d.max_uses ? Number(d.max_uses) : undefined)
            const result = await createInvite({ code: d.code.trim().toUpperCase() || undefined, label: d.label.trim() || undefined, expires_at: d.expires_at || undefined, max_uses: maxUses, role: d.role as 'admin' | 'board' | 'treasurer' | 'member' | 'associate' })
            if ('error' in result && result.error) { toast.error(result.error); return }
            const c = result as { id: string; code: string }
            toast.success(`Invite created: ${c.code}`)
            setInvites(prev => [{ id: c.id, code: c.code, label: d.label.trim() || null, expires_at: d.expires_at || null, max_uses: maxUses ?? null, uses_count: 0, is_enabled: true, role: d.role, created_at: new Date().toISOString() }, ...prev])
            setShowNew(false); setD({ code: '', label: '', expires_at: '', max_uses: '', role: 'member', singleUse: false })
          }}
          className="mb-4 p-4 border border-border rounded bg-background grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <input type="text" maxLength={32} value={d.code} onChange={e => setD({ ...d, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} placeholder="CODE (blank = auto)" className="bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <input type="text" maxLength={100} value={d.label} onChange={e => setD({ ...d, label: e.target.value })} placeholder="Label (optional)" className="bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <input type="datetime-local" value={d.expires_at} onChange={e => setD({ ...d, expires_at: e.target.value })} className="bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary" />
          <input type="number" min="1" value={d.max_uses} disabled={d.singleUse} onChange={e => setD({ ...d, max_uses: e.target.value })} placeholder="Max uses (blank = unlimited)" className="bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1.5 focus:outline-none focus:border-primary disabled:opacity-50" />
          <select value={d.role} onChange={e => setD({ ...d, role: e.target.value })} className="bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1.5 focus:outline-none focus:border-primary">
            {assignableRoles.map(r => (
              <option key={r} value={r}>Grants: {r}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <input type="checkbox" checked={d.singleUse} onChange={e => setD({ ...d, singleUse: e.target.checked, max_uses: e.target.checked ? '' : d.max_uses })} />
            Single use (one join, then auto-disables)
          </label>
          <button type="submit" className="md:col-span-2 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition">Create invite</button>
        </form>
      )}
      {invites.length === 0 && (
        <Empty className="border-0 p-0 md:p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Ticket /></EmptyMedia>
            <EmptyTitle>No invite codes yet</EmptyTitle>
            <EmptyDescription>Create a code to let new members join, with an optional expiry or use cap.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <ul className="divide-y divide-border">
        {invites.map(inv => {
          const expired = inv.expires_at ? new Date(inv.expires_at) < new Date() : false
          const usedUp = inv.max_uses !== null && inv.uses_count >= inv.max_uses
          return (
            <li key={inv.id} className="py-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-sm font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">{inv.code}</code>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">grants {inv.role}</span>
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
                    <button onClick={async () => { if (!(await confirm({ title: 'Delete invite', description: `"${inv.code}" will be permanently removed.`, confirmText: 'Delete', destructive: true }))) return; const res = await deleteInvite(inv.id); if (res.error) { toast.error(res.error); return } setInvites(prev => prev.filter(x => x.id !== inv.id)); toast.success('Deleted') }} className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-red-500 hover:text-red-500 transition">Delete</button>
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
