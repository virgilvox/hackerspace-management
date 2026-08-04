'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { addMember, updateMember, approveMember, bulkApproveMembers, removeMember, assignAreaLead } from '@/lib/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { PageTitle } from '@/components/ui/page-title'
import { useConfirm } from '@/components/ui/confirm'
import { MemberCertificationsDialog } from '@/components/certifications/member-certifications-dialog'
import { MemberCardsDialog } from '@/components/door/member-cards-dialog'
import { MemberFormsDialog } from '@/components/forms/member-forms-dialog'
import { MembersTabs, MembersToolbar } from './components/members-toolbar'
import { MembersTable } from './components/members-table'
import { MemberFormDialog } from './components/member-form-dialog'
import type { Member, MemberForm, MemberTab, MembersClientProps } from './types'

const isAdmin = (role: string) => role === 'admin' || role === 'board'

export function MembersClient({ members: initialMembers, currentRole, areaLeadRoles = [], inviteSlot, canGrantCerts = false, canManageCards = false, canViewForms = false }: MembersClientProps) {
  const router = useRouter()
  const confirm = useConfirm()
  const admin = isAdmin(currentRole)

  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [certMember, setCertMember] = useState<Member | null>(null)
  const [cardMember, setCardMember] = useState<Member | null>(null)
  const [formsMember, setFormsMember] = useState<Member | null>(null)

  const [activeTab, setActiveTab] = useState<MemberTab>('all')
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [showAdd, setShowAdd] = useState(false)
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Add/Edit form
  const [form, setForm] = useState<MemberForm>({
    display_name: '', email: '', phone: '', handle: '',
    tier: 'basic', role: 'member', joined_at: '', has_card_access: false,
  })

  const toggleSel = (id: string) =>
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  async function makeAreaLead(memberId: string, areaLeadRoleId: string) {
    if (!areaLeadRoleId) return
    const result = await assignAreaLead({ area_lead_role_id: areaLeadRoleId, member_id: memberId })
    if (result.error) { toast.error(result.error); return }
    toast.success('Assigned as area lead')
    router.refresh()
  }

  async function bulkApprove() {
    const ids = [...selected]
    if (ids.length === 0) return
    const res = await bulkApproveMembers(ids)
    if ('error' in res && res.error) { toast.error(res.error); return }
    const n = (res as { data: { approved: number } }).data.approved
    setMembers(prev => prev.map(m => (selected.has(m.id) && m.status === 'unverified' ? { ...m, status: 'current', approved: true } : m)))
    setSelected(new Set())
    toast.success(n > 0 ? `Approved ${n} member(s)` : 'No unverified members in the selection')
  }

  const total = members.length
  const paymentIssues = members.filter(m => m.status === 'current' && m.payment_status && m.payment_status !== 'current').length
  const unverified = members.filter(m => m.status === 'unverified').length

  const filteredMembers = members.filter(m => {
    const matchesTab =
      activeTab === 'all' ? (m.status !== 'inactive') :
      activeTab === 'payment_issues' ? (m.payment_status && m.payment_status !== 'current') :
      activeTab === 'unverified' ? m.status === 'unverified' :
      m.status === 'inactive'

    // display_name and email are both nullable (e.g. imported members), so
    // guard before .toLowerCase() — an unguarded access crashed the whole list
    // the moment an admin typed into the search box.
    const q = search.toLowerCase()
    const matchesSearch = !search ||
      (m.display_name?.toLowerCase().includes(q) ?? false) ||
      (m.email?.toLowerCase().includes(q) ?? false) ||
      (m.handle?.toLowerCase().includes(q) ?? false)

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
    setMembers(prev => prev.map(m => m.id === editMember.id ? { ...m, ...form } as Member : m))
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
      display_name: m.display_name ?? '',
      email: m.email ?? '',
      phone: m.phone ?? '',
      handle: m.handle ?? '',
      tier: m.tier,
      role: m.role,
      joined_at: m.joined_at ?? '',
      has_card_access: m.has_card_access ?? false,
    })
    setError('')
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PageTitle>Members</PageTitle>
          <span className="font-mono text-xs text-white/50">{total} total</span>
        </div>
        {admin && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Add Member
          </button>
        )}
      </div>

      <MembersTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        total={total}
        paymentIssues={paymentIssues}
        unverified={unverified}
      />

      <div className="p-4 md:p-6">
        {inviteSlot && <div className="mb-6">{inviteSlot}</div>}

        <MembersToolbar
          search={search}
          setSearch={setSearch}
          tierFilter={tierFilter}
          setTierFilter={setTierFilter}
          canBulk={admin}
          selectedCount={selected.size}
          onBulkApprove={bulkApprove}
          onClearSelection={() => setSelected(new Set())}
        />

        <MembersTable
          members={filteredMembers}
          isAdmin={admin}
          canGrantCerts={canGrantCerts}
          canManageCards={canManageCards}
          canViewForms={canViewForms}
          areaLeadRoles={areaLeadRoles}
          selected={selected}
          setSelected={setSelected}
          toggleSel={toggleSel}
          onApprove={handleApprove}
          onRemove={handleRemove}
          onEdit={openEdit}
          onCerts={setCertMember}
          onCards={setCardMember}
          onForms={setFormsMember}
          onMakeAreaLead={makeAreaLead}
        />
      </div>

      {/* Add Member Modal */}
      <MemberFormDialog
        open={showAdd}
        isEdit={false}
        form={form}
        setForm={setForm}
        loading={loading}
        error={error}
        onSubmit={handleAdd}
        onClose={() => setShowAdd(false)}
      />

      {/* Edit Member Modal */}
      <MemberFormDialog
        open={!!editMember}
        isEdit
        memberName={editMember?.display_name}
        form={form}
        setForm={setForm}
        loading={loading}
        error={error}
        onSubmit={handleEdit}
        onClose={() => setEditMember(null)}
      />

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

      {canViewForms && (
        <MemberFormsDialog
          member={formsMember ? { id: formsMember.id, display_name: formsMember.display_name } : null}
          onClose={() => setFormsMember(null)}
        />
      )}
    </div>
  )
}
