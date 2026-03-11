'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

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
function IcoKey({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
}
function IcoChart({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
}
function IcoArrow({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
}
function IcoTerminal({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
}

// Mini UI Components with animations
function MiniMemberTable() {
  const [activeRow, setActiveRow] = useState(0)
  const members = [
    { name: 'Alex Chen', tier: 'PLUS', status: 'current' },
    { name: 'Jordan Mills', tier: 'BASIC', status: 'current' },
    { name: 'Sam Rivera', tier: 'PLUS', status: 'late' },
    { name: 'Casey Wong', tier: 'BASIC', status: 'current' },
  ]
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveRow((prev) => (prev + 1) % members.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [members.length])
  
  return (
    <div className="bg-card border border-border rounded overflow-hidden text-[10px]">
      <div className="bg-sidebar px-2 py-1.5 flex items-center justify-between">
        <span className="text-white/90 font-medium">Members</span>
        <span className="text-white/50 font-mono">{members.length}</span>
      </div>
      <div className="divide-y divide-border">
        {members.map((m, i) => (
          <div 
            key={m.name} 
            className={`flex items-center gap-2 px-2 py-1.5 transition-all duration-500 ${i === activeRow ? 'bg-primary/5' : ''}`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center font-mono text-[8px] font-bold ${i === activeRow ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
              {m.name.split(' ').map(n => n[0]).join('')}
            </div>
            <span className="flex-1 text-foreground truncate">{m.name}</span>
            <span className={`font-mono text-[8px] px-1 py-0.5 rounded ${
              m.tier === 'PLUS' ? 'text-blue-500 bg-blue-500/10' : 'text-muted-foreground bg-muted'
            }`}>{m.tier}</span>
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
    { title: 'Restock filament', area: '3D Printing' },
    { title: 'Update wiki docs', area: 'Admin' },
  ]
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCheckedIndex((prev) => {
        if (prev >= tasks.length - 1) return -1
        return prev + 1
      })
    }, 1500)
    return () => clearInterval(interval)
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
            <div className={`w-3 h-3 rounded flex items-center justify-center transition-all duration-300 ${
              i <= checkedIndex ? 'bg-primary' : 'border border-border'
            }`}>
              {i <= checkedIndex && (
                <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`flex-1 truncate transition-all duration-300 ${i <= checkedIndex ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {t.title}
            </span>
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
    const interval = setInterval(() => {
      setMovingCard((prev) => (prev + 1) % 3)
    }, 2500)
    return () => clearInterval(interval)
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
              <span className={`w-1 h-1 rounded-full ${
                colIndex === 0 ? 'bg-muted-foreground' : colIndex === 1 ? 'bg-primary' : 'bg-muted-foreground'
              }`} />
              <span className="text-[8px] font-mono text-muted-foreground">{col}</span>
            </div>
            {colIndex === movingCard && (
              <div className="bg-muted border border-primary/30 rounded p-1 transition-all duration-500">
                <p className="text-[8px] text-foreground truncate">CNC Upgrade</p>
                <div className="h-0.5 bg-border rounded mt-1">
                  <div className="h-full bg-primary rounded" style={{ width: '60%' }} />
                </div>
              </div>
            )}
            {colIndex !== movingCard && colIndex === 1 && (
              <div className="bg-muted border border-border rounded p-1 opacity-50">
                <p className="text-[8px] text-muted-foreground truncate">Placeholder</p>
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
    const interval = setInterval(() => {
      setLinking((prev) => !prev)
    }, 2000)
    return () => clearInterval(interval)
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
          <span className={`font-mono text-[8px] px-1 py-0.5 rounded transition-all duration-500 ${
            linking ? 'text-primary bg-primary/10 border border-primary/20' : 'text-muted-foreground border border-dashed border-border'
          }`}>
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

function MiniStats() {
  const [count, setCount] = useState(47)
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCount((prev) => prev + Math.floor(Math.random() * 3) - 1)
    }, 3000)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <div className="bg-card border border-border rounded p-2">
        <div className="flex items-center gap-1 mb-1">
          <IcoUsers className="w-2.5 h-2.5 text-muted-foreground" />
          <span className="text-[8px] font-mono text-muted-foreground uppercase">MEMBERS</span>
        </div>
        <p className="text-base font-bold text-primary transition-all duration-300">{count}</p>
      </div>
      <div className="bg-card border border-border rounded p-2">
        <div className="flex items-center gap-1 mb-1">
          <IcoTask className="w-2.5 h-2.5 text-muted-foreground" />
          <span className="text-[8px] font-mono text-muted-foreground uppercase">TASKS</span>
        </div>
        <p className="text-base font-bold text-orange-500">12</p>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-sidebar">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IcoTerminal className="w-5 h-5 text-primary" />
            <span className="font-mono text-sm font-bold text-white">hackerspace.sh</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="font-sans text-sm text-sidebar-foreground hover:text-white transition">
              Log in
            </Link>
            <Link href="/signup" className="font-sans text-sm bg-primary text-white px-4 py-1.5 rounded hover:bg-primary/90 transition">
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
                Operational Software for Makerspaces
              </p>
              <h1 className="font-sans text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6 text-balance">
                Run your hackerspace like the infrastructure it is
              </h1>
              <p className="font-sans text-base md:text-lg text-sidebar-foreground leading-relaxed mb-8 max-w-lg">
                Member management, dues tracking, task coordination, and project visibility. Built by people who have actually run these spaces.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/signup" className="inline-flex items-center justify-center gap-2 bg-primary text-white font-sans text-sm px-6 py-3 rounded hover:bg-primary/90 transition">
                  Start Free
                  <IcoArrow className="w-4 h-4" />
                </Link>
                <Link href="#features" className="inline-flex items-center justify-center gap-2 border border-sidebar-border text-sidebar-foreground font-sans text-sm px-6 py-3 rounded hover:border-primary/50 hover:text-white transition">
                  See Features
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-3">
                  <MiniMemberTable />
                  <MiniStats />
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

      {/* Stats bar */}
      <section className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { label: 'Spaces running', value: '40+' },
              { label: 'Members managed', value: '2,800+' },
              { label: 'Tasks completed', value: '15k+' },
              { label: 'Payments tracked', value: '$380k+' },
            ].map((stat) => (
              <div key={stat.label} className="text-center md:text-left">
                <p className="font-sans text-2xl md:text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-12 md:mb-16">
            <p className="font-mono text-[10px] tracking-widest text-primary uppercase mb-3">Features</p>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-foreground mb-4 text-balance">
              Everything your space needs, nothing it does not
            </h2>
            <p className="font-sans text-base text-muted-foreground max-w-2xl mx-auto">
              No bloated enterprise features. No learning curve. Just tools that match how hackerspaces actually operate.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                Icon: IcoUsers,
                title: 'Member Directory',
                description: 'Track membership tiers, payment status, access credentials, and contact info. Bulk actions for common operations.',
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
                description: 'Kanban board for space projects. Track progress, assign areas, and keep the community informed about ongoing work.',
                preview: <MiniProjectBoard />,
              },
              {
                Icon: IcoCreditCard,
                title: 'Payment Reconciliation',
                description: 'Import from PayPal, Venmo, and Zeffy. Link transactions to members. Know exactly who owes what without spreadsheet hell.',
                preview: <MiniPayments />,
              },
              {
                Icon: IcoKey,
                title: 'Access Control',
                description: 'Track key cards, door codes, and 24/7 access privileges. Integrated with member status so access stays current.',
                preview: (
                  <div className="bg-card border border-border rounded overflow-hidden text-[10px]">
                    <div className="bg-sidebar px-2 py-1.5">
                      <span className="text-white/90 font-medium">Access Logs</span>
                    </div>
                    <div className="p-2 space-y-1.5">
                      {[
                        { name: 'A. Chen', time: '2:34 PM', door: 'Main' },
                        { name: 'J. Mills', time: '1:12 PM', door: 'Shop' },
                        { name: 'S. Rivera', time: '11:45 AM', door: 'Main' },
                      ].map((log) => (
                        <div key={log.name + log.time} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span className="flex-1 text-foreground">{log.name}</span>
                          <span className="text-muted-foreground font-mono text-[8px]">{log.door}</span>
                          <span className="text-muted-foreground font-mono text-[8px]">{log.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                Icon: IcoChart,
                title: 'Dashboard',
                description: 'At a glance status on membership, open tasks, payment issues, and recent activity. Know what needs attention.',
                preview: <MiniStats />,
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
          <div className="text-center mb-12">
            <p className="font-mono text-[10px] tracking-widest text-primary uppercase mb-3">How it works</p>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-foreground mb-4">
              From chaos to clarity in under an hour
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Import your members',
                description: 'Paste from a spreadsheet or add them one by one. We handle the messy data.',
              },
              {
                step: '02',
                title: 'Connect payments',
                description: 'Link your PayPal or Zeffy account. Transactions import automatically.',
              },
              {
                step: '03',
                title: 'Invite your board',
                description: 'Add admins and treasurers. Everyone sees what they need to see.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center md:text-left">
                <p className="font-mono text-3xl font-bold text-primary/30 mb-3">{item.step}</p>
                <h3 className="font-sans text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="font-sans text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 md:px-6 text-center">
          <blockquote className="font-sans text-xl md:text-2xl text-foreground leading-relaxed mb-6">
            &quot;We went from a shared Google Sheet that nobody updated to actually knowing who was current on dues. Game changer for our monthly board meetings.&quot;
          </blockquote>
          <div>
            <p className="font-sans text-sm font-medium text-foreground">Marcus Webb</p>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Treasurer, FreeGeek Chicago</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-sidebar border-t border-sidebar-border">
        <div className="max-w-3xl mx-auto px-4 md:px-6 text-center">
          <h2 className="font-sans text-2xl md:text-3xl font-bold text-white mb-4 text-balance">
            Your space deserves better than spreadsheets
          </h2>
          <p className="font-sans text-base text-sidebar-foreground mb-8 max-w-xl mx-auto">
            Free for spaces under 25 members. No credit card required. Set up in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 bg-primary text-white font-sans text-sm px-8 py-3 rounded hover:bg-primary/90 transition">
              Start Free
              <IcoArrow className="w-4 h-4" />
            </Link>
            <a href="mailto:hello@hackerspace.sh" className="inline-flex items-center justify-center gap-2 border border-sidebar-border text-sidebar-foreground font-sans text-sm px-8 py-3 rounded hover:border-primary/50 hover:text-white transition">
              Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-sidebar border-t border-sidebar-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <IcoTerminal className="w-4 h-4 text-primary" />
              <span className="font-mono text-xs text-sidebar-foreground">hackerspace.sh</span>
            </div>
            <p className="font-mono text-[10px] text-sidebar-foreground/50">
              Built for makerspaces, hackerspaces, and community workshops.
            </p>
            <div className="flex items-center gap-4">
              <a href="mailto:hello@hackerspace.sh" className="font-mono text-[10px] text-sidebar-foreground hover:text-white transition">
                Contact
              </a>
              <a href="https://github.com/hackerspace-sh" className="font-mono text-[10px] text-sidebar-foreground hover:text-white transition">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
