'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm'
import {
  listMemberCards,
  addMemberCard,
  updateMemberCard,
  deleteMemberCard,
} from '@/lib/actions'

type Card = {
  id: string
  card_uid: string
  card_type: string
  label: string | null
  is_active: boolean
  created_at: string
}

export function MemberCardsDialog({
  member,
  onClose,
}: {
  member: { id: string; display_name: string | null } | null
  onClose: () => void
}) {
  const confirm = useConfirm()
  const open = !!member
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<Card[]>([])
  const [uid, setUid] = useState('')
  const [type, setType] = useState<'rfid' | 'nfc'>('rfid')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (memberId: string) => {
    setLoading(true)
    const res = await listMemberCards({ memberId })
    setLoading(false)
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    setCards(((res as { data: Card[] }).data) ?? [])
  }, [])

  useEffect(() => {
    if (member) {
      setUid('')
      setType('rfid')
      setLabel('')
      load(member.id)
    }
  }, [member, load])

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!member) return
    if (!uid.trim()) {
      toast.error('Card UID is required')
      return
    }
    setBusy(true)
    const res = await addMemberCard({
      memberId: member.id,
      card_uid: uid.trim(),
      card_type: type,
      label: label.trim() || null,
    })
    setBusy(false)
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    toast.success('Card added')
    setUid('')
    setLabel('')
    load(member.id)
  }

  async function onToggle(c: Card) {
    const res = await updateMemberCard({ cardId: c.id, is_active: !c.is_active })
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    setCards(prev => prev.map(x => (x.id === c.id ? { ...x, is_active: !x.is_active } : x)))
  }

  async function onDelete(c: Card) {
    const ok = await confirm({
      title: 'Delete card',
      description: 'This removes the card association. If a controller is connected, revoke it there too.',
      confirmText: 'Delete',
      destructive: true,
    })
    if (!ok || !member) return
    const res = await deleteMemberCard({ cardId: c.id })
    if ('error' in res && res.error) {
      toast.error(res.error)
      return
    }
    setCards(prev => prev.filter(x => x.id !== c.id))
    toast.success('Deleted')
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Access cards — {member?.display_name ?? 'Member'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onAdd} className="space-y-2 border border-border rounded p-3 bg-background">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Add a card</p>
          <input
            type="text"
            value={uid}
            maxLength={200}
            onChange={e => setUid(e.target.value)}
            placeholder="Card UID (the number from the card/reader)"
            className="w-full bg-background border border-border text-foreground font-mono text-sm rounded px-2 py-2 focus:outline-none focus:border-primary"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={type}
              onChange={e => setType(e.target.value as 'rfid' | 'nfc')}
              className="bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-2 focus:outline-none focus:border-primary"
            >
              <option value="rfid">RFID</option>
              <option value="nfc">NFC</option>
            </select>
            <input
              type="text"
              value={label}
              maxLength={120}
              onChange={e => setLabel(e.target.value)}
              placeholder="Label (optional)"
              className="bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-2 focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-white text-xs font-sans px-3 py-2 rounded hover:bg-primary/90 transition disabled:opacity-60"
          >
            Add card
          </button>
        </form>

        <div className="mt-2">
          {loading ? (
            <p className="font-mono text-xs text-muted-foreground py-4">Loading…</p>
          ) : cards.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground py-4">No cards registered.</p>
          ) : (
            <ul className="divide-y divide-border">
              {cards.map(c => (
                <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <code className="font-mono text-sm text-foreground">{c.card_uid}</code>
                    <span className="font-mono text-[10px] text-muted-foreground ml-2 uppercase">{c.card_type}</span>
                    {c.label && <span className="font-sans text-xs text-muted-foreground ml-2">{c.label}</span>}
                    {!c.is_active && <span className="font-mono text-[10px] text-red-500 ml-2">inactive</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => onToggle(c)} className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-primary hover:text-primary transition">
                      {c.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => onDelete(c)} className="font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-red-500 hover:text-red-500 transition">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
