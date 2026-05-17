'use client'

import { useState, type ReactNode } from 'react'
import { Plus, ChevronDown, Users } from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { addMember, updateMember, approveMember, removeMember, assignAreaLead } from '@/lib/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { Tables } from '@/types/database'
import { PageTitle } from '@/components/ui/page-title'
import { useConfirm } from '@/components/ui/confirm'
import { MemberCertificationsDialog } from '@/components/certifications/member-certifications-dialog'
import { MemberCardsDialog } from '@/components/door/member-cards-dialog'

type Member = Tables<'space_members'>
type AreaLeadRole = { id: string; area_name: string; lead_id: string | null }

interface Props {
  members: Member[]
  currentRole: string
  areaLeadRoles?: AreaLeadRole[]
  // Composed by the server page for admin/board: the existing InvitesPanel,
  // so the members page is a real place to create and share a join link
  // (the first-run "Invite or add members" step lands here).
  inviteSlot?: ReactNode
  // True when the viewer holds certifications.grant (the Instructor
  // capability), independent of admin/board. Adds a per-member
  // certifications panel reachable by non-admin instructors.
  canGrantCerts?: boolean
  // True when the viewer holds door.manage. Adds a per-member access-cards
  // panel (card UID is a credential; managers only).
  canManageCards?: boolean
}

const TIER_COLORS: Record<string, string> = {
  plus: 'text-blue-600 bg-blue-50 border-blue-200',
  basic: 'text-muted-foreground bg-muted border-border',
  associate: 'text-purple-600 bg-purple-50 border-purple-200',
  admin: 'text-primary bg-primary/5 border-primary/20',
}

const isAdmin = (role: string) => role === 'admin' || role === 'board'

