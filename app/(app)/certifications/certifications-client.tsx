'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Award, Plus } from 'lucide-react'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { useConfirm } from '@/components/ui/confirm'
import {
  createCertification,
  updateCertification,
  deleteCertification,
} from '@/lib/actions'

type Cert = {
  id: string
  name: string
  description: string | null
  validity_months: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type Draft = { name: string; description: string; validity_months: string }

const emptyDraft: Draft = { name: '', description: '', validity_months: '' }

function validityLabel(months: number | null): string {
  if (months == null) return 'Never expires'
  if (months === 1) return 'Expires 1 month after award'
  if (months % 12 === 0) {
    const y = months / 12
    return `Expires ${y} year${y === 1 ? '' : 's'} after award`
  }
  return `Expires ${months} months after award`
}

function parseMonths(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isInteger(n) && n > 0 ? n : null
}

export function CertificationsClient({ initial }: { initial: Cert[] }) {
  const confirm = useConfirm()
  const [certs, setCerts] = useState<Cert[]>(initial)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState(false)

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) {
      toast.error('Name is required')
      return
    }
    setBusy(true)
    const res = await createCertification({
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      validity_months: parseMonths(draft.validity_months),
    })
    setBusy(false)
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    const id = (res as { data: { id: string } }).data.id
    setCerts(prev => [
      {
        id,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        validity_months: parseMonths(draft.validity_months),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      ...prev,
    ])
    setDraft(emptyDraft)
    setShowNew(false)
    toast.success('Certification created')
  }

  function startEdit(c: Cert) {
    setEditingId(c.id)
    setEditDraft({
      name: c.name,
      description: c.description ?? '',
      validity_months: c.validity_months == null ? '' : String(c.validity_months),
    })
  }

  async function onSaveEdit(id: string) {
    if (!editDraft.name.trim()) {
      toast.error('Name is required')
      return
    }
    setBusy(true)
    const res = await updateCertification({
      certificationId: id,
      name: editDraft.name.trim(),
      description: editDraft.description.trim() || null,
      validity_months: parseMonths(editDraft.validity_months),
    })
    setBusy(false)
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    setCerts(prev =>
      prev.map(c =>
        c.id === id
          ? {
              ...c,
              name: editDraft.name.trim(),
              description: editDraft.description.trim() || null,
              validity_months: parseMonths(editDraft.validity_months),
            }
          : c,
      ),
    )
    setEditingId(null)
    toast.success('Saved')
  }

  async function onToggleActive(c: Cert) {
    const res = await updateCertification({ certificationId: c.id, is_active: !c.is_active })
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    setCerts(prev => prev.map(x => (x.id === c.id ? { ...x, is_active: !x.is_active } : x)))
    toast.success(c.is_active ? 'Archived' : 'Restored')
  }

  async function onDelete(c: Cert) {
    const ok = await confirm({
      title: 'Delete certification',
      description: `"${c.name}" will be permanently removed. This is only allowed if it has never been granted.`,
      confirmText: 'Delete',
      destructive: true,
    })
    if (!ok) return
    const res = await deleteCertification({ certificationId: c.id })
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    setCerts(prev => prev.filter(x => x.id !== c.id))
    toast.success('Deleted')
  }

  const inputCls =
    'w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary'

  return (
    <>
      <PageHeader>
        <PageTitle>Certifications</PageTitle>
        <Button size="sm" onClick={() => setShowNew(v => !v)}>
          <Plus className="size-4" /> {showNew ? 'Cancel' : 'New certification'}
        </Button>
      </PageHeader>

      <div className="p-4 md:p-6 space-y-4">
        <p className="font-sans text-sm text-muted-foreground max-w-2xl">
          Define the certifications your space tracks (e.g. a tool sign-off). Awarding and
          revoking a certification to a member is a separate permission
          (&ldquo;Award and revoke certifications&rdquo; / Instructor) and is done from a
          member&rsquo;s row on the Members page.
        </p>

        {showNew && (
          <form onSubmit={onCreate} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <input
              autoFocus
              className={inputCls}
              placeholder="Name (e.g. Laser Cutter)"
              maxLength={200}
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
            />
            <textarea
              className={inputCls}
              placeholder="Description (optional)"
              rows={2}
              maxLength={2000}
              value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
            />
            <div>
              <input
                type="number"
                min="1"
                className={inputCls}
                placeholder="Valid for N months (blank = never expires)"
                value={draft.validity_months}
                onChange={e => setDraft({ ...draft, validity_months: e.target.value })}
              />
            </div>
            <Button type="submit" size="sm" disabled={busy}>
              Create certification
            </Button>
          </form>
        )}

        {certs.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Award />
              </EmptyMedia>
              <EmptyTitle>No certifications yet</EmptyTitle>
              <EmptyDescription>
                Create your first certification type. You can award it to members afterwards.
              </EmptyDescription>
            </EmptyHeader>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="size-4" /> Create your first certification
            </Button>
          </Empty>
        ) : (
          <div className="divide-y rounded-lg border border-border">
            {certs.map(c => (
              <div key={c.id} className="p-4">
                {editingId === c.id ? (
                  <div className="space-y-3">
                    <input
                      className={inputCls}
                      maxLength={200}
                      value={editDraft.name}
                      onChange={e => setEditDraft({ ...editDraft, name: e.target.value })}
                    />
                    <textarea
                      className={inputCls}
                      rows={2}
                      maxLength={2000}
                      placeholder="Description (optional)"
                      value={editDraft.description}
                      onChange={e => setEditDraft({ ...editDraft, description: e.target.value })}
                    />
                    <input
                      type="number"
                      min="1"
                      className={inputCls}
                      placeholder="Valid for N months (blank = never expires)"
                      value={editDraft.validity_months}
                      onChange={e => setEditDraft({ ...editDraft, validity_months: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => onSaveEdit(c.id)}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans text-sm font-semibold text-foreground">{c.name}</span>
                        {!c.is_active && <Badge variant="outline">Archived</Badge>}
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {validityLabel(c.validity_months)}
                        </span>
                      </div>
                      {c.description && (
                        <p className="font-sans text-sm text-muted-foreground mt-1">{c.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onToggleActive(c)}>
                        {c.is_active ? 'Archive' : 'Restore'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onDelete(c)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
