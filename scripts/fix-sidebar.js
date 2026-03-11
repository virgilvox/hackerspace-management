const fs = require('fs')
const path = require('path')

// Find the actual project root by looking for package.json
const candidates = [
  '/vercel/share/v0-project',
  process.cwd(),
]

let root = null
for (const c of candidates) {
  if (fs.existsSync(path.join(c, 'package.json'))) {
    root = c
    break
  }
}

if (!root) {
  // Walk up from cwd
  let dir = process.cwd()
  while (dir !== '/') {
    if (fs.existsSync(path.join(dir, 'package.json'))) { root = dir; break }
    dir = path.dirname(dir)
  }
}

console.log('Project root:', root)
const target = path.join(root, 'components', 'app-sidebar.tsx')
console.log('Target file:', target)
console.log('Exists:', fs.existsSync(target))

if (!fs.existsSync(target)) {
  // Try to find it
  function findFile(dir, name) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        if (e.name === 'node_modules' || e.name === '.git') continue
        const full = path.join(dir, e.name)
        if (e.isDirectory()) {
          const found = findFile(full, name)
          if (found) return found
        } else if (e.name === name) return full
      }
    } catch {}
    return null
  }
  const found = findFile(root || '/', 'app-sidebar.tsx')
  console.log('Found at:', found)
  process.exit(1)
}

let src = fs.readFileSync(target, 'utf8')

// Fix 1: add useEffect to import
src = src.replace(
  `import { useState } from 'react'`,
  `import { useState, useEffect } from 'react'`
)

// Fix 2: add useEffect after useState call
src = src.replace(
  `const [drawerOpen, setDrawerOpen] = useState(false)`,
  `const [drawerOpen, setDrawerOpen] = useState(false)

  // Auto-close drawer on route change — no onClick needed on nav links
  useEffect(() => { setDrawerOpen(false) }, [pathname])`
)

// Fix 3: remove onClick from NavLink interface
src = src.replace(`  onClick?: () => void\n`, '')

// Fix 4: remove onClick from NavLink function params
src = src.replace(
  `function NavLink({ href, label, icon: Icon, badge, active, onClick }: NavLinkProps) {`,
  `function NavLink({ href, label, icon: Icon, badge, active }: NavLinkProps) {`
)

// Fix 5: remove onClick={onClick} from <Link>
src = src.replace(`      onClick={onClick}\n`, '')

// Fix 6: remove onClick from all NavLink usages
src = src.replace(/ onClick=\{onNav\}/g, '')

fs.writeFileSync(target, src, 'utf8')
console.log('Done! Wrote', src.length, 'bytes to', target)


import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { signOut } from '@/lib/auth-actions'
import type { SpaceMember, Space } from '@/lib/types'
import {
  Menu, X, LayoutDashboard, ListChecks, FolderKanban, Settings2,
  MessageSquare, Users, CreditCard, BookUser, Download, LogOut,
} from 'lucide-react'

function NavLink({
  href, label, icon: Icon, badge, active,
}: {
  href: string
  label: string
  icon: React.ElementType
  badge?: number
  active: boolean
}) {
  return (
    <Link
      href={href}
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
  member: SpaceMember & { spaces: Space }
  taskBadge?: number
  commsBadge?: number
  paymentBadge?: number
}

export function AppSidebar({ member, taskBadge = 0, commsBadge = 0, paymentBadge = 0 }: AppSidebarProps) {
  const pathname = usePathname()
  const space = member.spaces
  const initials = member.display_name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '??'
  const isAdmin = member.role === 'admin' || member.role === 'board'
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Auto-close the drawer whenever the route changes
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  function isActive(href) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  async function handleSignOut() {
    await signOut()
  }

  const navJsx = (
    <>
      <div className="px-5 py-5 border-b border-[var(--sidebar-border)]">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[var(--sidebar-primary)] flex items-center justify-center">
            <span className="text-white font-mono text-xs font-bold">{'{'}hs{'}'}</span>
          </div>
        </Link>
        <p className="text-[var(--sidebar-foreground)]/60 text-xs mt-1.5 font-mono truncate">{space?.name || 'My Space'}</p>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-3 mb-1">
          <p className="text-[10px] uppercase tracking-widest text-[var(--sidebar-foreground)]/30 px-2 py-1 font-mono">Workspace</p>
        </div>
        <NavLink href="/dashboard" label="Dashboard"        icon={LayoutDashboard} active={isActive('/dashboard')} />
        <NavLink href="/tasks"     label="Tasks and Chores" icon={ListChecks}       active={isActive('/tasks')}    badge={taskBadge} />
        <NavLink href="/projects"  label="Projects"         icon={FolderKanban}     active={isActive('/projects')} />
        <NavLink href="/ops"       label="Ops and Facilities" icon={Settings2}      active={isActive('/ops')} />
        <NavLink href="/comms"     label="Comms"            icon={MessageSquare}    active={isActive('/comms')}    badge={commsBadge} />

        <div className="px-3 mt-4 mb-1">
          <p className="text-[10px] uppercase tracking-widest text-[var(--sidebar-foreground)]/30 px-2 py-1 font-mono">People</p>
        </div>
        <NavLink href="/members"  label="Members"  icon={Users}      active={isActive('/members')} />
        <NavLink href="/payments" label="Payments" icon={CreditCard} active={isActive('/payments')} badge={paymentBadge} />
        <NavLink href="/contacts" label="Contacts" icon={BookUser}   active={isActive('/contacts')} />

        {isAdmin && (
          <>
            <div className="px-3 mt-4 mb-1">
              <p className="text-[10px] uppercase tracking-widest text-[var(--sidebar-foreground)]/30 px-2 py-1 font-mono">Admin</p>
            </div>
            <NavLink href="/import"   label="Import and Sync" icon={Download}  active={isActive('/import')} />
            <NavLink href="/settings" label="Settings"        icon={Settings2} active={isActive('/settings')} />
          </>
        )}
      </nav>

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
            <p className="text-[var(--sidebar-foreground)]/40 text-[10px] font-mono">{member.role} and {member.tier}</p>
          </div>
          <LogOut className="w-3.5 h-3.5 text-[var(--sidebar-foreground)]/30" />
        </button>
      </div>
    </>
  )

  return (
    <>
      <aside className="hidden md:flex w-[230px] shrink-0 bg-[var(--sidebar)] flex-col h-screen sticky top-0 border-r border-[var(--sidebar-border)]">
        {navJsx}
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-[52px] bg-[var(--sidebar)] border-b border-[var(--sidebar-border)] flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[var(--sidebar-primary)] flex items-center justify-center">
            <span className="text-white font-mono text-[10px] font-bold">hs</span>
          </div>
          <span className="text-[var(--sidebar-foreground)]/60 text-xs font-mono truncate max-w-[150px]">{space?.name}</span>
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-[var(--sidebar-foreground)]/70 hover:text-[var(--sidebar-foreground)] p-1"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-[280px] bg-[var(--sidebar)] flex flex-col h-full shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--sidebar-border)]">
              <span className="text-[var(--sidebar-foreground)] text-sm font-mono font-bold">{space?.name}</span>
              <button onClick={() => setDrawerOpen(false)} className="text-[var(--sidebar-foreground)]/50 hover:text-[var(--sidebar-foreground)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            {navJsx}
          </div>
        </div>
      )}
    </>
  )
}
`

fs.writeFileSync('/vercel/share/v0-project/components/app-sidebar.tsx', content, 'utf8')
console.log('Done. Wrote', content.length, 'bytes')
