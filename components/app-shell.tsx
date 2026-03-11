'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, ListChecks, FolderKanban, Settings2, MessageSquare,
  Users, CreditCard, BookUser, Download, LogOut, ChevronDown
} from 'lucide-react'

const NAV = [
  {
    section: 'WORKSPACE',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Tasks & Chores', href: '/tasks', icon: ListChecks, badge: 7 },
      { label: 'Projects', href: '/projects', icon: FolderKanban },
      { label: 'Ops & Facilities', href: '/ops', icon: Settings2 },
      { label: 'Comms', href: '/comms', icon: MessageSquare, badge: 3 },
    ],
  },
  {
    section: 'PEOPLE',
    items: [
      { label: 'Members', href: '/members', icon: Users },
      { label: 'Payments', href: '/payments', icon: CreditCard, badge: 12, badgeColor: 'text-orange-500 bg-orange-500/10' },
      { label: 'Contacts', href: '/contacts', icon: BookUser },
    ],
  },
  {
    section: 'ADMIN',
    items: [
      { label: 'Import / Sync', href: '/import', icon: Download },
      { label: 'Settings', href: '/settings', icon: Settings2 },
    ],
  },
]

interface Props {
  member: any
  space: any
  children: React.ReactNode
}

export default function AppShell({ member, space, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = (member.display_name || 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-[230px] flex-shrink-0 bg-sidebar flex flex-col h-full overflow-y-auto">
        {/* Logo */}
        <div className="px-4 pt-5 pb-4">
          <Link href="/dashboard" className="block">
            <span className="font-mono text-lg font-bold">
              <span className="text-primary">{'{'}</span>
              <span className="text-sidebar-foreground">hs</span>
              <span className="text-primary">{'}'}</span>
            </span>
          </Link>
          <p className="font-sans text-xs text-sidebar-foreground/50 mt-0.5 truncate">{space.name}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-4">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <p className="font-mono text-[10px] text-sidebar-foreground/30 tracking-widest px-2 mb-1">
                {section}
              </p>
              {items.map(({ label, href, icon: Icon, badge, badgeColor }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-sm font-sans transition group ${
                      active
                        ? 'bg-primary/20 text-primary'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                    {badge ? (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        badgeColor || 'text-sidebar-foreground/50 bg-sidebar-foreground/10'
                      }`}>
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-xs font-mono font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-sans text-sidebar-foreground truncate">{member.display_name}</p>
              <p className="text-[10px] font-mono text-sidebar-foreground/40">
                {member.role} · {member.tier}
              </p>
            </div>
            <button
              onClick={signOut}
              disabled={signingOut}
              title="Sign out"
              className="text-sidebar-foreground/30 hover:text-sidebar-foreground/70 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
