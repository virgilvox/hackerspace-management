'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MemberForm } from '../types'

// Top-level (NOT defined inside the render body): keeping this stable is what
// preserves input focus across keystrokes. The add and edit dialogs both render it.
function MemberFormFields({ form, setForm }: { form: MemberForm; setForm: Dispatch<SetStateAction<MemberForm>> }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="member-display-name" className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Full Name *</label>
          <input id="member-display-name" type="text" required value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" />
        </div>
        <div>
          <label htmlFor="member-email" className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Email *</label>
          <input id="member-email" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="member-phone" className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Phone</label>
          <input id="member-phone" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" />
        </div>
        <div>
          <label htmlFor="member-handle" className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Handle</label>
          <input id="member-handle" type="text" value={form.handle} placeholder="@username" onChange={e => setForm(f => ({ ...f, handle: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary transition" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="member-tier" className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Tier</label>
          <select id="member-tier" value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary">
            <option value="plus">Plus</option>
            <option value="basic">Basic</option>
            <option value="associate">Associate</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label htmlFor="member-role" className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Role</label>
          <select id="member-role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary">
            <option value="member">Member</option>
            <option value="board">Board</option>
            <option value="treasurer">Treasurer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="member-joined-at" className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Joined At</label>
          <input id="member-joined-at" type="date" value={form.joined_at?.slice(0, 10)} onChange={e => setForm(f => ({ ...f, joined_at: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary" />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.has_card_access} onChange={e => setForm(f => ({ ...f, has_card_access: e.target.checked }))}
              className="w-4 h-4 accent-primary" />
            <span className="font-sans text-sm text-foreground">Card Access</span>
          </label>
        </div>
      </div>
    </>
  )
}

interface MemberFormDialogProps {
  open: boolean
  // Drives title + submit-button copy; add and edit share one form-state shape.
  isEdit: boolean
  memberName?: string | null
  form: MemberForm
  setForm: Dispatch<SetStateAction<MemberForm>>
  loading: boolean
  error: string
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function MemberFormDialog({ open, isEdit, memberName, form, setForm, loading, error, onSubmit, onClose }: MemberFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? <>Edit {memberName}</> : 'Add Member'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <MemberFormFields form={form} setForm={setForm} />
          {error && <p className="font-mono text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" disabled={loading} onClick={onClose} className="flex-1 border border-border text-foreground font-sans text-sm py-2 rounded hover:border-primary/50 transition disabled:opacity-60">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-primary text-white font-sans text-sm py-2 rounded hover:bg-primary/90 transition disabled:opacity-60">
              {isEdit ? (loading ? 'Saving...' : 'Save Changes') : (loading ? 'Adding...' : 'Add Member')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
