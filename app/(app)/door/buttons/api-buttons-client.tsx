'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Zap, Plus } from 'lucide-react'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { useConfirm } from '@/components/ui/confirm'
import { createApiButton, updateApiButton, deleteApiButton } from '@/lib/actions'

type Btn = {
  id: string
  label: string
  button_group: string
  sort_order: number
  method: string
  base_url: string
  pinned_host: string
  url_template: string | null
  headers: Record<string, string> | null
  body_template: string | null
  auth_mode: string
  auth_param: string | null
  secret_ref: string | null
  required_permission: string
  confirm: boolean
  is_enabled: boolean
}
type LogRow = { id: string; action: string; success: boolean; detail: string | null; occurred_at: string }
type Secret = { id: string; title: string }
type Perm = { code: string; label: string }

const input = 'w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary'
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const AUTH_MODES = ['none', 'query', 'header', 'bearer']

function emptyDraft() {
  return {
    label: '', button_group: 'General', method: 'POST', base_url: '', pinned_host: '',
    url_template: '', headersText: '', body_template: '',
    auth_mode: 'none', auth_param: '', secret_ref: '',
    required_permission: 'apicall.invoke', confirm: true,
  }
}

// Parse "Key: Value" lines into a header map (blank lines ignored).
function parseHeaders(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const i = line.indexOf(':')
    if (i <= 0) continue
    const k = line.slice(0, i).trim()
    const v = line.slice(i + 1).trim()
    if (k) out[k] = v
  }
  return out
}

