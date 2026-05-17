'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Hammer, Plus } from 'lucide-react'
import { PageHeader, PageTitle } from '@/components/ui/page-title'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { useConfirm } from '@/components/ui/confirm'
import { createEquipment, updateEquipment, deleteEquipment } from '@/lib/actions'
import { EQUIPMENT_STATUS_LABEL } from '@/lib/equipment-logic'

type Equip = {
  id: string
  name: string
  description: string | null
  location: string | null
  status: string
  required_certification_id: string | null
  asset_tag: string | null
  is_active: boolean
}
type Cert = { id: string; name: string }

const inputCls =
  'w-full bg-background border border-border text-foreground font-sans text-sm rounded px-3 py-2 focus:outline-none focus:border-primary'

function emptyDraft() {
  return { name: '', description: '', location: '', status: 'available', required_certification_id: '', asset_tag: '' }
}

export function EquipmentManageClient({ initial, certs }: { initial: Equip[]; certs: Cert[] }) {
  const confirm = useConfirm()
  const [items, setItems] = useState<Equip[]>(initial)
  const [showNew, setShowNew] = useState(false)
  const [draft, setDraft] = useState(emptyDraft())
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState(emptyDraft())
  const [busy, setBusy] = useState(false)

  const certName = (id: string | null) => (id ? certs.find(c => c.id === id)?.name ?? null : null)

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) return toast.error('Name is required')
    setBusy(true)
    const res = await createEquipment({
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      location: draft.location.trim() || null,
      status: draft.status,
      required_certification_id: draft.required_certification_id || null,
      asset_tag: draft.asset_tag.trim() || null,
    })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    const id = (res as { data: { id: string } }).data.id
    setItems(prev => [
      {
        id,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        location: draft.location.trim() || null,
        status: draft.status,
        required_certification_id: draft.required_certification_id || null,
        asset_tag: draft.asset_tag.trim() || null,
        is_active: true,
      },
      ...prev,
    ])
    setDraft(emptyDraft())
    setShowNew(false)
    toast.success('Equipment added')
  }

  function startEdit(it: Equip) {
    setEditId(it.id)
    setEditDraft({
      name: it.name,
      description: it.description ?? '',
      location: it.location ?? '',
      status: it.status,
      required_certification_id: it.required_certification_id ?? '',
      asset_tag: it.asset_tag ?? '',
    })
  }

  async function onSaveEdit(id: string) {
    if (!editDraft.name.trim()) return toast.error('Name is required')
    setBusy(true)
    const res = await updateEquipment({
      equipmentId: id,
      name: editDraft.name.trim(),
      description: editDraft.description.trim() || null,
      location: editDraft.location.trim() || null,
      status: editDraft.status,
      required_certification_id: editDraft.required_certification_id || null,
      asset_tag: editDraft.asset_tag.trim() || null,
    })
    setBusy(false)
    if ('error' in res && res.error) return toast.error(res.error)
    setItems(prev =>
      prev.map(x =>
        x.id === id
          ? {
              ...x,
              name: editDraft.name.trim(),
              description: editDraft.description.trim() || null,
              location: editDraft.location.trim() || null,
              status: editDraft.status,
              required_certification_id: editDraft.required_certification_id || null,
              asset_tag: editDraft.asset_tag.trim() || null,
            }
          : x,
      ),
    )
    setEditId(null)
    toast.success('Saved')
  }

  async function onToggleActive(it: Equip) {
    const res = await updateEquipment({ equipmentId: it.id, is_active: !it.is_active })
    if ('error' in res && res.error) return toast.error(res.error)
    setItems(prev => prev.map(x => (x.id === it.id ? { ...x, is_active: !x.is_active } : x)))
    toast.success(it.is_active ? 'Archived' : 'Restored')
  }

  async function onDelete(it: Equip) {
    const ok = await confirm({
      title: 'Delete equipment',
      description: `"${it.name}" will be removed. Only allowed if it has no reservations.`,
      confirmText: 'Delete',
      destructive: true,
    })
    if (!ok) return
    const res = await deleteEquipment({ equipmentId: it.id })
    if ('error' in res && res.error) return toast.error(res.error)
    setItems(prev => prev.filter(x => x.id !== it.id))
    toast.success('Deleted')
  }

  return (
    <>
      <PageHeader>
        <PageTitle>Manage equipment</PageTitle>
        <Button size="sm" onClick={() => setShowNew(v => !v)}>
          <Plus className="size-4" /> {showNew ? 'Cancel' : 'New equipment'}
        </Button>
      </PageHeader>

      <div className="p-4 md:p-6 space-y-4">
        {showNew && (
          <form onSubmit={onCreate} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <input autoFocus className={inputCls} placeholder="Name (e.g. Laser Cutter #1)" maxLength={200}
              value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            <textarea className={inputCls} placeholder="Description (optional)" rows={2} maxLength={5000}
              value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className={inputCls} placeholder="Location (optional)"
                value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} />
              <input className={inputCls} placeholder="Asset tag (optional)"
                value={draft.asset_tag} onChange={e => setDraft({ ...draft, asset_tag: e.target.value })} />
              <select className={inputCls} value={draft.status}
                onChange={e => setDraft({ ...draft, status: e.target.value })}>
                <option value="available">Available</option>
                <option value="maintenance">Under maintenance</option>
                <option value="retired">Retired</option>
              </select>
              <select className={inputCls} value={draft.required_certification_id}
                onChange={e => setDraft({ ...draft, required_certification_id: e.target.value })}>
                <option value="">No required certification</option>
                {certs.map(c => <option key={c.id} value={c.id}>Requires: {c.name}</option>)}
              </select>
            </div>
            <Button type="submit" size="sm" disabled={busy}>Add equipment</Button>
          </form>
        )}

        {items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Hammer /></EmptyMedia>
              <EmptyTitle>No equipment yet</EmptyTitle>
              <EmptyDescription>Add tools and equipment members can reserve.</EmptyDescription>
            </EmptyHeader>
            <Button onClick={() => setShowNew(true)}><Plus className="size-4" /> Add your first item</Button>
          </Empty>
        ) : (
          <div className="divide-y rounded-lg border border-border">
            {items.map(it => (
              <div key={it.id} className="p-4">
                {editId === it.id ? (
                  <div className="space-y-3">
                    <input className={inputCls} maxLength={200} value={editDraft.name}
                      onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} />
                    <textarea className={inputCls} rows={2} maxLength={5000} placeholder="Description"
                      value={editDraft.description} onChange={e => setEditDraft({ ...editDraft, description: e.target.value })} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input className={inputCls} placeholder="Location"
                        value={editDraft.location} onChange={e => setEditDraft({ ...editDraft, location: e.target.value })} />
                      <input className={inputCls} placeholder="Asset tag"
                        value={editDraft.asset_tag} onChange={e => setEditDraft({ ...editDraft, asset_tag: e.target.value })} />
                      <select className={inputCls} value={editDraft.status}
                        onChange={e => setEditDraft({ ...editDraft, status: e.target.value })}>
                        <option value="available">Available</option>
                        <option value="maintenance">Under maintenance</option>
                        <option value="retired">Retired</option>
                      </select>
                      <select className={inputCls} value={editDraft.required_certification_id}
                        onChange={e => setEditDraft({ ...editDraft, required_certification_id: e.target.value })}>
                        <option value="">No required certification</option>
                        {certs.map(c => <option key={c.id} value={c.id}>Requires: {c.name}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => onSaveEdit(it.id)}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans text-sm font-semibold text-foreground">{it.name}</span>
                        {!it.is_active && <Badge variant="outline">Archived</Badge>}
                        <span className={`font-mono text-[10px] ${it.status === 'available' ? 'text-primary' : 'text-amber-600'}`}>
                          {EQUIPMENT_STATUS_LABEL[it.status] ?? it.status}
                        </span>
                        {certName(it.required_certification_id) && (
                          <span className="font-mono text-[10px] text-muted-foreground">requires {certName(it.required_certification_id)}</span>
                        )}
                      </div>
                      {it.description && <p className="font-sans text-sm text-muted-foreground mt-1">{it.description}</p>}
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        {it.location ? `${it.location}` : 'no location'}{it.asset_tag ? ` · tag ${it.asset_tag}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => startEdit(it)}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => onToggleActive(it)}>{it.is_active ? 'Archive' : 'Restore'}</Button>
                      <Button size="sm" variant="outline" onClick={() => onDelete(it)}>Delete</Button>
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
