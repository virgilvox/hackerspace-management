'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { DoorClosed, Plus } from 'lucide-react'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { useConfirm } from '@/components/ui/confirm'
import {
  createDoorConnection,
  updateDoorConnection,
  deleteDoorConnection,
  testDoorConnection,
} from '@/lib/actions'

type Conn = {
  id: string
  name: string
  adapter: string
  base_url: string
  pinned_host: string
  auth_mode: string
  auth_param: string | null
  secret_ref: string | null
  verbs: Record<string, string> | null
  allow_member_self_entry: boolean
  is_enabled: boolean
}
type LogRow = { id: string; action: string; success: boolean; detail: string | null; occurred_at: string }

const input = 'w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary'

function emptyDraft() {
  return {
    name: '', adapter: 'native_heatsync', base_url: '', pinned_host: '',
    secret_ref: '', allow_member_self_entry: false,
    grant: '', revoke: '', open: '', status: '',
  }
}

export function DoorManageClient({
  initial,
  secrets,
  log,
}: {
  initial: unknown[]
  secrets: { id: string; title: string }[]
  log: unknown[]
}) {
  const confirm = useConfirm()
  const [conns, setConns] = useState<Conn[]>(initial as Conn[])
  const [showNew, setShowNew] = useState(false)
  const [d, setD] = useState(emptyDraft())
  const [busy, setBusy] = useState(false)
  const rows = log as LogRow[]

  function buildVerbs(dr: typeof d) {
    if (dr.adapter === 'native_heatsync') return {}
    const v: Record<string, string> = {}
    if (dr.grant.trim()) v.grant = dr.grant.trim()
    if (dr.revoke.trim()) v.revoke = dr.revoke.trim()
    if (dr.open.trim()) v.open = dr.open.trim()
    if (dr.status.trim()) v.status = dr.status.trim()
    return v
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!d.name.trim() || !d.base_url.trim() || !d.pinned_host.trim()) {
      return toast.error('Name, base URL and pinned host are required')
    }
    setBusy(true)
    const res = await createDoorConnection({
      name: d.name.trim(),
      adapter: d.adapter,
      base_url: d.base_url.trim(),
      pinned_host: d.pinned_host.trim(),
      auth_mode: d.secret_ref ? 'query' : 'none',
      auth_param: d.adapter === 'native_heatsync' ? 'e' : null,
      secret_ref: d.secret_ref || null,
      verbs: buildVerbs(d),
      allow_member_self_entry: d.allow_member_self_entry,
    })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    const id = (res as { data: { id: string } }).data.id
    setConns(prev => [
      {
        id, name: d.name.trim(), adapter: d.adapter, base_url: d.base_url.trim(),
        pinned_host: d.pinned_host.trim(), auth_mode: d.secret_ref ? 'query' : 'none',
        auth_param: d.adapter === 'native_heatsync' ? 'e' : null, secret_ref: d.secret_ref || null,
        verbs: buildVerbs(d), allow_member_self_entry: d.allow_member_self_entry, is_enabled: true,
      },
      ...prev,
    ])
    setD(emptyDraft())
    setShowNew(false)
    toast.success('Connection created')
  }

  async function onToggleEnabled(c: Conn) {
    const res = await updateDoorConnection({ connectionId: c.id, is_enabled: !c.is_enabled })
    if ('error' in res && res.error) return toast.error(res.error)
    setConns(prev => prev.map(x => (x.id === c.id ? { ...x, is_enabled: !x.is_enabled } : x)))
  }

  async function onToggleSelfEntry(c: Conn) {
    const next = !c.allow_member_self_entry
    if (next) {
      const ok = await confirm({
        title: 'Allow member self-entry?',
        description: 'Any active member will be able to trigger this door themselves. This is an elevated physical-security risk. Continue?',
        confirmText: 'Enable self-entry',
        destructive: true,
      })
      if (!ok) return
    }
    const res = await updateDoorConnection({ connectionId: c.id, allow_member_self_entry: next })
    if ('error' in res && res.error) return toast.error(res.error)
    setConns(prev => prev.map(x => (x.id === c.id ? { ...x, allow_member_self_entry: next } : x)))
  }

  async function onTest(c: Conn) {
    setBusy(true)
    const res = await testDoorConnection({ connectionId: c.id })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(`Test failed: ${res.error}`)
    toast.success(`Reachable (HTTP ${(res as { data: { status: number } }).data.status})`)
  }

  async function onDelete(c: Conn) {
    const ok = await confirm({
      title: 'Delete connection',
      description: `"${c.name}" will be removed. Existing access-log entries are kept.`,
      confirmText: 'Delete',
      destructive: true,
    })
    if (!ok) return
    const res = await deleteDoorConnection({ connectionId: c.id })
    if ('error' in res && res.error) return toast.error(res.error)
    setConns(prev => prev.filter(x => x.id !== c.id))
    toast.success('Deleted')
  }

  return (
    <>
      <PageHeader>
        <PageTitle>Door access</PageTitle>
        <Button size="sm" onClick={() => setShowNew(v => !v)}>
          <Plus className="size-4" /> {showNew ? 'Cancel' : 'New connection'}
        </Button>
      </PageHeader>

      <div className="p-4 md:p-6 space-y-4">
        <p className="font-sans text-sm text-muted-foreground max-w-2xl">
          A connection targets a door controller on your LAN. The shared password is read
          from your encrypted Secrets vault, never stored here. The server only ever calls
          the exact pinned host, never follows redirects, and records every action in the
          access log with secrets redacted.
        </p>

        {showNew && (
          <form onSubmit={onCreate} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <input className={input} placeholder="Name (e.g. Front door)" maxLength={200}
              value={d.name} onChange={e => setD({ ...d, name: e.target.value })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select className={input} value={d.adapter} onChange={e => setD({ ...d, adapter: e.target.value })}>
                <option value="native_heatsync">Native HeatSync controller</option>
                <option value="generic_http">Generic HTTP</option>
              </select>
              <select className={input} value={d.secret_ref} onChange={e => setD({ ...d, secret_ref: e.target.value })}>
                <option value="">No password (auth: none)</option>
                {secrets.map(s => <option key={s.id} value={s.id}>Password: {s.title}</option>)}
              </select>
              <input className={input} placeholder="Base URL (http://192.168.1.50/)"
                value={d.base_url} onChange={e => setD({ ...d, base_url: e.target.value })} />
              <input className={input} placeholder="Pinned host (192.168.1.50)"
                value={d.pinned_host} onChange={e => setD({ ...d, pinned_host: e.target.value })} />
            </div>
            {d.adapter === 'generic_http' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className={input} placeholder="grant template (?m{slot}&t{tag}&e={pw})"
                  value={d.grant} onChange={e => setD({ ...d, grant: e.target.value })} />
                <input className={input} placeholder="revoke template (?r{slot}&e={pw})"
                  value={d.revoke} onChange={e => setD({ ...d, revoke: e.target.value })} />
                <input className={input} placeholder="open template (?o1&e={pw})"
                  value={d.open} onChange={e => setD({ ...d, open: e.target.value })} />
                <input className={input} placeholder="status template (?9&e={pw})"
                  value={d.status} onChange={e => setD({ ...d, status: e.target.value })} />
              </div>
            )}
            <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <input type="checkbox" checked={d.allow_member_self_entry}
                onChange={e => setD({ ...d, allow_member_self_entry: e.target.checked })} />
              Allow member self-entry (elevated risk; off by default)
            </label>
            <Button type="submit" size="sm" disabled={busy}>Create connection</Button>
          </form>
        )}

        {conns.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><DoorClosed /></EmptyMedia>
              <EmptyTitle>No door connections</EmptyTitle>
              <EmptyDescription>Add a controller connection to manage physical access.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="divide-y rounded-lg border border-border">
            {conns.map(c => (
              <div key={c.id} className="p-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans text-sm font-semibold text-foreground">{c.name}</span>
                    <Badge variant="outline">{c.adapter === 'native_heatsync' ? 'HeatSync' : 'Generic'}</Badge>
                    {!c.is_enabled && <Badge variant="outline">Disabled</Badge>}
                    {c.allow_member_self_entry && <span className="font-mono text-[10px] text-amber-600">self-entry on</span>}
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground mt-1">
                    {c.base_url} · pinned {c.pinned_host} · auth {c.secret_ref ? 'secret' : 'none'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => onTest(c)}>Test</Button>
                  <Button size="sm" variant="outline" onClick={() => onToggleEnabled(c)}>{c.is_enabled ? 'Disable' : 'Enable'}</Button>
                  <Button size="sm" variant="outline" onClick={() => onToggleSelfEntry(c)}>
                    {c.allow_member_self_entry ? 'Self-entry off' : 'Self-entry on'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDelete(c)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 mt-6">Access log</h2>
          {rows.length === 0 ? (
            <p className="font-mono text-[10px] text-muted-foreground">No door activity recorded yet.</p>
          ) : (
            <ul className="divide-y rounded border border-border">
              {rows.map(r => (
                <li key={r.id} className="px-3 py-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    <span className={r.success ? 'text-primary' : 'text-red-500'}>{r.success ? 'ok' : 'fail'}</span>
                    {' · '}{r.action}{r.detail ? ` · ${r.detail}` : ''}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/70">{new Date(r.occurred_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
