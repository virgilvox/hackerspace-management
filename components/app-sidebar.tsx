'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/auth-actions'
import { BrandMark } from '@/components/brand-mark'
import type { Tables } from '@/types/database'

type SpaceMember = Tables<'space_members'>
type Space = Tables<'spaces'>
import {
  Menu, X, LayoutDashboard, ListChecks, FolderKanban, Settings2, Wrench,
  MessageSquare, Users, CreditCard, BookUser, Download, LogOut,
  Vote, ShieldAlert, ScrollText, LineChart, UserCircle, UserSearch,
  MessagesSquare, SlidersHorizontal, ClipboardList, FileText, Award, BadgeCheck, GraduationCap,
} from 'lucide-react'

interface NavLinkProps {
  href: string
  label: string
  icon: React.ElementType
  badge?: number
  active: boolean
  onClick?: () => void
}

function NavLink({ href, label, icon: Icon, badge, active, onClick }: NavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center justify-between mx-2 px-3 py-2 rounded-md text-sm transition-colors',
        active
          ? 'bg-[var(--sidebar-primary)]/15 text-[var(--sidebar-primary)]'
          : 'text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]',
      )}
    >
      <span className="flex items-center gap-2.5">
        <Icon className={cn('w-4 h-4', active ? 'text-[var(--sidebar-primary)]' : 'text-[var(--sidebar-foreground)]/50')} />
        {label}
      </span>
      {badge && badge > 0 ? (
        <span className="text-[10px] bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center font-medium">
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

interface AppSidebarProps {
  member: SpaceMember & { spaces: Space | null }
  roleName?: string
  taskBadge?: number
  commsBadge?: number
  paymentBadge?: number
}

export function AppSidebar({ member, roleName, taskBadge = 0, commsBadge = 0, paymentBadge = 0 }: AppSidebarProps) {
  const pathname = usePathname()
  const space = member.spaces
  const initials = (member.display_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const isAdmin = member.role === 'admin' || member.role === 'board'
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const drawerCloseRef = useRef<HTMLButtonElement>(null)

  // The mobile drawer is a modal surface: lock background scroll, close on
  // Escape, and move focus into and back out of it for keyboard/AT users.
  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerCloseRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      menuButtonRef.current?.focus()
    }
  }, [drawerOpen])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const handleSignOut = async () => {
    await signOut()
  }

  const closeDrawer = () => setDrawerOpen(false)

  const renderNav = (onNav?: () => void) => (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[var(--sidebar-border)]">
        <Link href="/dashboard" onClick={onNav} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[var(--sidebar-primary)] flex items-center justify-center">
            <BrandMark className="w-4 h-4 text-white" />
          </div>
        </Link>
        <p className="text-[var(--sidebar-foreground)]/60 text-xs mt-1.5 font-mono truncate">{space?.name || 'My Space'}</p>
      </div>

      {/* Nav */}
      <nav aria-label="Primary" className="flex-1 py-4 overflow-y-auto">
        <div className="px-3 mb-1">
          <p className="text-[10px] uppercase tracking-widest text-[var(--sidebar-foreground)]/30 px-2 py-1 font-mono">Workspace</p>
        </div>
        <NavLink href="/dashboard" label="Dashboard" icon={LayoutDashboard} active={isActive('/dashboard')} onClick={onNav} />
        <NavLink href="/tasks" label="Tasks & Chores" icon={ListChecks} active={isActive('/tasks')} badge={taskBadge} onClick={onNav} />
        <NavLink href="/projects" label="Projects" icon={FolderKanban} active={isActive('/projects')} onClick={onNav} />
        <NavLink href="/ops" label="Ops & Facilities" icon={Wrench} active={isActive('/ops')} onClick={onNav} />
        <NavLink href="/comms" label="Comms" icon={MessageSquare} active={isActive('/comms')} badge={commsBadge} onClick={onNav} />
        <NavLink href="/forum" label="Forum" icon={MessagesSquare} active={isActive('/forum')} onClick={onNav} />

        <div className="px-3 mt-4 mb-1">
          <p className="text-[10px] uppercase tracking-widest text-[var(--sidebar-foreground)]/30 px-2 py-1 font-mono">Governance</p>
        </div>
        <NavLink href="/proposals" label="Proposals" icon={Vote} active={isActive('/proposals')} onClick={onNav} />
        <NavLink href="/incidents" label="Incidents" icon={ShieldAlert} active={isActive('/incidents')} onClick={onNav} />
        <NavLink href="/policies" label="Policies" icon={ScrollText} active={isActive('/policies')} onClick={onNav} />

        <div className="px-3 mt-4 mb-1">
          <p className="text-[10px] uppercase tracking-widest text-[var(--sidebar-foreground)]/30 px-2 py-1 font-mono">People</p>
        </div>
        <NavLink href="/members" label="Members" icon={Users} active={isActive('/members')} onClick={onNav} />
        <NavLink href="/payments" label="Payments" icon={CreditCard} active={isActive('/payments')} badge={paymentBadge} onClick={onNav} />
        <NavLink href="/financials" label="Financials" icon={LineChart} active={isActive('/financials')} onClick={onNav} />
        <NavLink href="/contacts" label="Contacts" icon={BookUser} active={isActive('/contacts')} onClick={onNav} />
        <NavLink href="/my-forms" label="Forms" icon={FileText} active={isActive('/my-forms')} onClick={onNav} />
        <NavLink href="/profile" label="My profile" icon={UserCircle} active={isActive('/profile')} onClick={onNav} />
        <NavLink href="/me" label="My access" icon={BadgeCheck} active={isActive('/me')} onClick={onNav} />
        {isAdmin && (
          <NavLink href="/recruitment" label="Recruitment" icon={UserSearch} active={isActive('/recruitment')} onClick={onNav} />
        )}

        {isAdmin && (
          <>
            <div className="px-3 mt-4 mb-1">
              <p className="text-[10px] uppercase tracking-widest text-[var(--sidebar-foreground)]/30 px-2 py-1 font-mono">Admin</p>
            </div>
            <NavLink href="/customize" label="Customize" icon={SlidersHorizontal} active={isActive('/customize')} onClick={onNav} />
            <NavLink href="/forms" label="Forms & waivers" icon={ClipboardList} active={isActive('/forms')} onClick={onNav} />
            <NavLink href="/certifications" label="Certifications" icon={Award} active={isActive('/certifications')} onClick={onNav} />
            <NavLink href="/classes/manage" label="Manage classes" icon={GraduationCap} active={isActive('/classes/manage')} onClick={onNav} />
            <NavLink href="/import" label="Import / Sync" icon={Download} active={isActive('/import')} onClick={onNav} />
            <NavLink href="/settings" label="Settings" icon={Settings2} active={isActive('/settings')} onClick={onNav} />
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
            <p className="text-[var(--sidebar-foreground)]/40 text-[10px] font-mono">{roleName || member.role} · {member.tier}</p>
          </div>
          <LogOut className="w-3.5 h-3.5 text-[var(--sidebar-foreground)]/30" />
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[230px] shrink-0 bg-[var(--sidebar)] flex-col h-screen sticky top-0 border-r border-[var(--sidebar-border)]">
        {renderNav()}
      </aside>

      {/* Mobile: top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[var(--sidebar)] border-b border-[var(--sidebar-border)] flex items-center justify-between px-4 h-[52px]">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[var(--sidebar-primary)] flex items-center justify-center">
            <BrandMark className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[var(--sidebar-foreground)]/60 text-xs font-mono truncate max-w-[150px]">{space?.name}</span>
        </Link>
        <button
          ref={menuButtonRef}
          onClick={() => setDrawerOpen(true)}
          className="text-[var(--sidebar-foreground)]/70 hover:text-[var(--sidebar-foreground)] p-2.5 -mr-2"
          aria-label="Open menu"
          aria-expanded={drawerOpen}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile: drawer overlay */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={closeDrawer} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="relative w-[280px] bg-[var(--sidebar)] flex flex-col h-full shadow-xl"
          >
            <div className="flex items-center justify-between px-4 h-[52px] border-b border-[var(--sidebar-border)]">
              <span className="text-[var(--sidebar-foreground)] text-sm font-mono font-bold">Menu</span>
              <button
                ref={drawerCloseRef}
                onClick={closeDrawer}
                className="text-[var(--sidebar-foreground)]/50 hover:text-[var(--sidebar-foreground)] p-2.5 -mr-2"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              {renderNav(closeDrawer)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
