'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { MemberTab } from '../types'

interface MembersTabsProps {
  activeTab: MemberTab
  setActiveTab: Dispatch<SetStateAction<MemberTab>>
  total: number
  paymentIssues: number
  unverified: number
}

// Full-bleed tab bar (sits directly under the page header, outside the padded
// content region), so it is its own component rather than part of the filters.
export function MembersTabs({ activeTab, setActiveTab, total, paymentIssues, unverified }: MembersTabsProps) {
  return (
    <div className="bg-card border-b border-border px-4 md:px-6 flex gap-4 md:gap-6 overflow-x-auto">
      {[
        { key: 'all', label: `All ${total}` },
        { key: 'payment_issues', label: `Payment Issues ${paymentIssues}` },
        { key: 'unverified', label: `Pending Approval ${unverified}` },
        { key: 'inactive', label: 'Inactive' },
      ].map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setActiveTab(key as MemberTab)}
          className={`font-sans text-sm py-3 border-b-2 transition ${
            activeTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

interface MembersToolbarProps {
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  tierFilter: string
  setTierFilter: Dispatch<SetStateAction<string>>
  canBulk: boolean
  selectedCount: number
  onBulkApprove: () => void
  onClearSelection: () => void
}

// Search + tier filter row, plus the bulk-actions bar shown when a selection
// exists. Renders as a fragment so the surrounding padded content div is
// unchanged.
export function MembersToolbar({ search, setSearch, tierFilter, setTierFilter, canBulk, selectedCount, onBulkApprove, onClearSelection }: MembersToolbarProps) {
  return (
    <>
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

      {canBulk && selectedCount > 0 && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="font-mono text-xs text-foreground">{selectedCount} selected</span>
          <span className="flex items-center gap-2">
            <button onClick={onBulkApprove} className="font-mono text-[10px] border border-primary/30 text-primary bg-primary/10 px-3 py-2 min-h-[40px] rounded hover:bg-primary/15 transition">
              Approve selected
            </button>
            <button onClick={onClearSelection} className="font-mono text-[10px] border border-border px-3 py-2 min-h-[40px] rounded hover:border-primary transition">
              Clear
            </button>
          </span>
        </div>
      )}
    </>
  )
}