export function ApiButtonsClient({
  initial,
  secrets,
  log,
  permissions,
}: {
  initial: unknown[]
  secrets: Secret[]
  log: unknown[]
  permissions: Perm[]
}) {
  const confirm = useConfirm()
  const [buttons, setButtons] = useState<Btn[]>(initial as Btn[])
  const [showNew, setShowNew] = useState(false)
  const [d, setD] = useState(emptyDraft())
  const [busy, setBusy] = useState(false)
  const rows = log as LogRow[]

  function doorTemplate() {
    setShowNew(true)
    setD({
      ...emptyDraft(),
      label: 'Open door', button_group: 'Door', method: 'GET',
      url_template: '?o1', auth_mode: 'query', auth_param: 'e',
      required_permission: 'door.operate', confirm: true,
    })
    toast.message('Door template loaded', { description: 'Set the base URL, pinned host, and password secret, then create.' })
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!d.label.trim() || !d.base_url.trim() || !d.pinned_host.trim()) {
      return toast.error('Label, base URL and pinned host are required')
    }
    const headers = parseHeaders(d.headersText)
    setBusy(true)
    const res = await createApiButton({
      label: d.label.trim(),
      button_group: d.button_group.trim() || 'General',
      method: d.method,
      base_url: d.base_url.trim(),
      pinned_host: d.pinned_host.trim(),
      url_template: d.url_template.trim() || null,
      headers,
      body_template: d.body_template.trim() || null,
      auth_mode: d.auth_mode,
      auth_param: d.auth_param.trim() || null,
      secret_ref: d.secret_ref || null,
      required_permission: d.required_permission,
      confirm: d.confirm,
    })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    const id = (res as { data: { id: string } }).data.id
    setButtons(prev => [
      {
        id, label: d.label.trim(), button_group: d.button_group.trim() || 'General', sort_order: 0,
        method: d.method, base_url: d.base_url.trim(), pinned_host: d.pinned_host.trim(),
        url_template: d.url_template.trim() || null, headers, body_template: d.body_template.trim() || null,
        auth_mode: d.auth_mode, auth_param: d.auth_param.trim() || null, secret_ref: d.secret_ref || null,
        required_permission: d.required_permission, confirm: d.confirm, is_enabled: true,
      },
      ...prev,
    ])
    setD(emptyDraft())
    setShowNew(false)
    toast.success('Button created')
  }

  async function onToggleEnabled(b: Btn) {
    const res = await updateApiButton({ buttonId: b.id, is_enabled: !b.is_enabled })
    if ('error' in res && res.error) return toast.error(res.error)
    setButtons(prev => prev.map(x => (x.id === b.id ? { ...x, is_enabled: !x.is_enabled } : x)))
  }

  async function onDelete(b: Btn) {
    const ok = await confirm({
      title: 'Delete button',
      description: `"${b.label}" will be removed. Existing API-call log entries are kept.`,
      confirmText: 'Delete',
      destructive: true,
    })
    if (!ok) return
    const res = await deleteApiButton({ buttonId: b.id })
    if ('error' in res && res.error) return toast.error(res.error)
    setButtons(prev => prev.filter(x => x.id !== b.id))
    toast.success('Deleted')
  }

  const permLabel = (code: string) => permissions.find(p => p.code === code)?.label ?? code

  return (
    <>
      <PageHeader>
        <PageTitle>API buttons</PageTitle>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={doorTemplate}>Door template</Button>
          <Button size="sm" onClick={() => setShowNew(v => !v)}>
            <Plus className="size-4" /> {showNew ? 'Cancel' : 'New button'}
          </Button>
        </div>
      </PageHeader>

      <div className="p-4 md:p-6 space-y-4">
        <p className="font-sans text-sm text-muted-foreground max-w-2xl">
          A button fires a configured HTTP request when an authorized member presses it. The
          request runs through the same hardened egress as door control: the server only ever
          calls the exact pinned host (any public or private host you set, except
          cloud-metadata/link-local), never follows redirects, caps time and response size, and
          records every press in the API-call log with secrets redacted. The secret is read from
          your encrypted Secrets vault and injected server-side, never stored here. Each button is
          gated by a permission you choose; a member sees only the buttons they may press.
        </p>

        {showNew && (
          <form onSubmit={onCreate} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className={input} placeholder="Label (e.g. Open front door)" maxLength={120}
                value={d.label} onChange={e => setD({ ...d, label: e.target.value })} />
              <input className={input} placeholder="Group (e.g. Door, Lights)" maxLength={60}
                value={d.button_group} onChange={e => setD({ ...d, button_group: e.target.value })} />
              <select className={input} value={d.method} onChange={e => setD({ ...d, method: e.target.value })}>
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className={input} value={d.required_permission} onChange={e => setD({ ...d, required_permission: e.target.value })}>
                {permissions.map(p => <option key={p.code} value={p.code}>Requires: {p.label}</option>)}
              </select>
              <input className={input} placeholder="Base URL (https://device.lan/ or http://192.168.1.50/)"
                value={d.base_url} onChange={e => setD({ ...d, base_url: e.target.value })} />
              <input className={input} placeholder="Pinned host (device.lan or 192.168.1.50)"
                value={d.pinned_host} onChange={e => setD({ ...d, pinned_host: e.target.value })} />
              <input className={input} placeholder="URL path/query appended to base (optional)"
                value={d.url_template} onChange={e => setD({ ...d, url_template: e.target.value })} />
              <select className={input} value={d.auth_mode} onChange={e => setD({ ...d, auth_mode: e.target.value })}>
                {AUTH_MODES.map(m => <option key={m} value={m}>auth: {m}</option>)}
              </select>
              {(d.auth_mode === 'query' || d.auth_mode === 'header') && (
                <input className={input} placeholder={d.auth_mode === 'query' ? 'query param name (e.g. e, api_key)' : 'header name (e.g. X-Api-Key)'}
                  value={d.auth_param} onChange={e => setD({ ...d, auth_param: e.target.value })} />
              )}
              {d.auth_mode !== 'none' && (
                <select className={input} value={d.secret_ref} onChange={e => setD({ ...d, secret_ref: e.target.value })}>
                  <option value="">No secret</option>
                  {secrets.map(s => <option key={s.id} value={s.id}>Secret: {s.title}</option>)}
                </select>
              )}
            </div>
            <textarea className={`${input} font-mono text-xs`} rows={2} placeholder="Custom headers, one per line: Header-Name: value (optional)"
              value={d.headersText} onChange={e => setD({ ...d, headersText: e.target.value })} />
            {d.method !== 'GET' && (
              <textarea className={`${input} font-mono text-xs`} rows={3} placeholder="Request body (optional; set Content-Type in headers if needed)"
                value={d.body_template} onChange={e => setD({ ...d, body_template: e.target.value })} />
            )}
            <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <input type="checkbox" checked={d.confirm} onChange={e => setD({ ...d, confirm: e.target.checked })} />
              Ask for confirmation before firing
            </label>
            <Button type="submit" size="sm" disabled={busy}>Create button</Button>
          </form>
        )}

        {buttons.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Zap /></EmptyMedia>
              <EmptyTitle>No API buttons</EmptyTitle>
              <EmptyDescription>Create a button to give members a one-press action (a door, lights, a webhook).</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="divide-y rounded-lg border border-border">
            {buttons.map(b => (
              <div key={b.id} className="p-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans text-sm font-semibold text-foreground">{b.label}</span>
                    <Badge variant="outline">{b.button_group}</Badge>
                    <Badge variant="outline">{b.method}</Badge>
                    {!b.is_enabled && <Badge variant="outline">Disabled</Badge>}
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground mt-1 break-all">
                    {b.base_url}{b.url_template ?? ''} · pinned {b.pinned_host} · auth {b.auth_mode}
                    {' · '}requires {permLabel(b.required_permission)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => onToggleEnabled(b)}>{b.is_enabled ? 'Disable' : 'Enable'}</Button>
                  <Button size="sm" variant="outline" onClick={() => onDelete(b)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2 mt-6">API-call log</h2>
          {rows.length === 0 ? (
            <p className="font-mono text-[10px] text-muted-foreground">No API calls recorded yet.</p>
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
