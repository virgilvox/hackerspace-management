'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'

type Dest = { label: string; href: string; perm?: string; adminOnly?: boolean }

const NAV: { group: string; items: Dest[] }[] = [
  {
    group: 'Workspace',
    items: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Tasks & Chores', href: '/tasks' },
      { label: 'Projects', href: '/projects' },
      { label: 'Ops & Facilities', href: '/ops' },
      { label: 'Comms', href: '/comms' },
      { label: 'Forum', href: '/forum' },
    ],
  },
  {
    group: 'Governance',
    items: [
      { label: 'Proposals', href: '/proposals' },
      { label: 'Incidents', href: '/incidents' },
      { label: 'Policies', href: '/policies' },
    ],
  },
  {
    group: 'Access & Resources',
    items: [
      { label: 'Classes', href: '/classes' },
      { label: 'Equipment', href: '/equipment' },
      { label: 'Doors', href: '/doors' },
      { label: 'Forms', href: '/my-forms' },
    ],
  },
  {
    group: 'People',
    items: [
      { label: 'Members', href: '/members' },
      { label: 'Attendance', href: '/attendance' },
      { label: 'Contacts', href: '/contacts' },
    ],
  },
  {
    group: 'Finance',
    items: [
      { label: 'Payments', href: '/payments' },
      { label: 'Financials', href: '/financials' },
    ],
  },
  {
    group: 'Account',
    items: [
      { label: 'My membership', href: '/me' },
    ],
  },
  {
    group: 'Admin',
    items: [
      { label: 'Customize', href: '/customize', adminOnly: true },
      { label: 'Forms & waivers', href: '/forms', perm: 'forms.manage' },
      { label: 'Certifications', href: '/certifications', perm: 'certifications.manage' },
      { label: 'Manage classes', href: '/classes/manage', perm: 'classes.manage' },
      { label: 'Manage equipment', href: '/equipment/manage', perm: 'equipment.manage' },
      { label: 'Door access', href: '/door/manage', perm: 'door.manage' },
      { label: 'Import / Sync', href: '/import', adminOnly: true },
      { label: 'Settings', href: '/settings', adminOnly: true },
    ],
  },
]

export function CommandPalette({
  isAdmin = false,
  navPerms = {},
}: {
  isAdmin?: boolean
  navPerms?: Record<string, boolean>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    const onOpen = () => setOpen(true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('commandpalette:open', onOpen)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('commandpalette:open', onOpen)
    }
  }, [])

  const allowed = useCallback(
    (d: Dest) => {
      if (d.adminOnly) return isAdmin
      if (d.perm) return isAdmin || !!navPerms[d.perm]
      return true
    },
    [isAdmin, navPerms],
  )

  const go = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Jump to a page">
      <CommandInput placeholder="Jump to…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        {NAV.map(section => {
          const items = section.items.filter(allowed)
          if (items.length === 0) return null
          return (
            <CommandGroup key={section.group} heading={section.group}>
              {items.map(d => (
                <CommandItem key={d.href} value={`${section.group} ${d.label}`} onSelect={() => go(d.href)}>
                  {d.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )
        })}
      </CommandList>
    </CommandDialog>
  )
}
