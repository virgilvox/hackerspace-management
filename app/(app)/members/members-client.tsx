'use client'

import { useState } from 'react'
import { Plus, X, ChevronDown } from 'lucide-react'
import { addMember, updateMember, approveMember, removeMember } from '@/lib/actions'
import type { Tables } from '@/types/database'

type Member = Tables<'space_members'>

interface Props {
  members: Member[]
  currentRole: string
}

const TIER_COLORS: Record<string, string> = {
  plus: 'text-blue-600 bg-blue-50 border-blue-200',
  basic: 'text-muted-foreground bg-muted border-border',
  associate: 'text-purple-600 bg-purple-50 border-purple-200',
  admin: 'text-primary bg-primary/5 border-primary/20',
}

const isAdmin = (role: string) => role === 'admin' || role === 'board'

export function MembersClient({ members: initialMembers, currentRole }: Props) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
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
    if (!result.error) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: 'current', approved: true } : m))
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Remove this member from the space?')) return
    const result = await removeMember(memberId)
    if (!result.error) {
      setMembers(prev => prev.filter(m => m.id !== memberId))
    }
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
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Full Name *</label>
          <input type="text" required value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" />
        </div>
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Email *</label>
          <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Phone</label>
          <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" />
        </div>
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Handle</label>
          <input type="text" value={form.handle} placeholder="@username" onChange={e => setForm(f => ({ ...f, handle: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary transition" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Tier</label>
          <select value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}
            className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary">
            <option value="plus">Plus</option>
            <option value="basic">Basic</option>
            <option value="associate">Associate</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Role</label>
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
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
          <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Joined At</label>
          <input type="date" value={form.joined_at?.slice(0, 10)} onChange={e => setForm(f => ({ ...f, joined_at: e.target.value }))}
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
          <h1 className="text-white font-sans text-lg font-semibold">Members</h1>
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
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
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
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">MEMBER</th>
                <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">TIER</th>
                <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">JOINED</th>
                <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">LAST PAYMENT</th>
                <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">STATUS</th>
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
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {(m.last_paid_at || m.last_payment_at) ? new Date((m.last_paid_at || m.last_payment_at)!).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
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
                    {isAdmin(currentRole) && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {m.status === 'unverified' && (
                            <button
                              onClick={() => handleApprove(m.id)}
                              className="font-mono text-[10px] border border-primary/30 text-primary bg-primary/5 px-2 py-0.5 rounded hover:bg-primary/10 transition"
                            >
                              APPROVE
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(m)}
                            className="font-mono text-[10px] border border-border px-2 py-0.5 rounded hover:border-primary hover:text-primary transition"
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => handleRemove(m.id)}
                            className="font-mono text-[10px] border border-border px-2 py-0.5 rounded hover:border-red-300 hover:text-red-600 transition"
                          >
                            REMOVE
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={isAdmin(currentRole) ? 6 : 5} className="px-4 py-12 text-center font-sans text-sm text-muted-foreground">
                    No members match this filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-sans text-base font-semibold text-foreground">Add Member</h2>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <MemberFormFields />
              {error && <p className="font-mono text-xs text-red-500">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 border border-border text-foreground font-sans text-sm py-2 rounded hover:border-primary/50 transition">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-white font-sans text-sm py-2 rounded hover:bg-primary/90 transition disabled:opacity-60">
                  {loading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editMember && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-sans text-base font-semibold text-foreground">Edit {editMember.display_name}</h2>
              <button onClick={() => setEditMember(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <MemberFormFields />
              {error && <p className="font-mono text-xs text-red-500">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditMember(null)} className="flex-1 border border-border text-foreground font-sans text-sm py-2 rounded hover:border-primary/50 transition">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-white font-sans text-sm py-2 rounded hover:bg-primary/90 transition disabled:opacity-60">
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
