'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/auth-actions'
import type { SpaceMember, Space } from '@/lib/types'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: number
  section: 'workspace' | 'people' | 'admin'
}

function navIcon(path: string) {
  const icons: Record<string, React.ReactNode> = {
    dashboard: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    tasks: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    projects: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
    ops: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    comms: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    members: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    payments: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
    contacts: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    import: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    settings: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  }
  return icons[path] ?? null
}

interface AppSidebarProps {
  member: SpaceMember & { spaces: Space }
  taskBadge?: number
  commsBadge?: number
  paymentBadge?: number
}

export function AppSidebar({ member, taskBadge = 0, commsBadge = 0, paymentBadge = 0 }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const space = member.spaces
  const initials = member.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const isAdmin = member.role === 'admin' || member.role === 'board'

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  async function handleSignOut() {
    await signOut()
  }

  return (
    <aside className="w-[230px] shrink-0 bg-[var(--sidebar)] flex flex-col h-screen sticky top-0 border-r border-[var(--sidebar-border)]">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[var(--sidebar-border)]">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[var(--sidebar-primary)] flex items-center justify-center">
            <span className="text-white font-mono text-xs font-bold">{'{'}<span className="text-white">hs</span>{'}'}</span>
          </div>
        </Link>
        <p className="text-[var(--sidebar-foreground)]/60 text-xs mt-1.5 font-mono truncate">{space?.name || 'My Space'}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {/* WORKSPACE */}
        <div className="px-3 mb-1">
          <p className="text-[10px] uppercase tracking-widest text-[var(--sidebar-foreground)]/30 px-2 py-1 font-mono">Workspace</p>
        </div>
        {[
          { label: 'Dashboard', href: '/dashboard', key: 'dashboard', badge: 0 },
          { label: 'Tasks & Chores', href: '/tasks', key: 'tasks', badge: taskBadge },
          { label: 'Projects', href: '/projects', key: 'projects', badge: 0 },
          { label: 'Ops & Facilities', href: '/ops', key: 'ops', badge: 0 },
          { label: 'Comms', href: '/comms', key: 'comms', badge: commsBadge },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center justify-between mx-2 px-3 py-2 rounded-md text-sm transition-colors group',
              isActive(item.href)
                ? 'bg-[var(--sidebar-primary)]/15 text-[var(--sidebar-primary)]'
                : 'text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]'
            )}
          >
            <span className="flex items-center gap-2.5">
              <span className={cn(isActive(item.href) ? 'text-[var(--sidebar-primary)]' : 'text-[var(--sidebar-foreground)]/50')}>
                {navIcon(item.key)}
              </span>
              {item.label}
            </span>
            {item.badge > 0 && (
              <span className="text-[10px] bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-medium">
                {item.badge}
              </span>
            )}
          </Link>
        ))}

        {/* PEOPLE */}
        <div className="px-3 mt-4 mb-1">
          <p className="text-[10px] uppercase tracking-widest text-[var(--sidebar-foreground)]/30 px-2 py-1 font-mono">People</p>
        </div>
        {[
          { label: 'Members', href: '/members', key: 'members', badge: 0 },
          { label: 'Payments', href: '/payments', key: 'payments', badge: paymentBadge },
          { label: 'Contacts', href: '/contacts', key: 'contacts', badge: 0 },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center justify-between mx-2 px-3 py-2 rounded-md text-sm transition-colors',
              isActive(item.href)
                ? 'bg-[var(--sidebar-primary)]/15 text-[var(--sidebar-primary)]'
                : 'text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]'
            )}
          >
            <span className="flex items-center gap-2.5">
              <span className={cn(isActive(item.href) ? 'text-[var(--sidebar-primary)]' : 'text-[var(--sidebar-foreground)]/50')}>
                {navIcon(item.key)}
              </span>
              {item.label}
            </span>
            {item.badge > 0 && (
              <span className="text-[10px] bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-medium">
                {item.badge}
              </span>
            )}
          </Link>
        ))}

        {/* ADMIN */}
        {isAdmin && (
          <>
            <div className="px-3 mt-4 mb-1">
              <p className="text-[10px] uppercase tracking-widest text-[var(--sidebar-foreground)]/30 px-2 py-1 font-mono">Admin</p>
            </div>
            {[
              { label: 'Import / Sync', href: '/import', key: 'import' },
              { label: 'Settings', href: '/settings', key: 'settings' },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 mx-2 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive(item.href)
                    ? 'bg-[var(--sidebar-primary)]/15 text-[var(--sidebar-primary)]'
                    : 'text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]'
                )}
              >
                <span className={cn(isActive(item.href) ? 'text-[var(--sidebar-primary)]' : 'text-[var(--sidebar-foreground)]/50')}>
                  {navIcon(item.key)}
                </span>
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-[var(--sidebar-border)] p-3">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-[var(--sidebar-accent)] transition-colors group"
        >
          <div className="w-7 h-7 rounded bg-[var(--sidebar-primary)]/80 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[var(--sidebar-foreground)] text-xs font-medium truncate">{member.display_name}</p>
            <p className="text-[var(--sidebar-foreground)]/40 text-[10px] font-mono">{member.role} · {member.tier}</p>
          </div>
        </button>
      </div>
    </aside>
  )
}
