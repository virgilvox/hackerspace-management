'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Lock, Pin, Eye, EyeOff, Pencil, Trash2, ChevronDown, Users2, FileText, Copy, Check } from 'lucide-react'
import { SafeMarkdown } from '@/components/safe-markdown'
import { createKbEntry, updateKbEntry, deleteKbEntry } from '@/lib/actions'
import { revealSecret, deleteSecret } from '@/lib/actions/secrets'
import { OpsAclEditor } from '@/components/ops/ops-acl-editor'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Tables, TablesInsert } from '@/types/database'
import { PageTitle } from '@/components/ui/page-title'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirm } from '@/components/ui/confirm'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from '@/components/ui/empty'

type KbEntry = Tables<'knowledge_base'>
type AreaLead = Tables<'area_leads'>
type Secret = Tables<'secrets'>

interface Props {
  member: Tables<'space_members'>
  spaceId: string
  kbEntries: KbEntry[]
  areaLeads: AreaLead[]
  secrets: Secret[]
  canSeeSecrets: boolean
  canManageAcl?: boolean
  aclRoleOptions?: { value: string; label: string }[]
  aclByEntity?: Record<string, string[]>
}

type Tab = 'kb' | 'processes' | 'secrets' | 'area-leads'

const TABS: { id: Tab; label: string }[] = [
  { id: 'kb', label: 'Knowledge Base' },
  { id: 'processes', label: 'Processes' },
  { id: 'secrets', label: 'Secrets & Credentials' },
  { id: 'area-leads', label: 'Area Leads' },
]

const VISIBILITY_LABELS: Record<string, string> = {
  all_members: 'All Members',
  board: 'Board',
  admin_only: 'Admin Only',
}

const VISIBILITY_COLORS: Record<string, string> = {
  admin_only: 'text-red-600 bg-red-50 border-red-200',
  board: 'text-amber-600 bg-amber-50 border-amber-200',
  all_members: 'text-primary bg-primary/5 border-primary/20',
}

