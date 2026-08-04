'use client'

import { useState } from 'react'
import { createSecret } from '@/lib/actions'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Secret } from '../types'

// ─── Add Secret Modal ──────────────────────────────────────────────────────────
export function AddSecretModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (s: Secret) => void
}) {
  const [title, setTitle] = useState('')
  const [area, setArea] = useState('')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !value.trim()) return
    setSaving(true)
    // Use the createSecret server action, which AES-encrypts the value at rest
    // (and applies the admin/board authz gate + Zod validation + activity log).
    // The previous direct browser insert wrote the value in PLAINTEXT — despite
    // the "Stored encrypted at rest" promise — since the encryption key is
    // server-only and never reaches the browser.
    const result = await createSecret({
      title: title.trim(),
      value: value.trim(),
      area: area.trim() || undefined,
    })
    setSaving(false)
    if (result.error) { toast.error(result.error); return }
    toast.success('Secret saved')
    onSaved(result.data as Secret)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-sans text-sm font-semibold text-foreground">Add Secret / Credential</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Label *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition"
              placeholder="e.g. WiFi Password"
              required
            />
          </div>
          <div>
            <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Area</label>
            <input
              value={area}
              onChange={e => setArea(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition"
              placeholder="e.g. Network"
            />
          </div>
          <div>
            <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Secret Value *</label>
            <textarea
              value={value}
              onChange={e => setValue(e.target.value)}
              rows={3}
              className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary transition"
              placeholder="Stored encrypted at rest"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="border border-border bg-card text-foreground font-sans text-sm px-4 py-2 rounded hover:border-primary/50 transition">Cancel</button>
            <button type="submit" disabled={saving || !title.trim() || !value.trim()} className="bg-primary text-white font-sans text-sm px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Secret'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
