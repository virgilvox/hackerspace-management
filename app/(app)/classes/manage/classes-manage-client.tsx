'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { GraduationCap, Plus } from 'lucide-react'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { useConfirm } from '@/components/ui/confirm'
import {
  createClass,
  updateClass,
  deleteClass,
  createSession,
  updateSession,
  deleteSession,
} from '@/lib/actions'
import { SESSION_STATUS_LABEL } from '@/lib/classes-logic'
import { SessionAttendance } from '@/components/classes/session-attendance'

type Cls = {
  id: string
  title: string
  description: string | null
  payment_link: string | null
  capacity: number | null
  is_active: boolean
  grants_certification_id: string | null
  required_form_id: string | null
}
type Session = {
  id: string
  class_id: string
  starts_at: string
  ends_at: string | null
  location: string | null
  capacity: number | null
  status: string
  notes: string | null
}
type Cert = { id: string; name: string; is_active: boolean }
type Form = { id: string; title: string; kind: string }

const inputCls =
  'w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary'

function emptyClassDraft() {
  return { title: '', description: '', payment_link: '', capacity: '', grants_certification_id: '', required_form_id: '' }
}
function emptySessionDraft() {
  return { starts_at: '', ends_at: '', location: '', capacity: '', notes: '' }
}
function num(s: string): number | null {
  const t = s.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isInteger(n) && n > 0 ? n : null
}

