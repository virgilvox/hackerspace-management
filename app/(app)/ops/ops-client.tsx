'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, Lock, Users2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { PageTitle } from '@/components/ui/page-title'
import { KbModal } from './components/kb-modal'
import { AddSecretModal } from './components/secret-modal'
import { AreaLeadModal } from './components/area-lead-modal'
import { KbPanel } from './panels/kb-panel'
import { SecretsPanel } from './panels/secrets-panel'
import { AreaLeadsPanel } from './panels/area-leads-panel'
import { TABS } from './types'
import type { OpsClientProps, Tab, KbEntry, AreaLead, Secret } from './types'

// ─── Main Component ────────────────────────────────────────────────────────────
export function OpsClient({ spaceId, kbEntries: initial, areaLeads: initialLeads, secrets: initialSecrets, canSeeSecrets, canManageAcl = false, aclRoleOptions = [], aclByEntity = {} }: OpsClientProps) {
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
          <KbPanel
            variant="kb"
            entries={filteredKb}
            search={search}
            onAdd={() => { setEditingKb(null); setShowKbModal(true) }}
            onEdit={e => { setEditingKb(e); setShowKbModal(true) }}
            onDelete={id => setKbEntries(prev => prev.filter(e => e.id !== id))}
            canManageAcl={canManageAcl}
            aclRoleOptions={aclRoleOptions}
            aclByEntity={aclByEntity}
          />
        )}

        {/* ─── Processes Tab ─── */}
        {activeTab === 'processes' && (
          <KbPanel
            variant="processes"
            entries={filteredProcesses}
            search={search}
            onAdd={() => { setEditingKb(null); setShowKbModal(true) }}
            onEdit={e => { setEditingKb(e); setShowKbModal(true) }}
            onDelete={id => setKbEntries(prev => prev.filter(e => e.id !== id))}
            canManageAcl={canManageAcl}
            aclRoleOptions={aclRoleOptions}
            aclByEntity={aclByEntity}
          />
        )}

        {/* ─── Secrets Tab ─── */}
        {activeTab === 'secrets' && (
          <SecretsPanel
            canSeeSecrets={canSeeSecrets}
            secrets={filteredSecrets}
            search={search}
            onAdd={() => setShowSecretModal(true)}
            onDelete={id => setSecrets(prev => prev.filter(x => x.id !== id))}
            canManageAcl={canManageAcl}
            aclRoleOptions={aclRoleOptions}
            aclByEntity={aclByEntity}
          />
        )}

        {/* ─── Area Leads Tab ─── */}
        {activeTab === 'area-leads' && (
          <AreaLeadsPanel
            leads={filteredLeads}
            onAdd={() => { setEditingLead(null); setShowLeadModal(true) }}
            onEdit={lead => { setEditingLead(lead); setShowLeadModal(true) }}
            onDelete={deleteLeadFn}
          />
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
