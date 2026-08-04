'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { Users } from 'lucide-react'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import type { Member, SortKey, AreaLeadRole } from '../types'

const TIER_COLORS: Record<string, string> = {
  plus: 'text-blue-600 bg-blue-50 border-blue-200',
  basic: 'text-muted-foreground bg-muted border-border',
  associate: 'text-purple-600 bg-purple-50 border-purple-200',
  admin: 'text-primary bg-primary/5 border-primary/20',
}

interface MembersTableProps {
  // Already filtered by the orchestrator; the table owns only its sort order.
  members: Member[]
  isAdmin: boolean
  canGrantCerts: boolean
  canManageCards: boolean
  canViewForms: boolean
  areaLeadRoles: AreaLeadRole[]
  selected: Set<string>
  setSelected: Dispatch<SetStateAction<Set<string>>>
  toggleSel: (id: string) => void
  onApprove: (memberId: string) => void
  onRemove: (memberId: string) => void
  onEdit: (m: Member) => void
  onCerts: (m: Member) => void
  onCards: (m: Member) => void
  onForms: (m: Member) => void
  onMakeAreaLead: (memberId: string, areaLeadRoleId: string) => void
}

export function MembersTable({
  members: filteredMembers,
  isAdmin,
  canGrantCerts,
  canManageCards,
  canViewForms,
  areaLeadRoles,
  selected,
  setSelected,
  toggleSel,
  onApprove,
  onRemove,
  onEdit,
  onCerts,
  onCards,
  onForms,
  onMakeAreaLead,
}: MembersTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null)

  const sortedMembers = sort
    ? [...filteredMembers].sort((a, b) => {
        const dir = sort.dir === 'asc' ? 1 : -1
        const val = (m: Member): string => {
          switch (sort.key) {
            case 'name': return (m.display_name ?? '').toLowerCase()
            case 'tier': return m.tier ?? ''
            case 'status': return m.status ?? ''
            case 'joined': return m.joined_at ?? ''
            case 'last_payment': return (m.last_paid_at || m.last_payment_at || '') as string
            default: return ''
          }
        }
        return val(a).localeCompare(val(b)) * dir
      })
    : filteredMembers

  function toggleSort(key: SortKey) {
    setSort(s =>
      s && s.key === key
        ? (s.dir === 'asc' ? { key, dir: 'desc' } : null)
        : { key, dir: 'asc' },
    )
  }
  const caret = (key: SortKey) => (sort?.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '')

  return (
    <div className="bg-card rounded border border-border overflow-hidden">
      <div className="overflow-x-auto hidden md:block">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {isAdmin && (
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  aria-label="Select all shown members"
                  checked={sortedMembers.length > 0 && sortedMembers.every(m => selected.has(m.id))}
                  onChange={e =>
                    setSelected(e.target.checked ? new Set(sortedMembers.map(m => m.id)) : new Set())
                  }
                />
              </th>
            )}
            {([
              ['name', 'MEMBER', ''],
              ['tier', 'TIER', ''],
              ['joined', 'JOINED', 'hidden md:table-cell'],
              ['last_payment', 'LAST PAYMENT', 'hidden lg:table-cell'],
              ['status', 'STATUS', ''],
            ] as [SortKey, string, string][]).map(([key, label, cls]) => (
              <th key={key} className={`px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground ${cls}`}>
                <button
                  type="button"
                  onClick={() => toggleSort(key)}
                  className="font-mono text-[10px] tracking-widest uppercase hover:text-foreground transition"
                  aria-label={`Sort by ${label}`}
                >
                  {label}{caret(key)}
                </button>
              </th>
            ))}
            {canGrantCerts && (
              <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">CERTS</th>
            )}
            {canManageCards && (
              <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">CARDS</th>
            )}
            {canViewForms && (
              <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">FORMS</th>
            )}
            {isAdmin && (
              <th className="px-4 py-3 text-left font-mono text-[10px] tracking-widest text-muted-foreground">ACTIONS</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortedMembers.length > 0 ? sortedMembers.map(m => {
            const initials = (m.display_name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
            const hasIssue = m.payment_status && m.payment_status !== 'current'
            return (
              <tr key={m.id} className={`hover:bg-muted/30 transition ${hasIssue ? 'bg-red-50/20' : ''}`}>
                {isAdmin && (
                  <td className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      aria-label={`Select ${m.display_name}`}
                      checked={selected.has(m.id)}
                      onChange={() => toggleSel(m.id)}
                    />
                  </td>
                )}
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
                      onClick={() => onCerts(m)}
                      className="font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-primary hover:text-primary transition"
                    >
                      CERTS
                    </button>
                  </td>
                )}
                {canManageCards && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onCards(m)}
                      className="font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-primary hover:text-primary transition"
                    >
                      CARDS
                    </button>
                  </td>
                )}
                {canViewForms && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onForms(m)}
                      className="font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-primary hover:text-primary transition"
                    >
                      FORMS
                    </button>
                  </td>
                )}
                {isAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {m.status === 'unverified' && (
                        <button
                          onClick={() => onApprove(m.id)}
                          className="font-mono text-[10px] border border-primary/30 text-primary bg-primary/5 px-3 py-2 min-h-[44px] rounded hover:bg-primary/10 transition"
                        >
                          APPROVE
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(m)}
                        className="font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-primary hover:text-primary transition"
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => onRemove(m.id)}
                        className="font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-red-300 hover:text-red-600 transition"
                      >
                        REMOVE
                      </button>
                      {areaLeadRoles.length > 0 && (
                        <select
                          defaultValue=""
                          onChange={e => { onMakeAreaLead(m.id, e.target.value); e.currentTarget.value = '' }}
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
              <td colSpan={5 + (isAdmin ? 1 : 0) + (canGrantCerts ? 1 : 0) + (canManageCards ? 1 : 0) + (canViewForms ? 1 : 0) + (isAdmin ? 1 : 0)} className="p-0">
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

      {/* Mobile: stacked cards (the table is unusable on phones). */}
      <div className="md:hidden divide-y divide-border">
        {sortedMembers.length > 0 ? sortedMembers.map(m => {
          const hasIssue = m.payment_status && m.payment_status !== 'current'
          return (
            <div key={m.id} className={`p-4 ${hasIssue ? 'bg-red-50/20' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-2">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${m.display_name}`}
                      className="mt-1"
                      checked={selected.has(m.id)}
                      onChange={() => toggleSel(m.id)}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-medium text-foreground truncate">{m.display_name}</p>
                    <p className={`font-mono text-[10px] truncate ${hasIssue ? 'text-red-500' : 'text-muted-foreground'}`}>{m.email}</p>
                  </div>
                </div>
                <span className={`font-mono text-[10px] px-2 py-0.5 rounded border shrink-0 ${TIER_COLORS[m.tier?.toLowerCase()] ?? 'text-muted-foreground bg-muted border-border'}`}>
                  {m.tier?.toUpperCase()}
                </span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground mt-1">
                {m.status === 'unverified' ? 'unverified' : (m.payment_status || m.status)}
                {m.joined_at ? ` · joined ${new Date(m.joined_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {isAdmin && m.status === 'unverified' && (
                  <button onClick={() => onApprove(m.id)} className="font-mono text-[10px] border border-primary/30 text-primary bg-primary/5 px-3 py-2 min-h-[44px] rounded">APPROVE</button>
                )}
                {isAdmin && (
                  <button onClick={() => onEdit(m)} className="font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded">EDIT</button>
                )}
                {canGrantCerts && (
                  <button onClick={() => onCerts(m)} className="font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded">CERTS</button>
                )}
                {canManageCards && (
                  <button onClick={() => onCards(m)} className="font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded">CARDS</button>
                )}
                {canViewForms && (
                  <button onClick={() => onForms(m)} className="font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded">FORMS</button>
                )}
                {isAdmin && (
                  <button onClick={() => onRemove(m.id)} className="font-mono text-[10px] border border-border px-3 py-2 min-h-[44px] rounded hover:border-red-300 hover:text-red-600">REMOVE</button>
                )}
              </div>
            </div>
          )
        }) : (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Users /></EmptyMedia>
              <EmptyTitle>No members match this filter</EmptyTitle>
              <EmptyDescription>Try a different tab, clear the search, or change the tier filter.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  )
}