export function ClassesManageClient({
  initialClasses,
  initialSessions,
  certs,
  forms,
}: {
  initialClasses: Cls[]
  initialSessions: Session[]
  certs: Cert[]
  forms: Form[]
}) {
  const confirm = useConfirm()
  const [classes, setClasses] = useState<Cls[]>(initialClasses)
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState(emptyClassDraft())
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState(emptyClassDraft())
  const [sessForClass, setSessForClass] = useState<string | null>(null)
  const [sessDraft, setSessDraft] = useState(emptySessionDraft())
  const [rosterFor, setRosterFor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function certName(id: string | null) {
    return id ? certs.find(c => c.id === id)?.name ?? null : null
  }
  function formName(id: string | null) {
    return id ? forms.find(f => f.id === id)?.title ?? null : null
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.title.trim()) return toast.error('Title is required')
    setBusy(true)
    const res = await createClass({
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      payment_link: draft.payment_link.trim() || null,
      capacity: num(draft.capacity),
      grants_certification_id: draft.grants_certification_id || null,
      required_form_id: draft.required_form_id || null,
    })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    const id = (res as { data: { id: string } }).data.id
    setClasses(prev => [
      {
        id,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        payment_link: draft.payment_link.trim() || null,
        capacity: num(draft.capacity),
        is_active: true,
        grants_certification_id: draft.grants_certification_id || null,
        required_form_id: draft.required_form_id || null,
      },
      ...prev,
    ])
    setDraft(emptyClassDraft())
    setShowNew(false)
    toast.success('Class created')
  }

  function startEdit(c: Cls) {
    setEditId(c.id)
    setEditDraft({
      title: c.title,
      description: c.description ?? '',
      payment_link: c.payment_link ?? '',
      capacity: c.capacity == null ? '' : String(c.capacity),
      grants_certification_id: c.grants_certification_id ?? '',
      required_form_id: c.required_form_id ?? '',
    })
  }

  async function onSaveEdit(id: string) {
    if (!editDraft.title.trim()) return toast.error('Title is required')
    setBusy(true)
    const res = await updateClass({
      classId: id,
      title: editDraft.title.trim(),
      description: editDraft.description.trim() || null,
      payment_link: editDraft.payment_link.trim() || null,
      capacity: num(editDraft.capacity),
      grants_certification_id: editDraft.grants_certification_id || null,
      required_form_id: editDraft.required_form_id || null,
    })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    setClasses(prev =>
      prev.map(c =>
        c.id === id
          ? {
              ...c,
              title: editDraft.title.trim(),
              description: editDraft.description.trim() || null,
              payment_link: editDraft.payment_link.trim() || null,
              capacity: num(editDraft.capacity),
              grants_certification_id: editDraft.grants_certification_id || null,
              required_form_id: editDraft.required_form_id || null,
            }
          : c,
      ),
    )
    setEditId(null)
    toast.success('Saved')
  }

  async function onToggleActive(c: Cls) {
    const res = await updateClass({ classId: c.id, is_active: !c.is_active })
    if ('error' in res && res.error) return toast.error(res.error)
    setClasses(prev => prev.map(x => (x.id === c.id ? { ...x, is_active: !x.is_active } : x)))
    toast.success(c.is_active ? 'Archived' : 'Restored')
  }

  async function onDeleteClass(c: Cls) {
    const ok = await confirm({
      title: 'Delete class',
      description: `"${c.title}" will be removed. Only allowed if it has no sessions.`,
      confirmText: 'Delete',
      destructive: true,
    })
    if (!ok) return
    const res = await deleteClass({ classId: c.id })
    if ('error' in res && res.error) return toast.error(res.error)
    setClasses(prev => prev.filter(x => x.id !== c.id))
    toast.success('Deleted')
  }

  async function onAddSession(e: React.FormEvent, classId: string) {
    e.preventDefault()
    if (!sessDraft.starts_at) return toast.error('Start time is required')
    setBusy(true)
    const res = await createSession({
      classId,
      starts_at: sessDraft.starts_at,
      ends_at: sessDraft.ends_at || null,
      location: sessDraft.location.trim() || null,
      capacity: num(sessDraft.capacity),
      notes: sessDraft.notes.trim() || null,
    })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    const id = (res as { data: { id: string } }).data.id
    setSessions(prev => [
      ...prev,
      {
        id,
        class_id: classId,
        starts_at: sessDraft.starts_at,
        ends_at: sessDraft.ends_at || null,
        location: sessDraft.location.trim() || null,
        capacity: num(sessDraft.capacity),
        status: 'scheduled',
        notes: sessDraft.notes.trim() || null,
      },
    ])
    setSessDraft(emptySessionDraft())
    setSessForClass(null)
    toast.success('Session scheduled')
  }

  async function onCancelSession(s: Session) {
    const ok = await confirm({
      title: 'Cancel session',
      description: 'Registered members will no longer be able to attend.',
      confirmText: 'Cancel session',
      destructive: true,
    })
    if (!ok) return
    const res = await updateSession({ sessionId: s.id, status: 'cancelled' })
    if ('error' in res && res.error) return toast.error(res.error)
    setSessions(prev => prev.map(x => (x.id === s.id ? { ...x, status: 'cancelled' } : x)))
    toast.success('Session cancelled')
  }

  async function onDeleteSession(s: Session) {
    const ok = await confirm({
      title: 'Delete session',
      description: 'Only allowed if it has no signups. Cancel it instead to keep history.',
      confirmText: 'Delete',
      destructive: true,
    })
    if (!ok) return
    const res = await deleteSession({ sessionId: s.id })
    if ('error' in res && res.error) return toast.error(res.error)
    setSessions(prev => prev.filter(x => x.id !== s.id))
    toast.success('Deleted')
  }

  return (
    <>
      <PageHeader>
        <PageTitle>Manage classes</PageTitle>
        <Button size="sm" onClick={() => setShowNew(v => !v)}>
          <Plus className="size-4" /> {showNew ? 'Cancel' : 'New class'}
        </Button>
      </PageHeader>

      <div className="p-4 md:p-6 space-y-4">
        {showNew && (
          <form onSubmit={onCreate} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <input autoFocus className={inputCls} placeholder="Title (e.g. Woodshop Basics)" maxLength={200}
              value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
            <textarea className={inputCls} placeholder="Description (optional)" rows={2} maxLength={5000}
              value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
            <input className={inputCls} placeholder="Payment link (optional, https://…)"
              value={draft.payment_link} onChange={e => setDraft({ ...draft, payment_link: e.target.value })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="number" min="1" className={inputCls} placeholder="Default capacity (blank = unlimited)"
                value={draft.capacity} onChange={e => setDraft({ ...draft, capacity: e.target.value })} />
              <select className={inputCls} value={draft.grants_certification_id}
                onChange={e => setDraft({ ...draft, grants_certification_id: e.target.value })}>
                <option value="">Grants no certification</option>
                {certs.map(c => <option key={c.id} value={c.id}>Grants: {c.name}</option>)}
              </select>
              <select className={inputCls} value={draft.required_form_id}
                onChange={e => setDraft({ ...draft, required_form_id: e.target.value })}>
                <option value="">No required form</option>
                {forms.map(f => <option key={f.id} value={f.id}>Requires: {f.title}{f.kind === 'waiver' ? ' (waiver)' : ''}</option>)}
              </select>
            </div>
            {forms.length === 0 && (
              <p className="font-mono text-[10px] text-muted-foreground">
                Tip: publish a form under Forms to be able to require it (e.g. a liability waiver) before signup.
              </p>
            )}
            <Button type="submit" size="sm" disabled={busy}>Create class</Button>
          </form>
        )}

        {classes.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><GraduationCap /></EmptyMedia>
              <EmptyTitle>No classes yet</EmptyTitle>
              <EmptyDescription>Create a class, then schedule sessions members can sign up for.</EmptyDescription>
            </EmptyHeader>
            <Button onClick={() => setShowNew(true)}><Plus className="size-4" /> Create your first class</Button>
          </Empty>
        ) : (
          <div className="space-y-4">
            {classes.map(c => {
              const cs = sessions.filter(s => s.class_id === c.id)
              return (
                <div key={c.id} className="rounded-lg border border-border">
                  <div className="p-4">
                    {editId === c.id ? (
                      <div className="space-y-3">
                        <input className={inputCls} maxLength={200} value={editDraft.title}
                          onChange={e => setEditDraft({ ...editDraft, title: e.target.value })} />
                        <textarea className={inputCls} rows={2} maxLength={5000} placeholder="Description"
                          value={editDraft.description} onChange={e => setEditDraft({ ...editDraft, description: e.target.value })} />
                        <input className={inputCls} placeholder="Payment link (https://…)"
                          value={editDraft.payment_link} onChange={e => setEditDraft({ ...editDraft, payment_link: e.target.value })} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input type="number" min="1" className={inputCls} placeholder="Default capacity"
                            value={editDraft.capacity} onChange={e => setEditDraft({ ...editDraft, capacity: e.target.value })} />
                          <select className={inputCls} value={editDraft.grants_certification_id}
                            onChange={e => setEditDraft({ ...editDraft, grants_certification_id: e.target.value })}>
                            <option value="">Grants no certification</option>
                            {certs.map(x => <option key={x.id} value={x.id}>Grants: {x.name}</option>)}
                          </select>
                          <select className={inputCls} value={editDraft.required_form_id}
                            onChange={e => setEditDraft({ ...editDraft, required_form_id: e.target.value })}>
                            <option value="">No required form</option>
                            {forms.map(f => <option key={f.id} value={f.id}>Requires: {f.title}{f.kind === 'waiver' ? ' (waiver)' : ''}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" disabled={busy} onClick={() => onSaveEdit(c.id)}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-sans text-sm font-semibold text-foreground">{c.title}</span>
                            {!c.is_active && <Badge variant="outline">Archived</Badge>}
                            {c.capacity != null && <span className="font-mono text-[10px] text-muted-foreground">cap {c.capacity}</span>}
                            {certName(c.grants_certification_id) && (
                              <span className="font-mono text-[10px] text-primary">grants {certName(c.grants_certification_id)}</span>
                            )}
                            {formName(c.required_form_id) && (
                              <span className="font-mono text-[10px] text-amber-600">requires form: {formName(c.required_form_id)}</span>
                            )}
                          </div>
                          {c.description && <p className="font-sans text-sm text-muted-foreground mt-1">{c.description}</p>}
                          {c.payment_link && (
                            <a href={c.payment_link} target="_blank" rel="noopener noreferrer"
                              className="font-mono text-[10px] text-primary underline">payment link</a>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => startEdit(c)}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => onToggleActive(c)}>{c.is_active ? 'Archive' : 'Restore'}</Button>
                          <Button size="sm" variant="outline" onClick={() => onDeleteClass(c)}>Delete</Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Sessions</p>
                      <Button size="sm" variant="outline"
                        onClick={() => { setSessForClass(sessForClass === c.id ? null : c.id); setSessDraft(emptySessionDraft()) }}>
                        {sessForClass === c.id ? 'Cancel' : '+ Schedule session'}
                      </Button>
                    </div>

                    {sessForClass === c.id && (
                      <form onSubmit={e => onAddSession(e, c.id)} className="rounded border border-border bg-background p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label className="font-mono text-[10px] text-muted-foreground">Starts
                          <input type="datetime-local" className={inputCls} value={sessDraft.starts_at}
                            onChange={e => setSessDraft({ ...sessDraft, starts_at: e.target.value })} />
                        </label>
                        <label className="font-mono text-[10px] text-muted-foreground">Ends (optional)
                          <input type="datetime-local" className={inputCls} value={sessDraft.ends_at}
                            onChange={e => setSessDraft({ ...sessDraft, ends_at: e.target.value })} />
                        </label>
                        <input className={inputCls} placeholder="Location (optional)"
                          value={sessDraft.location} onChange={e => setSessDraft({ ...sessDraft, location: e.target.value })} />
                        <input type="number" min="1" className={inputCls} placeholder="Capacity override (optional)"
                          value={sessDraft.capacity} onChange={e => setSessDraft({ ...sessDraft, capacity: e.target.value })} />
                        <textarea className={`${inputCls} sm:col-span-2`} rows={2} placeholder="Notes (optional)"
                          value={sessDraft.notes} onChange={e => setSessDraft({ ...sessDraft, notes: e.target.value })} />
                        <div className="sm:col-span-2">
                          <Button type="submit" size="sm" disabled={busy}>Schedule</Button>
                        </div>
                      </form>
                    )}

                    {cs.length === 0 ? (
                      <p className="font-mono text-[10px] text-muted-foreground">No sessions scheduled.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {cs.map(s => (
                          <li key={s.id} className="py-2">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="font-mono text-[11px] text-muted-foreground">
                                {new Date(s.starts_at).toLocaleString()}
                                {s.location ? ` · ${s.location}` : ''}
                                {s.capacity != null ? ` · cap ${s.capacity}` : ''}
                                {' · '}
                                <span className={s.status === 'cancelled' ? 'text-red-500' : s.status === 'completed' ? 'text-primary' : ''}>
                                  {SESSION_STATUS_LABEL[s.status] ?? s.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button size="sm" variant="outline"
                                  onClick={() => setRosterFor(rosterFor === s.id ? null : s.id)}>
                                  {rosterFor === s.id ? 'Hide signups' : 'Signups'}
                                </Button>
                                {s.status === 'scheduled' && (
                                  <Button size="sm" variant="outline" onClick={() => onCancelSession(s)}>Cancel</Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => onDeleteSession(s)}>Delete</Button>
                              </div>
                            </div>
                            {rosterFor === s.id && (
                              <SessionAttendance
                                sessionId={s.id}
                                sessionStatus={s.status}
                                onCompleted={() => {
                                  setSessions(prev => prev.map(x => (x.id === s.id ? { ...x, status: 'completed' } : x)))
                                  setRosterFor(null)
                                }}
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
