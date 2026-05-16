'use client'

import { useState } from 'react'
import { X, RefreshCcw, Receipt } from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { toast } from 'sonner'
import { logCashPayment, linkPaymentToMember } from '@/lib/actions'
import type { Tables } from '@/types/database'
import { PageTitle } from '@/components/ui/page-title'

type Payment = Tables<'payments'> & {
  space_members?: { display_name: string } | null
}

type Member = Pick<Tables<'space_members'>, 'id' | 'display_name' | 'email'>
type Integration = Pick<Tables<'integrations'>, 'platform' | 'is_connected' | 'config'>

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

  const [syncing, setSyncing] = useState(false)

  async function handlePayPalSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/paypal/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Sync failed'); return }
      toast.success(`PayPal sync complete: ${data.imported} transactions imported`)
      if (data.imported > 0) {
        // Reload page to show new transactions
        window.location.reload()
      }
    } catch {
      toast.error('PayPal sync failed')
    } finally {
      setSyncing(false)
    }
  }

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
    if (result?.error) { toast.error(result.error); setLoading(false); return }
    const linkedMember = members.find(m => m.id === memberId)
    setPayments(prev => prev.map(p => p.id === paymentId ? {
      ...p,
      member_id: memberId,
      link_status: 'linked',
      space_members: linkedMember ? { display_name: linkedMember.display_name } : null,
    } : p))
    setLinkingPayment(null)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PageTitle>Payments</PageTitle>
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

      <div className="p-4 md:p-6 space-y-6">
        {/* Platform summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
                  <div className="flex items-center gap-2">
                    {platform !== 'cash' && (
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                        integration?.is_connected ? 'text-primary border-primary/30 bg-primary/5' : 'text-muted-foreground border-border bg-muted'
                      }`}>
                        {integration?.is_connected ? 'LIVE' : 'NOT CONNECTED'}
                      </span>
                    )}
                    {platform === 'paypal' && integration?.is_connected && canEdit(currentRole) && (
                      <button
                        onClick={handlePayPalSync}
                        disabled={syncing}
                        className="flex items-center gap-1 font-mono text-[10px] border border-blue-300 text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition disabled:opacity-50"
                      >
                        <RefreshCcw className={`w-2.5 h-2.5 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-2xl font-sans font-bold text-foreground">{'$'}{total.toFixed(0)}</p>
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
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">PLATFORM</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">AMOUNT</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground hidden md:table-cell">FROM / NOTE</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground hidden sm:table-cell">DATE</th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">MEMBER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length > 0 ? filtered.map(p => (
                  <tr key={p.id} className={`hover:bg-muted/30 transition ${p.link_status === 'linked' ? 'bg-primary/3' : ''}`}>
                    <td className={`px-4 py-3 font-mono text-[10px] font-bold ${platformColors[p.platform] ?? ''}`}>
                      {p.platform?.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 font-sans text-sm font-medium">{'$'}{Number(p.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-[200px] truncate hidden md:table-cell">
                      {p.from_identifier}{p.from_note ? ` - "${p.from_note}"` : ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                      {p.transaction_date ? new Date(p.transaction_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
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
                    <td colSpan={5} className="p-0">
                      <Empty className="border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
                          <EmptyTitle>No payments yet</EmptyTitle>
                          <EmptyDescription>Synced and logged transactions show up here once they exist.</EmptyDescription>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cash-amount" className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Amount *</label>
                  <input id="cash-amount" type="number" step="0.01" min="0" required value={cashForm.amount}
                    onChange={e => setCashForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="50.00"
                    className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" />
                </div>
                <div>
                  <label htmlFor="cash-date" className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Date</label>
                  <input id="cash-date" type="date" value={cashForm.date}
                    onChange={e => setCashForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label htmlFor="cash-from-note" className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Note / From *</label>
                <input id="cash-from-note" type="text" required value={cashForm.from_note}
                  onChange={e => setCashForm(f => ({ ...f, from_note: e.target.value }))}
                  placeholder="John Smith — March dues"
                  className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary transition" />
              </div>
              <div>
                <label htmlFor="cash-member" className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Link to Member</label>
                <select id="cash-member" value={cashForm.member_id} onChange={e => setCashForm(f => ({ ...f, member_id: e.target.value }))}
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
                  {'$'}{linkingPayment.amount} via {linkingPayment.platform?.toUpperCase()} — {linkingPayment.from_identifier}
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
