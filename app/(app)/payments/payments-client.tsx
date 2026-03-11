'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { logCashPayment, linkPaymentToMember } from '@/lib/actions'

interface Payment {
  id: string
  platform: string
  amount: number
  from_identifier: string
  from_note?: string
  transaction_date: string
  link_status: string
  member_id?: string
  space_members?: { display_name: string } | null
}

interface Member { id: string; display_name: string; email: string }
interface Integration { platform: string; is_connected: boolean; config?: Record<string, string> }

interface Props {
  payments: Payment[]
  members: Member[]
  integrations: Integration[]
  currentRole: string
  spaceId: string
}

const platformColors: Record<string, string> = {
  paypal: 'text-blue-600', zeffy: 'text-purple-600', venmo: 'text-green-600', cash: 'text-muted-foreground',
}

const canEdit = (role: string) => ['admin', 'board', 'treasurer'].includes(role)

export function PaymentsClient({ payments: initialPayments, members, integrations, currentRole, spaceId }: Props) {
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [platformFilter, setPlatformFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showLogCash, setShowLogCash] = useState(false)
  const [linkingPayment, setLinkingPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Cash form
  const [cashForm, setCashForm] = useState({ amount: '', from_note: '', member_id: '', date: '' })

  const platforms = ['paypal', 'zeffy', 'venmo', 'cash']
  const filtered = payments.filter(p => {
    const matchPlatform = !platformFilter || p.platform === platformFilter
    const matchStatus = !statusFilter || p.link_status === statusFilter
    return matchPlatform && matchStatus
  })

  const byPlatform = platforms.reduce<Record<string, Payment[]>>((acc, platform) => {
    acc[platform] = payments.filter(p => p.platform === platform)
    return acc
  }, {})

  const unlinkedCount = payments.filter(p => p.link_status === 'unlinked').length

  async function handleLogCash(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await logCashPayment({
      amount: parseFloat(cashForm.amount),
      from_note: cashForm.from_note,
      member_id: cashForm.member_id || undefined,
      transaction_date: cashForm.date || undefined,
    })
    if (result.error) { setError(result.error); setLoading(false); return }
    if (result.data) {
      const linkedMember = cashForm.member_id ? members.find(m => m.id === cashForm.member_id) : null
      setPayments(prev => [{
        ...result.data as Payment,
        space_members: linkedMember ? { display_name: linkedMember.display_name } : null,
      }, ...prev])
    }
    setShowLogCash(false)
    setCashForm({ amount: '', from_note: '', member_id: '', date: '' })
    setLoading(false)
  }

  async function handleLink(paymentId: string, memberId: string) {
    setLoading(true)
    const result = await linkPaymentToMember(paymentId, memberId)
    if (!result.error) {
      const linkedMember = members.find(m => m.id === memberId)
      setPayments(prev => prev.map(p => p.id === paymentId ? {
        ...p,
        member_id: memberId,
        link_status: 'linked',
        space_members: linkedMember ? { display_name: linkedMember.display_name } : null,
      } : p))
      setLinkingPayment(null)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-white font-sans text-lg font-semibold">Payment Reconciliation</h1>
          {unlinkedCount > 0 && (
            <span className="font-mono text-xs text-orange-400">{unlinkedCount} unlinked</span>
          )}
        </div>
        {canEdit(currentRole) && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLogCash(true)}
              className="bg-sidebar-accent border border-sidebar-border text-sidebar-foreground text-xs font-sans px-3 py-1.5 rounded hover:bg-sidebar-accent/80 transition"
            >
              Log Cash
            </button>
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Platform summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {platforms.map(platform => {
            const txs = byPlatform[platform] ?? []
            const total = txs.reduce((sum, t) => sum + (t.amount ?? 0), 0)
            const unlinked = txs.filter(t => t.link_status === 'unlinked').length
            const integration = integrations.find(i => i.platform === platform)
            return (
              <div key={platform} className="bg-card rounded border border-border p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className={`font-mono text-[10px] tracking-widest font-bold ${platformColors[platform]}`}>
                    {platform.toUpperCase()}
                  </p>
                  {platform !== 'cash' && (
                    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                      integration?.is_connected ? 'text-primary border-primary/30 bg-primary/5' : 'text-muted-foreground border-border bg-muted'
                    }`}>
                      {integration?.is_connected ? 'LIVE' : 'NOT CONNECTED'}
                    </span>
                  )}
                </div>
                <p className="text-2xl font-sans font-bold text-foreground">${total.toFixed(0)}</p>
                <p className="font-mono text-[10px] text-muted-foreground mt-1">
                  {txs.length} tx{txs.length !== 1 ? 's' : ''} · {unlinked} unlinked
                </p>
              </div>
            )
          })}
        </div>

        {/* Transactions table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">All Transactions</p>
            <div className="flex gap-2">
              <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
                className="bg-card border border-border text-foreground text-xs font-sans rounded px-2 py-1 focus:outline-none focus:border-primary">
                <option value="">All Platforms</option>
                {platforms.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-card border border-border text-foreground text-xs font-sans rounded px-2 py-1 focus:outline-none focus:border-primary">
                <option value="">All Status</option>
                <option value="linked">Linked</option>
                <option value="unlinked">Unlinked</option>
              </select>
            </div>
          </div>

          <div className="bg-card rounded border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['PLATFORM', 'AMOUNT', 'FROM / NOTE', 'DATE', 'MEMBER'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length > 0 ? filtered.map(p => (
                  <tr key={p.id} className={`hover:bg-muted/30 transition ${p.link_status === 'linked' ? 'bg-primary/3' : ''}`}>
                    <td className={`px-4 py-3 font-mono text-[10px] font-bold ${platformColors[p.platform] ?? ''}`}>
                      {p.platform?.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 font-sans text-sm font-medium">${Number(p.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                      {p.from_identifier}{p.from_note ? ` — "${p.from_note}"` : ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.transaction_date ? new Date(p.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {p.link_status === 'linked' && p.space_members ? (
                        <span className="flex items-center gap-1 font-mono text-[10px] text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/20">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {p.space_members.display_name}
                        </span>
                      ) : canEdit(currentRole) ? (
                        <button
                          onClick={() => setLinkingPayment(p)}
                          className="font-mono text-[10px] border border-dashed border-border px-2 py-0.5 rounded hover:border-primary hover:text-primary transition"
                        >
                          + Link member
                        </button>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">unlinked</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center font-sans text-sm text-muted-foreground">
                      No payments recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Log Cash Modal */}
      {showLogCash && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-sans text-base font-semibold text-foreground">Log Cash Payment</h2>
              <button onClick={() => setShowLogCash(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleLogCash} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Amount *</label>
                  <input type="number" step="0.01" min="0" required value={cashForm.amount}
                    onChange={e => setCashForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="50.00"
                    className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" />
                </div>
                <div>
                  <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Date</label>
                  <input type="date" value={cashForm.date}
                    onChange={e => setCashForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Note / From *</label>
                <input type="text" required value={cashForm.from_note}
                  onChange={e => setCashForm(f => ({ ...f, from_note: e.target.value }))}
                  placeholder="John Smith — March dues"
                  className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Link to Member</label>
                <select value={cashForm.member_id} onChange={e => setCashForm(f => ({ ...f, member_id: e.target.value }))}
                  className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary">
                  <option value="">— Unlinked —</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.display_name} ({m.email})</option>)}
                </select>
              </div>
              {error && <p className="font-mono text-xs text-red-500">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowLogCash(false)} className="flex-1 border border-border text-foreground font-sans text-sm py-2 rounded hover:border-primary/50 transition">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-white font-sans text-sm py-2 rounded hover:bg-primary/90 transition disabled:opacity-60">
                  {loading ? 'Logging...' : 'Log Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Member Modal */}
      {linkingPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-sans text-base font-semibold text-foreground">Link to Member</h2>
                <p className="font-mono text-xs text-muted-foreground mt-0.5">
                  ${linkingPayment.amount} via {linkingPayment.platform?.toUpperCase()} — {linkingPayment.from_identifier}
                </p>
              </div>
              <button onClick={() => setLinkingPayment(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto divide-y divide-border">
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleLink(linkingPayment.id, m.id)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 py-3 hover:bg-muted/30 transition text-left disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-[10px] font-mono font-bold text-primary flex-shrink-0">
                    {m.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-sans text-sm text-foreground">{m.display_name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{m.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