export function MembersClient({ members: initialMembers, currentRole, areaLeadRoles = [], inviteSlot, canGrantCerts = false, canManageCards = false }: Props) {
  const router = useRouter()
  const [certMember, setCertMember] = useState<Member | null>(null)
  const [cardMember, setCardMember] = useState<Member | null>(null)
  const confirm = useConfirm()
  const [members, setMembers] = useState<Member[]>(initialMembers)

  async function makeAreaLead(memberId: string, areaLeadRoleId: string) {
    if (!areaLeadRoleId) return
    const result = await assignAreaLead({ area_lead_role_id: areaLeadRoleId, member_id: memberId })
    if (result.error) { toast.error(result.error); return }
    toast.success('Assigned as area lead')
    router.refresh()
  }
  const [activeTab, setActiveTab] = useState<'all' | 'payment_issues' | 'unverified' | 'inactive'>('all')
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Add/Edit form
  const [form, setForm] = useState({
    display_name: '', email: '', phone: '', handle: '',
    tier: 'basic', role: 'member', joined_at: '', has_card_access: false,
  })

  const total = members.length
  const paymentIssues = members.filter(m => m.status === 'current' && m.payment_status && m.payment_status !== 'current').length
  const unverified = members.filter(m => m.status === 'unverified').length

  const filteredMembers = members.filter(m => {
    const matchesTab =
      activeTab === 'all' ? (m.status !== 'inactive') :
      activeTab === 'payment_issues' ? (m.payment_status && m.payment_status !== 'current') :
      activeTab === 'unverified' ? m.status === 'unverified' :
      m.status === 'inactive'

    const matchesSearch = !search ||
      m.display_name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      (m.handle?.toLowerCase().includes(search.toLowerCase()) ?? false)

    const matchesTier = !tierFilter || m.tier === tierFilter

    return matchesTab && matchesSearch && matchesTier
  })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await addMember(form)
    if (result.error) { setError(result.error); setLoading(false); return }
    if (result.data) setMembers(prev => [...prev, result.data as Member])
    setShowAdd(false)
    setForm({ display_name: '', email: '', phone: '', handle: '', tier: 'basic', role: 'member', joined_at: '', has_card_access: false })
    setLoading(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editMember) return
    setLoading(true)
    setError('')
    const result = await updateMember(editMember.id, form)
    if (result.error) { setError(result.error); setLoading(false); return }
    setMembers(prev => prev.map(m => m.id === editMember.id ? { ...m, ...form } : m))
    setEditMember(null)
    setLoading(false)
  }

  async function handleApprove(memberId: string) {
    const result = await approveMember(memberId)
    if (result?.error) { toast.error(result.error); return }
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: 'current', approved: true } : m))
  }

  async function handleRemove(memberId: string) {
    if (!(await confirm({ title: 'Remove member', description: 'This member will be removed from the space.', confirmText: 'Remove', destructive: true }))) return
    const result = await removeMember(memberId)
    if (result?.error) { toast.error(result.error); return }
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  function openEdit(m: Member) {
    setEditMember(m)
    setForm({
      display_name: m.display_name,
      email: m.email,
      phone: m.phone ?? '',
      handle: m.handle ?? '',
      tier: m.tier,
      role: m.role,
      joined_at: m.joined_at ?? '',
      has_card_access: m.has_card_access ?? false,
    })
    setError('')
  }

  const MemberFormFields = () => (
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

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PageTitle>Members</PageTitle>
          <span className="font-mono text-xs text-white/50">{total} total</span>
        </div>
        {isAdmin(currentRole) && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add Member
          </button>
        )}
      </div>

      <div className="bg-card border-b border-border px-4 md:px-6 flex gap-4 md:gap-6 overflow-x-auto">
        {[
          { key: 'all', label: `All ${total}` },
          { key: 'payment_issues', label: `Payment Issues ${paymentIssues}` },
          { key: 'unverified', label: `Pending Approval ${unverified}` },
          { key: 'inactive', label: 'Inactive' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`font-sans text-sm py-3 border-b-2 transition ${
              activeTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6">
        {inviteSlot && <div className="mb-6">{inviteSlot}</div>}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              aria-label="Search members"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-card border border-border rounded pl-9 pr-4 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition"
            />
          </div>
          <select
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value)}
            className="bg-card border border-border text-foreground text-sm font-sans rounded px-2 md:px-3 py-2 focus:outline-none focus:border-primary"
          >
            <option value="">All Tiers</option>
            <option value="plus">Plus</option>
            <option value="basic">Basic</option>
            <option value="associate">Associate</option>
          </select>
        </div>

        <div className="bg-card rounded border border-border overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">MEMBER</th>
                <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">TIER</th>
                <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground hidden md:table-cell">JOINED</th>
                <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground hidden lg:table-cell">LAST PAYMENT</th>
                <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">STATUS</th>
                {canGrantCerts && (
                  <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">CERTS</th>
                )}
                {canManageCards && (
                  <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">CARDS</th>
                )}
                {isAdmin(currentRole) && (
                  <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">ACTIONS</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredMembers.length > 0 ? filteredMembers.map(m => {
                const initials = (m.display_name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                const hasIssue = m.payment_status && m.payment_status !== 'current'
                return (
                  <tr key={m.id} className={`hover:bg-muted/30 transition ${hasIssue ? 'bg-red-50/20' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0 ${
                          hasIssue ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'
                        }`}>
                          {initials}
                        </div>
                        <div>
                          <p className="font-sans text-sm font-medium text-foreground">{m.display_name}</p>
                          <p className={`font-mono text-[10px] ${hasIssue ? 'text-red-500' : 'text-muted-foreground'}`}>
                            {m.email}{m.handle ? ` · @${m.handle}` : ''}{m.payment_note ? ` — ${m.payment_note}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${TIER_COLORS[m.tier?.toLowerCase()] ?? 'text-muted-foreground bg-muted border-border'}`}>
                        {m.tier?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden md:table-cell">
                      {m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden lg:table-cell">
                      {(m.last_paid_at || m.last_payment_at) ? new Date((m.last_paid_at || m.last_payment_at)!).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {m.status === 'unverified' ? (
                        <span className="flex items-center gap-1 font-mono text-xs text-orange-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> unverified
                        </span>
                      ) : m.payment_status === 'current' ? (
                        <span className="flex items-center gap-1 font-mono text-xs text-primary">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" /> current
                        </span>
                      ) : m.payment_status ? (
                        <span className="flex items-center gap-1 font-mono text-xs text-red-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {m.payment_status}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">{m.status}</span>
                      )}
                    </td>
                    {canGrantCerts && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setCertMember(m)}
                          className="font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-primary hover:text-primary transition"
                        >
                          CERTS
                        </button>
                      </td>
                    )}
                    {canManageCards && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setCardMember(m)}
                          className="font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-primary hover:text-primary transition"
                        >
                          CARDS
                        </button>
                      </td>
                    )}
                    {isAdmin(currentRole) && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {m.status === 'unverified' && (
                            <button
                              onClick={() => handleApprove(m.id)}
                              className="font-mono text-[10px] border border-primary/30 text-primary bg-primary/5 px-3 py-2 min-h-[44px] rounded hover:bg-primary/10 transition"
                            >
                              APPROVE
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(m)}
                            className="font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-primary hover:text-primary transition"
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => handleRemove(m.id)}
                            className="font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-red-300 hover:text-red-600 transition"
                          >
                            REMOVE
                          </button>
                          {areaLeadRoles.length > 0 && (
                            <select
                              defaultValue=""
                              onChange={e => { makeAreaLead(m.id, e.target.value); e.currentTarget.value = '' }}
                              className="font-mono text-[10px] border border-border px-2 py-2 min-h-[44px] rounded bg-background text-muted-foreground hover:border-primary hover:text-primary transition focus:outline-none"
                              title="Assign this member as an area lead"
                            >
                              <option value="">+ area lead</option>
                              {areaLeadRoles.map(r => (
                                <option key={r.id} value={r.id}>
                                  {r.area_name}{r.lead_id ? ' (reassign)' : ' (vacant)'}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={5 + (canGrantCerts ? 1 : 0) + (canManageCards ? 1 : 0) + (isAdmin(currentRole) ? 1 : 0)} className="p-0">
                    <Empty className="border-0">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><Users /></EmptyMedia>
                        <EmptyTitle>No members match this filter</EmptyTitle>
                        <EmptyDescription>Try a different tab, clear the search, or change the tier filter.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      <Dialog open={showAdd} onOpenChange={(o) => { if (!o) setShowAdd(false) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <MemberFormFields />
            {error && <p className="font-mono text-xs text-red-500">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-border text-foreground font-sans text-sm py-2 rounded hover:border-primary/50 transition">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 bg-primary text-white font-sans text-sm py-2 rounded hover:bg-primary/90 transition disabled:opacity-60">
                {loading ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Member Modal */}
      <Dialog open={!!editMember} onOpenChange={(o) => { if (!o) setEditMember(null) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editMember?.display_name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <MemberFormFields />
            {error && <p className="font-mono text-xs text-red-500">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditMember(null)} className="flex-1 border border-border text-foreground font-sans text-sm py-2 rounded hover:border-primary/50 transition">Cancel</button>
              <button type="submit" disabled={loading} className="flex-1 bg-primary text-white font-sans text-sm py-2 rounded hover:bg-primary/90 transition disabled:opacity-60">
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {canGrantCerts && (
        <MemberCertificationsDialog
          member={certMember ? { id: certMember.id, display_name: certMember.display_name } : null}
          onClose={() => setCertMember(null)}
        />
      )}

      {canManageCards && (
        <MemberCardsDialog
          member={cardMember ? { id: cardMember.id, display_name: cardMember.display_name } : null}
          onClose={() => setCardMember(null)}
        />
      )}
    </div>
  )
}
