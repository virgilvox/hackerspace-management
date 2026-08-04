'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { TablesInsert, TablesUpdate } from '@/types/database'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AreaLead } from '../types'

// ─── Area Lead Modal ───────────────────────────────────────────────────────────
export function AreaLeadModal({
  lead,
  onClose,
  onSaved,
  spaceId,
}: {
  lead: AreaLead | null
  onClose: () => void
  onSaved: (l: AreaLead) => void
  spaceId: string
}) {
  const isEdit = !!lead
  const [areaName, setAreaName] = useState(lead?.area_name ?? '')
  const [memberName, setMemberName] = useState(lead?.lead_handle ?? '')
  const [contactInfo, setContactInfo] = useState(lead?.description ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!areaName.trim() || !memberName.trim()) return
    setSaving(true)
    const supabase = createClient()
    let result
    if (isEdit) {
      result = await supabase.from('area_leads').update({
        area_name: areaName.trim(),
        lead_handle: memberName.trim(),
        description: contactInfo.trim() || null,
        // TODO(types): remove `as never` after regenerating types/database.ts (missing FK relationship metadata)
      } satisfies TablesUpdate<'area_leads'> as never).eq('id', lead.id).select('*').single()
    } else {
      result = await supabase.from('area_leads').insert({
        space_id: spaceId,
        area_name: areaName.trim(),
        lead_handle: memberName.trim(),
        description: contactInfo.trim() || null,
        // TODO(types): remove `as never` after regenerating types/database.ts (missing FK relationship metadata)
      } satisfies TablesInsert<'area_leads'> as never).select('*').single()
    }
    setSaving(false)
    if (result.error) { toast.error(result.error.message); return }
    toast.success(isEdit ? 'Area lead updated' : 'Area lead added')
    onSaved(result.data as AreaLead)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-sans text-sm font-semibold text-foreground">{isEdit ? 'Edit Area Lead' : 'Add Area Lead'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Area Name *</label>
            <input value={areaName} onChange={e => setAreaName(e.target.value)} className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" placeholder="e.g. Woodshop" required />
          </div>
          <div>
            <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Member Name *</label>
            <input value={memberName} onChange={e => setMemberName(e.target.value)} className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" placeholder="e.g. Alice Smith" required />
          </div>
          <div>
            <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Contact Info</label>
            <input value={contactInfo} onChange={e => setContactInfo(e.target.value)} className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" placeholder="e.g. alice@example.com or Slack @alice" />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="border border-border bg-card text-foreground font-sans text-sm px-4 py-2 rounded hover:border-primary/50 transition">Cancel</button>
            <button type="submit" disabled={saving || !areaName.trim() || !memberName.trim()} className="bg-primary text-white font-sans text-sm px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50">
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Lead'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