// ─── KB Entry Modal ────────────────────────────────────────────────────────────
function KbModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: KbEntry | null
  onClose: () => void
  onSaved: (entry: KbEntry) => void
}) {
  const isEdit = !!entry
  const [title, setTitle] = useState(entry?.title ?? '')
  const [content, setContent] = useState(entry?.content ?? '')
  const [area, setArea] = useState(entry?.area ?? '')
  const [visibility, setVisibility] = useState(entry?.visibility ?? 'all_members')
  const [isPinned, setIsPinned] = useState(entry?.is_pinned ?? false)
  const [isProcess, setIsProcess] = useState(entry?.tags?.includes('process') ?? false)
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    const tags = isProcess ? ['process'] : []
    let result
    if (isEdit) {
      result = await updateKbEntry(entry.id, { title, content, area, visibility, is_pinned: isPinned, tags })
    } else {
      result = await createKbEntry({ title, content, area, visibility, is_pinned: isPinned, tags })
    }
    setSaving(false)
    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }
    toast.success(isEdit ? 'Entry updated' : 'Entry created')
    if (!isEdit && 'data' in result && result.data) onSaved(result.data as KbEntry)
    else if (isEdit) onSaved({ ...entry, title, content, area, visibility, is_pinned: isPinned, tags })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-sans text-sm font-semibold text-foreground">{isEdit ? 'Edit Entry' : 'New KB Entry'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition"
              placeholder="e.g. How to open the space"
              required
            />
          </div>
          <div>
            <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Content *</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition resize-y"
              placeholder="Write the full content here..."
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Area</label>
              <input
                value={area}
                onChange={e => setArea(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition"
                placeholder="e.g. Woodshop, Kitchen"
              />
            </div>
            <div>
              <label className="font-sans text-xs font-medium text-muted-foreground block mb-1.5">Visibility</label>
              <select
                value={visibility}
                onChange={e => setVisibility(e.target.value)}
                className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition"
              >
                <option value="all_members">All Members</option>
                <option value="board">Board Only</option>
                <option value="admin_only">Admin Only</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={e => setIsPinned(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <span className="font-sans text-sm text-foreground">Pin (critical / always visible)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isProcess}
                onChange={e => setIsProcess(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-primary"
              />
              <span className="font-sans text-sm text-foreground">Tag as Process</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="border border-border bg-card text-foreground font-sans text-sm px-4 py-2 rounded hover:border-primary/50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !content.trim()}
              className="bg-primary text-white font-sans text-sm px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Entry'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Secret Modal ──────────────────────────────────────────────────────────
function AddSecretModal({
  onClose,
  onSaved,
  spaceId,
}: {
  onClose: () => void
  onSaved: (s: Secret) => void
  spaceId: string
}) {
  const [title, setTitle] = useState('')
  const [area, setArea] = useState('')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !value.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('secrets').insert({
      space_id: spaceId,
      title: title.trim(),
      label: title.trim(),
      area: area.trim() || null,
      value: value.trim(),
    }).select('id, title, area, created_at').single()
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Secret saved')
    onSaved(data as Secret)
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

// ─── Area Lead Modal ───────────────────────────────────────────────────────────
function AreaLeadModal({
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
      }).eq('id', lead.id).select('*').single()
    } else {
      result = await supabase.from('area_leads').insert({
        space_id: spaceId,
        area_name: areaName.trim(),
        lead_handle: memberName.trim(),
        description: contactInfo.trim() || null,
      }).select('*').single()
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

// ─── Secret Row (reveal on click) ─────────────────────────────────────────────
function SecretRow({ secret, onDelete, canManageAcl, aclRoleOptions, aclInitial }: {
  secret: Secret
  onDelete: (id: string) => void
  canManageAcl?: boolean
  aclRoleOptions?: { value: string; label: string }[]
  aclInitial?: string[]
}) {
  const confirm = useConfirm()
  const [revealed, setRevealed] = useState(false)
  const [value, setValue] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAcl, setShowAcl] = useState(false)
  const [copied, setCopied] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function hide() {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
    setRevealed(false)
    setValue(null)
    setCopied(false)
  }

  async function reveal() {
    if (revealed) { hide(); return }
    setLoading(true)
    const result = await revealSecret(secret.id)
    setLoading(false)
    if (result.error) { toast.error(result.error); return }
    setValue(result.value ?? '')
    setRevealed(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(hide, 30000)
  }

  async function copy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  // Re-hide a revealed secret when the window loses focus (screen share /
  // shoulder surfing), and drop the plaintext + timer on unmount.
  useEffect(() => {
    const onBlur = () => hide()
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('blur', onBlur)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  async function handleDelete() {
    if (!(await confirm({ title: 'Delete secret', description: `"${secret.title}" cannot be undone.`, confirmText: 'Delete', destructive: true }))) return
    const result = await deleteSecret(secret.id)
    if (result.error) { toast.error(result.error); return }
    toast.success('Secret deleted')
    onDelete(secret.id)
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
          <Lock className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-sm font-medium text-foreground">{secret.title}</p>
          {secret.area && <p className="font-mono text-[10px] text-muted-foreground">{secret.area}</p>}
          {revealed && value && (
            <div className="flex items-start gap-1.5 mt-1">
              <p className="flex-1 font-mono text-xs text-foreground bg-muted px-2 py-1 rounded break-all">{value}</p>
              <button
                type="button"
                onClick={copy}
                aria-label="Copy secret to clipboard"
                className="flex items-center gap-1 font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-primary hover:text-primary transition flex-shrink-0"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {canManageAcl && (
            <button
              onClick={() => setShowAcl(v => !v)}
              className="flex items-center font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-primary hover:text-primary transition"
              title="Who can access this secret"
            >
              Access
            </button>
          )}
          <button
            onClick={reveal}
            disabled={loading}
            className="flex items-center gap-1 font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-primary hover:text-primary transition"
            title={revealed ? 'Hide' : 'Reveal'}
          >
            {loading ? '...' : revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {revealed ? 'Hide' : 'Reveal'}
          </button>
          <button onClick={handleDelete} className="flex items-center justify-center min-w-[44px] min-h-[44px] -my-2 text-muted-foreground hover:text-red-500 transition" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {showAcl && canManageAcl && (
        <OpsAclEditor
          entityType="secret"
          entityId={secret.id}
          options={aclRoleOptions ?? []}
          initial={aclInitial ?? []}
        />
      )}
    </div>
  )
}

// ─── KB Entry Row ──────────────────────────────────────────────────────────────
function KbEntryRow({
  entry,
  onEdit,
  onDelete,
  canManageAcl,
  aclRoleOptions,
  aclByEntity,
}: {
  entry: KbEntry
  onEdit: (e: KbEntry) => void
  onDelete: (id: string) => void
  canManageAcl?: boolean
  aclRoleOptions?: { value: string; label: string }[]
  aclByEntity?: Record<string, string[]>
}) {
  const confirm = useConfirm()
  const [viewing, setViewing] = useState(false)
  const aclEntityType: 'kb' | 'process' = entry.tags?.includes('process') ? 'process' : 'kb'
  const aclInitial = aclByEntity?.[`${aclEntityType}:${entry.id}`] ?? []

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!(await confirm({ title: 'Delete entry', description: `"${entry.title}" will be permanently removed.`, confirmText: 'Delete', destructive: true }))) return
    const result = await deleteKbEntry(entry.id)
    if ('error' in result && result.error) { toast.error(result.error); return }
    toast.success('Entry deleted')
    onDelete(entry.id)
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation()
    onEdit(entry)
  }

  return (
    <>
      <div
        onClick={() => setViewing(true)}
        className={`flex items-start gap-3 px-4 py-4 hover:bg-muted/20 transition group border-l-4 cursor-pointer ${
          entry.is_pinned
            ? entry.visibility === 'admin_only' ? 'border-l-red-400' : entry.visibility === 'board' ? 'border-l-amber-400' : 'border-l-primary'
            : 'border-l-transparent'
        }`}
      >
        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0 text-base">
          {entry.icon || (
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-sans text-sm font-medium text-foreground">{entry.title}</p>
            {entry.is_pinned && <Pin className="w-3 h-3 text-primary flex-shrink-0" />}
          </div>
          <p className="font-mono text-[10px] text-muted-foreground line-clamp-2">{entry.content?.slice(0, 120)}</p>
          <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
            {entry.area && <span>{entry.area} · </span>}
            updated {new Date(entry.updated_at).toLocaleDateString()} by {entry.updated_by_name}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`font-mono text-[10px] px-2 py-0.5 rounded border whitespace-nowrap ${VISIBILITY_COLORS[entry.visibility] ?? 'text-muted-foreground bg-muted border-border'}`}>
            {VISIBILITY_LABELS[entry.visibility] ?? entry.visibility}
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
            <button onClick={handleEdit} className="flex items-center justify-center min-w-[44px] min-h-[44px] -my-2 text-muted-foreground hover:text-primary transition" title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleDelete} className="flex items-center justify-center min-w-[44px] min-h-[44px] -my-2 text-muted-foreground hover:text-red-500 transition" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={viewing} onOpenChange={(o) => { if (!o) setViewing(false) }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start gap-3 pr-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {entry.icon && <span className="text-lg">{entry.icon}</span>}
                  <DialogTitle className="font-sans text-lg font-semibold text-foreground">{entry.title}</DialogTitle>
                  {entry.is_pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
                </div>
                <p className="font-mono text-[10px] text-muted-foreground mt-1">
                  {entry.area && <span>{entry.area} · </span>}
                  {VISIBILITY_LABELS[entry.visibility] ?? entry.visibility}
                  {' · '}
                  updated {new Date(entry.updated_at).toLocaleDateString()} by {entry.updated_by_name ?? 'unknown'}
                </p>
              </div>
              <button onClick={() => onEdit(entry)} className="text-muted-foreground hover:text-primary transition p-1" title="Edit">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          </DialogHeader>
          <div>
            <SafeMarkdown>{entry.content ?? ''}</SafeMarkdown>
            {canManageAcl && (
              <OpsAclEditor
                entityType={aclEntityType}
                entityId={entry.id}
                options={aclRoleOptions ?? []}
                initial={aclInitial}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function OpsClient({ member, spaceId, kbEntries: initial, areaLeads: initialLeads, secrets: initialSecrets, canSeeSecrets, canManageAcl = false, aclRoleOptions = [], aclByEntity = {} }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('kb')
  const [search, setSearch] = useState('')
  const [kbEntries, setKbEntries] = useState<KbEntry[]>(initial)
  const [areaLeads, setAreaLeads] = useState<AreaLead[]>(initialLeads)
  const [secrets, setSecrets] = useState<Secret[]>(initialSecrets)

  // Modals
  const [showKbModal, setShowKbModal] = useState(false)
  const [editingKb, setEditingKb] = useState<KbEntry | null>(null)
  const [showSecretModal, setShowSecretModal] = useState(false)
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [editingLead, setEditingLead] = useState<AreaLead | null>(null)

  // Every predicate is null-safe: title/content/area/handle can all be null
  // in the database. These memos recompute on every keystroke of the shared
  // `search` state regardless of the active tab, so an unguarded
  // .toLowerCase() on a null field throws and takes the whole page down
  // (this is why KB search appeared broken: filteredLeads referenced a
  // non-existent `member_name` column).
  const has = (v: string | null | undefined, q: string) => !!v && v.toLowerCase().includes(q)

  const filteredKb = useMemo(() => {
    const q = search.toLowerCase()
    return kbEntries.filter(e =>
      !e.tags?.includes('process') &&
      (!q || has(e.title, q) || has(e.content, q) || has(e.area, q)),
    )
  }, [kbEntries, search])

  const filteredProcesses = useMemo(() => {
    const q = search.toLowerCase()
    return kbEntries.filter(e =>
      e.tags?.includes('process') &&
      (!q || has(e.title, q) || has(e.content, q) || has(e.area, q)),
    )
  }, [kbEntries, search])

  const filteredSecrets = useMemo(() => {
    const q = search.toLowerCase()
    return secrets.filter(s => !q || has(s.title, q) || has(s.label, q) || has(s.area, q))
  }, [secrets, search])

  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase()
    return areaLeads.filter(l => !q || has(l.area_name, q) || has(l.lead_handle, q))
  }, [areaLeads, search])

  async function deleteLeadFn(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('area_leads').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setAreaLeads(prev => prev.filter(l => l.id !== id))
    toast.success('Area lead removed')
  }

  const pinnedKb = filteredKb.filter(e => e.is_pinned)
  const unpinnedKb = filteredKb.filter(e => !e.is_pinned)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
        <PageTitle>Ops & Facilities</PageTitle>
        <div className="flex items-center gap-2">
          {(activeTab === 'kb' || activeTab === 'processes') && (
            <button
              onClick={() => { setEditingKb(null); setShowKbModal(true) }}
              className="flex items-center gap-1.5 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add Entry
            </button>
          )}
          {activeTab === 'secrets' && canSeeSecrets && (
            <button
              onClick={() => setShowSecretModal(true)}
              className="flex items-center gap-1.5 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add Secret
            </button>
          )}
          {activeTab === 'area-leads' && (
            <button
              onClick={() => { setEditingLead(null); setShowLeadModal(true) }}
              className="flex items-center gap-1.5 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition"
            >
              <Users2 className="w-3.5 h-3.5" /> Add Area Lead
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border-b border-border px-4 md:px-6 flex gap-4 md:gap-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearch('') }}
            className={`font-sans text-sm py-3 border-b-2 transition whitespace-nowrap ${
              activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.id === 'secrets' && !canSeeSecrets && <Lock className="w-3 h-3 inline ml-1" />}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6 max-w-5xl">
        {/* Search */}
        {(activeTab === 'kb' || activeTab === 'processes' || activeTab === 'secrets') && (
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={activeTab === 'kb' ? 'Search knowledge base...' : activeTab === 'processes' ? 'Search processes...' : 'Search credentials...'}
              className="w-full bg-card border border-border rounded pl-9 pr-4 py-2.5 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition"
            />
          </div>
        )}

        {/* ─── KB Tab ─── */}
        {activeTab === 'kb' && (
          <div className="space-y-6">
            {pinnedKb.length > 0 && (
              <div>
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Pinned / Critical</p>
                <div className="bg-card rounded border border-border divide-y divide-border">
                  {pinnedKb.map(entry => (
                    <KbEntryRow
                      key={entry.id}
                      entry={entry}
                      onEdit={e => { setEditingKb(e); setShowKbModal(true) }}
                      onDelete={id => setKbEntries(prev => prev.filter(e => e.id !== id))}
                      canManageAcl={canManageAcl}
                      aclRoleOptions={aclRoleOptions}
                      aclByEntity={aclByEntity}
                    />
                  ))}
                </div>
              </div>
            )}
            {unpinnedKb.length > 0 && (
              <div>
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">All Entries</p>
                <div className="bg-card rounded border border-border divide-y divide-border">
                  {unpinnedKb.map(entry => (
                    <KbEntryRow
                      key={entry.id}
                      entry={entry}
                      onEdit={e => { setEditingKb(e); setShowKbModal(true) }}
                      onDelete={id => setKbEntries(prev => prev.filter(e => e.id !== id))}
                      canManageAcl={canManageAcl}
                      aclRoleOptions={aclRoleOptions}
                      aclByEntity={aclByEntity}
                    />
                  ))}
                </div>
              </div>
            )}
            {filteredKb.length === 0 && (
              <Empty className="bg-card border border-dashed border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">{search ? <Search /> : <FileText />}</EmptyMedia>
                  <EmptyTitle>
                    {search ? `No results for "${search}"` : 'No knowledge base entries yet'}
                  </EmptyTitle>
                </EmptyHeader>
                {!search && (
                  <EmptyContent>
                    <button
                      onClick={() => { setEditingKb(null); setShowKbModal(true) }}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      + Add first entry
                    </button>
                  </EmptyContent>
                )}
              </Empty>
            )}
          </div>
        )}

        {/* ─── Processes Tab ─── */}
        {activeTab === 'processes' && (
          <div className="space-y-4">
            {filteredProcesses.length > 0 ? (
              <div className="bg-card rounded border border-border divide-y divide-border">
                {filteredProcesses.map(entry => (
                  <KbEntryRow
                    key={entry.id}
                    entry={entry}
                    onEdit={e => { setEditingKb(e); setShowKbModal(true) }}
                    onDelete={id => setKbEntries(prev => prev.filter(e => e.id !== id))}
                    canManageAcl={canManageAcl}
                    aclRoleOptions={aclRoleOptions}
                    aclByEntity={aclByEntity}
                  />
                ))}
              </div>
            ) : (
              <Empty className="bg-card border border-dashed border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">{search ? <Search /> : <FileText />}</EmptyMedia>
                  <EmptyTitle>
                    {search ? `No results for "${search}"` : 'No process entries yet'}
                  </EmptyTitle>
                </EmptyHeader>
                {!search && (
                  <EmptyContent>
                    <button
                      onClick={() => { setEditingKb(null); setShowKbModal(true) }}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      + Add first process
                    </button>
                  </EmptyContent>
                )}
              </Empty>
            )}
          </div>
        )}

        {/* ─── Secrets Tab ─── */}
        {activeTab === 'secrets' && (
          <div>
            {!canSeeSecrets ? (
              <Empty className="bg-card border border-dashed border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Lock /></EmptyMedia>
                  <EmptyTitle>Admin or board access required to view secrets</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : filteredSecrets.length > 0 ? (
              <div className="bg-card rounded border border-border divide-y divide-border">
                {filteredSecrets.map(s => (
                  <SecretRow
                    key={s.id}
                    secret={s}
                    onDelete={id => setSecrets(prev => prev.filter(x => x.id !== id))}
                    canManageAcl={canManageAcl}
                    aclRoleOptions={aclRoleOptions}
                    aclInitial={aclByEntity[`secret:${s.id}`] ?? []}
                  />
                ))}
              </div>
            ) : (
              <Empty className="bg-card border border-dashed border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Lock /></EmptyMedia>
                  <EmptyTitle>
                    {search ? `No results for "${search}"` : 'No secrets stored yet'}
                  </EmptyTitle>
                </EmptyHeader>
                {!search && (
                  <EmptyContent>
                    <button
                      onClick={() => setShowSecretModal(true)}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      + Add first secret
                    </button>
                  </EmptyContent>
                )}
              </Empty>
            )}
          </div>
        )}

        {/* ─── Area Leads Tab ─── */}
        {activeTab === 'area-leads' && (
          <div>
            {filteredLeads.length > 0 ? (
              <div className="bg-card rounded border border-border divide-y divide-border">
                {filteredLeads.map(lead => (
                  <div key={lead.id} className="flex items-center gap-3 px-4 py-4 group hover:bg-muted/20 transition">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-mono font-bold text-primary flex-shrink-0">
                      {lead.area_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-sm font-medium text-foreground">{lead.area_name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{lead.lead_handle}</p>
                      {lead.description && (
                        <p className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">{lead.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => { setEditingLead(lead); setShowLeadModal(true) }}
                        className="text-muted-foreground hover:text-primary transition p-1"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteLeadFn(lead.id)}
                        className="text-muted-foreground hover:text-red-500 transition p-1"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty className="bg-card border border-dashed border-border">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Users2 /></EmptyMedia>
                  <EmptyTitle>No area leads assigned yet</EmptyTitle>
                </EmptyHeader>
                <EmptyContent>
                  <button
                    onClick={() => { setEditingLead(null); setShowLeadModal(true) }}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    + Assign first area lead
                  </button>
                </EmptyContent>
              </Empty>
            )}
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      {showKbModal && (
        <KbModal
          entry={editingKb}
          onClose={() => { setShowKbModal(false); setEditingKb(null) }}
          onSaved={saved => {
            setKbEntries(prev =>
              editingKb
                ? prev.map(e => e.id === saved.id ? saved : e)
                : [saved, ...prev],
            )
          }}
        />
      )}
      {showSecretModal && (
        <AddSecretModal
          onClose={() => setShowSecretModal(false)}
          onSaved={s => setSecrets(prev => [s, ...prev])}
          spaceId={spaceId}
        />
      )}
      {showLeadModal && (
        <AreaLeadModal
          lead={editingLead}
          onClose={() => { setShowLeadModal(false); setEditingLead(null) }}
          onSaved={saved => {
            setAreaLeads(prev =>
              editingLead
                ? prev.map(l => l.id === saved.id ? saved : l)
                : [...prev, saved].sort((a, b) => a.area_name.localeCompare(b.area_name)),
            )
          }}
          spaceId={spaceId}
        />
      )}
    </div>
  )
}
