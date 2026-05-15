'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AtlasLogo } from '@/components/resources/atlas-logo'

// Icons
function IcoUsers({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
}
function IcoTask({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function IcoFolder({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
}
function IcoCreditCard({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
}
function IcoLock({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
}
function IcoDoc({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
}
function IcoArrow({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
}
function IcoTerminal({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
}
function IcoEye({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
}
function IcoPin({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
}
function IcoGithub({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.01-.02-1.98-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.45.11-3.02 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39.98 0 1.97.13 2.89.39 2.2-1.49 3.17-1.18 3.17-1.18.63 1.57.23 2.73.11 3.02.74.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.4-5.25 5.68.41.35.78 1.04.78 2.11 0 1.52-.01 2.74-.01 3.11 0 .31.21.68.8.56 4.57-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  )
}

// ─── Mini UI Previews ──────────────────────────────────────────────────────────

function MiniMemberTable() {
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

function MiniTaskList() {
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

function MiniProjectBoard() {
  const [movingCard, setMovingCard] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setMovingCard(p => (p + 1) % 3), 2500)
    return () => clearInterval(t)
  }, [])
  const columns = ['BACKLOG', 'IN PROGRESS', 'DONE']
  return (
    <div className="bg-card border border-border rounded overflow-hidden text-[10px]">
      <div className="bg-sidebar px-2 py-1.5">
        <span className="text-white/90 font-medium">Projects</span>
      </div>
      <div className="grid grid-cols-3 gap-1 p-1.5">
        {columns.map((col, colIndex) => (
          <div key={col} className="space-y-1">
            <div className="flex items-center gap-1 mb-1">
              <span className={`w-1 h-1 rounded-full ${colIndex === 1 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
              <span className="text-[7px] font-mono text-muted-foreground">{col}</span>
            </div>
            {colIndex === movingCard && (
              <div className="bg-muted border border-primary/30 rounded p-1 transition-all duration-500">
                <p className="text-[8px] text-foreground truncate">CNC Upgrade</p>
                <div className="h-0.5 bg-border rounded mt-1">
                  <div className="h-full bg-primary rounded" style={{ width: '60%' }} />
                </div>
              </div>
            )}
            {colIndex === 1 && colIndex !== movingCard && (
              <div className="bg-muted border border-border rounded p-1 opacity-40">
                <p className="text-[8px] text-muted-foreground truncate">Network rack</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniPayments() {
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

function MiniOps() {
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
              i === revealedIndex
                ? 'text-primary border-primary/30 bg-primary/5'
                : 'text-muted-foreground border-border'
            }`}>
              <IcoEye className="w-2 h-2" />
              {i === revealedIndex ? (
                <span className="font-mono text-[7px] text-primary">••••1234</span>
              ) : (
                <span>reveal</span>
              )}
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

function MiniDashboard() {
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

// ─── Main Landing Page ─────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-sidebar">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <AtlasLogo className="w-6 h-6 text-primary shrink-0" />
            <span className="font-mono text-sm font-bold text-white truncate">hackerspace.sh</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/resources" className="hidden sm:inline-flex font-sans text-sm text-sidebar-foreground hover:text-white transition px-3 py-1.5">
              Resources
            </Link>
            <a
              href="https://github.com/virgilvox/hackerspace-management"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View source on GitHub"
              className="inline-flex items-center justify-center w-9 h-9 rounded text-sidebar-foreground hover:text-white hover:bg-white/5 transition"
            >
              <IcoGithub className="w-5 h-5" />
            </a>
            <Link href="/login" className="font-sans text-sm text-sidebar-foreground hover:text-white transition px-3 py-1.5">
              Log in
            </Link>
            <Link href="/signup" className="font-sans text-sm bg-primary text-white px-3 py-1.5 rounded hover:bg-primary/90 transition whitespace-nowrap">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-sidebar border-b border-sidebar-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="font-mono text-[10px] tracking-widest text-primary uppercase mb-4">
                hackerspace management
              </p>
              <h1 className="font-sans text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6 text-balance">
                Members, payments, tasks, projects, ops docs
              </h1>
              <p className="font-sans text-base md:text-lg text-sidebar-foreground leading-relaxed mb-8 max-w-lg">
                Track who is in your space, what they owe, what needs doing, and where to find the WiFi password.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/signup" className="inline-flex items-center justify-center gap-2 bg-primary text-white font-sans text-sm px-6 py-3 rounded hover:bg-primary/90 transition">
                  Get Started
                  <IcoArrow className="w-4 h-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center justify-center gap-2 border border-sidebar-border text-sidebar-foreground font-sans text-sm px-6 py-3 rounded hover:border-primary/50 hover:text-white transition">
                  Log in
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-3">
                  <MiniMemberTable />
                  <MiniDashboard />
                </div>
                <div className="space-y-3 pt-6">
                  <MiniTaskList />
                  <MiniPayments />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="mb-12 md:mb-16">
            <p className="font-mono text-[10px] tracking-widest text-primary uppercase mb-3">What it does</p>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-foreground mb-4 text-balance">
              Six modules
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                Icon: IcoUsers,
                title: 'Member Directory',
                description: 'Track membership tiers, payment status, and contact info. Bulk actions for common operations. Know who is current and who is not.',
                preview: <MiniMemberTable />,
              },
              {
                Icon: IcoTask,
                title: 'Task Board',
                description: 'Chores, maintenance, and one-off tasks with assignments, due dates, and recurring schedules. Claim and complete from anywhere.',
                preview: <MiniTaskList />,
              },
              {
                Icon: IcoFolder,
                title: 'Project Tracking',
                description: 'Kanban board for space projects. Track progress, assign areas, and keep the community informed about what is in motion.',
                preview: <MiniProjectBoard />,
              },
              {
                Icon: IcoCreditCard,
                title: 'Payment Reconciliation',
                description: 'Import from PayPal, Venmo, or Zeffy. Match transactions to members manually or let it auto-match by email.',
                preview: <MiniPayments />,
              },
              {
                Icon: IcoLock,
                title: 'Ops: Secrets and KB',
                description: 'Store WiFi passwords, alarm codes, API keys, and procedures in one place. Role-based visibility. Reveal on demand.',
                preview: <MiniOps />,
              },
              {
                Icon: IcoDoc,
                title: 'Dashboard',
                description: 'At a glance status on membership, open tasks, payment issues, and recent activity. Know what needs attention when you log in.',
                preview: <MiniDashboard />,
              },
            ].map((feature) => (
              <div key={feature.title} className="bg-card border border-border rounded-lg p-5 hover:border-primary/30 transition group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition">
                    <feature.Icon className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-sans text-base font-semibold text-foreground">{feature.title}</h3>
                </div>
                <p className="font-sans text-sm text-muted-foreground mb-4 leading-relaxed">
                  {feature.description}
                </p>
                <div className="opacity-80 group-hover:opacity-100 transition">
                  {feature.preview}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 md:py-24 bg-muted/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="mb-12">
            <p className="font-mono text-[10px] tracking-widest text-primary uppercase mb-3">Setup</p>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-foreground mb-4">
              From nothing to running in under an hour
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Import your members',
                description: 'Paste from a spreadsheet or add them one by one. Set tiers, statuses, and contact info.',
              },
              {
                step: '02',
                title: 'Connect payments',
                description: 'Link your PayPal or Zeffy account. Import transactions and match them to members.',
              },
              {
                step: '03',
                title: 'Seed your ops docs',
                description: 'Drop in your SOPs, credentials, and area leads. The whole board has one place to look things up.',
              },
            ].map((item) => (
              <div key={item.step}>
                <p className="font-mono text-3xl font-bold text-primary/30 mb-3">{item.step}</p>
                <h3 className="font-sans text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="font-sans text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-sidebar border-t border-sidebar-border">
        <div className="max-w-3xl mx-auto px-4 md:px-6 text-center">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup" className="inline-flex items-center gap-2 bg-primary text-white font-sans text-sm px-8 py-3 rounded hover:bg-primary/90 transition">
              Get Started
              <IcoArrow className="w-4 h-4" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 border border-sidebar-border text-sidebar-foreground font-sans text-sm px-8 py-3 rounded hover:border-primary/50 hover:text-white transition">
              Log in
            </Link>
          </div>
          <p className="mt-6 font-mono text-xs text-sidebar-foreground/60">
            Not running a space? Read the{' '}
            <Link href="/resources" className="text-primary hover:underline">
              hackerspace research and games →
            </Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-sidebar border-t border-sidebar-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AtlasLogo className="w-5 h-5 text-primary" />
              <span className="font-mono text-xs text-sidebar-foreground">hackerspace.sh</span>
            </div>
            <div className="flex items-center gap-4">
              <p className="font-mono text-[10px] text-sidebar-foreground/50">
                Management software for makerspaces and community workshops.
              </p>
              <a
                href="https://github.com/virgilvox/hackerspace-management"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View source on GitHub"
                className="inline-flex items-center gap-1.5 text-sidebar-foreground/70 hover:text-white transition font-mono text-[10px]"
              >
                <IcoGithub className="w-3.5 h-3.5" />
                source
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
