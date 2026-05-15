'use client'

import { useState, useEffect } from 'react'

// Animated product mini-previews shown framed on the landing hero, as if
// they were small screenshots of the real app. They intentionally use the
// app's own design tokens (bg-card, text-foreground, etc.) so they read as
// the actual product UI sitting inside the editorial marketing page.

function IcoUsers({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
}
function IcoTask({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function IcoLock({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
}
function IcoDoc({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
}
function IcoEye({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
}
function IcoPin({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
}

export function MiniMemberTable() {
  const [activeRow, setActiveRow] = useState(0)
  const members = [
    { name: 'Alex Chen', tier: 'PLUS', status: 'current' },
    { name: 'Jordan Mills', tier: 'BASIC', status: 'current' },
    { name: 'Sam Rivera', tier: 'PLUS', status: 'late' },
    { name: 'Casey Wong', tier: 'BASIC', status: 'current' },
  ]
  useEffect(() => {
    const t = setInterval(() => setActiveRow(p => (p + 1) % members.length), 2000)
    return () => clearInterval(t)
  }, [members.length])
  return (
    <div className="bg-card border border-border rounded overflow-hidden text-[10px]">
      <div className="bg-sidebar px-2 py-1.5 flex items-center justify-between">
        <span className="text-white/90 font-medium">Members</span>
        <span className="text-white/50 font-mono">{members.length}</span>
      </div>
      <div className="divide-y divide-border">
        {members.map((m, i) => (
          <div key={m.name} className={`flex items-center gap-2 px-2 py-1.5 transition-all duration-500 ${i === activeRow ? 'bg-primary/5' : ''}`}>
            <div className={`w-5 h-5 rounded flex items-center justify-center font-mono text-[8px] font-bold transition-all duration-500 ${i === activeRow ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
              {m.name.split(' ').map(n => n[0]).join('')}
            </div>
            <span className="flex-1 text-foreground truncate">{m.name}</span>
            <span className={`font-mono text-[8px] px-1 py-0.5 rounded ${m.tier === 'PLUS' ? 'text-blue-500 bg-blue-500/10' : 'text-muted-foreground bg-muted'}`}>{m.tier}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'current' ? 'bg-primary' : 'bg-orange-400'}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function MiniTaskList() {
  const [checkedIndex, setCheckedIndex] = useState(-1)
  const tasks = [
    { title: 'Clean laser cutter lens', area: 'Laser' },
    { title: 'Restock filament', area: '3D Print' },
    { title: 'Update wiki docs', area: 'Admin' },
  ]
  useEffect(() => {
    const t = setInterval(() => {
      setCheckedIndex(p => (p >= tasks.length - 1 ? -1 : p + 1))
    }, 1500)
    return () => clearInterval(t)
  }, [tasks.length])
  return (
    <div className="bg-card border border-border rounded overflow-hidden text-[10px]">
      <div className="bg-sidebar px-2 py-1.5 flex items-center justify-between">
        <span className="text-white/90 font-medium">Tasks</span>
        <span className="text-primary font-mono">+</span>
      </div>
      <div className="divide-y divide-border">
        {tasks.map((t, i) => (
          <div key={t.title} className="flex items-center gap-2 px-2 py-1.5">
            <div className={`w-3 h-3 rounded flex items-center justify-center transition-all duration-300 ${i <= checkedIndex ? 'bg-primary' : 'border border-border'}`}>
              {i <= checkedIndex && (
                <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`flex-1 truncate transition-all duration-300 ${i <= checkedIndex ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{t.title}</span>
            <span className="text-[8px] text-muted-foreground font-mono">{t.area}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MiniPayments() {
  const [linking, setLinking] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setLinking(p => !p), 2000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="bg-card border border-border rounded overflow-hidden text-[10px]">
      <div className="bg-sidebar px-2 py-1.5 flex items-center justify-between">
        <span className="text-white/90 font-medium">Payments</span>
        <span className="text-orange-400 font-mono text-[8px]">2 unlinked</span>
      </div>
      <div className="divide-y divide-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="text-blue-500 font-mono text-[8px] font-bold">PAYPAL</span>
          <span className="flex-1 text-foreground">$50.00</span>
          <span className={`font-mono text-[8px] px-1 py-0.5 rounded transition-all duration-500 ${linking ? 'text-primary bg-primary/10 border border-primary/20' : 'text-muted-foreground border border-dashed border-border'}`}>
            {linking ? 'LINKED' : '+ LINK'}
          </span>
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="text-green-500 font-mono text-[8px] font-bold">VENMO</span>
          <span className="flex-1 text-foreground">$75.00</span>
          <span className="font-mono text-[8px] px-1 py-0.5 rounded text-primary bg-primary/10 border border-primary/20">LINKED</span>
        </div>
      </div>
    </div>
  )
}

export function MiniOps() {
  const [revealedIndex, setRevealedIndex] = useState(-1)
  const [tab, setTab] = useState<'secrets' | 'kb'>('secrets')
  const secrets = [
    { label: 'WiFi Password', area: 'Network' },
    { label: 'Alarm Code', area: 'Security' },
    { label: 'PayPal API Key', area: 'Finance' },
  ]
  const kb = [
    { title: 'Open / Close Procedure', area: 'Ops', pinned: true },
    { title: 'Laser Cutter Safety', area: 'Laser', pinned: false },
    { title: 'Board Meeting Runbook', area: 'Admin', pinned: true },
  ]
  useEffect(() => {
    if (tab !== 'secrets') return
    const t = setInterval(() => {
      setRevealedIndex(p => (p >= secrets.length - 1 ? -1 : p + 1))
    }, 1800)
    return () => clearInterval(t)
  }, [tab, secrets.length])
  useEffect(() => {
    const t = setInterval(() => {
      setTab(p => (p === 'secrets' ? 'kb' : 'secrets'))
      setRevealedIndex(-1)
    }, 5000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="bg-card border border-border rounded overflow-hidden text-[10px]">
      <div className="bg-sidebar px-2 py-1.5">
        <span className="text-white/90 font-medium">Ops</span>
      </div>
      <div className="flex border-b border-border">
        {(['secrets', 'kb'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1 font-mono text-[8px] transition-all duration-300 ${tab === t ? 'text-primary border-b border-primary' : 'text-muted-foreground'}`}
          >
            {t === 'secrets' ? 'SECRETS' : 'KNOWLEDGE BASE'}
          </button>
        ))}
      </div>
      <div className="divide-y divide-border">
        {tab === 'secrets' && secrets.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-4 h-4 rounded bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <IcoLock className="w-2.5 h-2.5 text-amber-500" />
            </div>
            <span className="flex-1 text-foreground truncate">{s.label}</span>
            <span className="text-muted-foreground font-mono text-[8px]">{s.area}</span>
            <div className={`flex items-center gap-0.5 font-mono text-[8px] px-1 py-0.5 rounded border transition-all duration-400 ${
              i === revealedIndex ? 'text-primary border-primary/30 bg-primary/5' : 'text-muted-foreground border-border'
            }`}>
              <IcoEye className="w-2 h-2" />
              {i === revealedIndex ? <span className="font-mono text-[7px] text-primary">••••1234</span> : <span>reveal</span>}
            </div>
          </div>
        ))}
        {tab === 'kb' && kb.map((k) => (
          <div key={k.title} className={`flex items-center gap-2 px-2 py-1.5 border-l-2 ${k.pinned ? 'border-l-primary' : 'border-l-transparent'}`}>
            <div className="w-4 h-4 rounded bg-muted flex items-center justify-center flex-shrink-0">
              <IcoDoc className="w-2.5 h-2.5 text-muted-foreground" />
            </div>
            <span className="flex-1 text-foreground truncate text-[9px]">{k.title}</span>
            {k.pinned && <IcoPin className="w-2.5 h-2.5 text-primary flex-shrink-0" />}
            <span className="text-muted-foreground font-mono text-[8px]">{k.area}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MiniDashboard() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 3000)
    return () => clearInterval(t)
  }, [])
  const members = 47 + (tick % 3)
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <div className="bg-card border border-border rounded p-2">
        <div className="flex items-center gap-1 mb-1">
          <IcoUsers className="w-2.5 h-2.5 text-muted-foreground" />
          <span className="text-[8px] font-mono text-muted-foreground uppercase">Members</span>
        </div>
        <p className="text-base font-bold text-primary transition-all duration-300">{members}</p>
      </div>
      <div className="bg-card border border-border rounded p-2">
        <div className="flex items-center gap-1 mb-1">
          <IcoTask className="w-2.5 h-2.5 text-muted-foreground" />
          <span className="text-[8px] font-mono text-muted-foreground uppercase">Tasks</span>
        </div>
        <p className="text-base font-bold text-orange-500">12</p>
      </div>
      <div className="bg-card border border-border rounded p-2 col-span-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[8px] font-mono text-muted-foreground uppercase">Due this week</span>
          <span className="text-[8px] font-mono text-orange-400">3 late</span>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={`flex-1 h-3 rounded-sm transition-all duration-700 ${
              i < 3 ? 'bg-orange-400' : i < 9 ? 'bg-primary' : 'bg-muted'
            }`} />
          ))}
        </div>
      </div>
    </div>
  )
}

// Curated cluster used on the landing hero.
export function HeroPreviewCluster() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-3">
        <MiniMemberTable />
        <MiniDashboard />
      </div>
      <div className="space-y-3 pt-6">
        <MiniTaskList />
        <MiniPayments />
        <MiniOps />
      </div>
    </div>
  )
}
