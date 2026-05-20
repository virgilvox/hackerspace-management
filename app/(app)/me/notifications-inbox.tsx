'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { markNotificationsRead } from '@/lib/actions'

export type InboxItem = {
  id: string
  type: string
  subject: string
  bodyText: string
  status: string
  createdAt: string
  sentAt: string | null
  readAt: string | null
}

// The member's in-app notification inbox. Click an item to expand its message
// (plain text) and mark it read; "Mark all as read" clears the rest. Read
// state lives in notifications.read_at; this is the always-on channel, so a
// notification whose email was muted ('skipped') still shows here.
export function NotificationsInbox({
  items,
  unreadCount,
}: {
  items: InboxItem[]
  unreadCount: number
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function open(n: InboxItem) {
    setExpanded(e => (e === n.id ? null : n.id))
    if (!n.readAt) {
      startTransition(async () => {
        await markNotificationsRead({ ids: [n.id] })
        router.refresh()
      })
    }
  }

  function markAll() {
    startTransition(async () => {
      await markNotificationsRead({})
      router.refresh()
    })
  }

  if (items.length === 0) {
    return (
      <p className="font-sans text-sm text-muted-foreground">
        No notifications yet. Dues receipts, booking and class updates, and form receipts show up here.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {unreadCount} unread
          </span>
          <Button size="sm" variant="outline" disabled={pending} onClick={markAll}>
            Mark all as read
          </Button>
        </div>
      )}
      <ul className="divide-y rounded border border-border">
        {items.map(n => {
          const unread = !n.readAt
          const isOpen = expanded === n.id
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className="w-full text-left p-4 flex items-start justify-between gap-4 hover:bg-muted/40"
                aria-expanded={isOpen}
              >
                <div className="min-w-0 flex items-start gap-2">
                  <span
                    className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${unread ? 'bg-primary' : 'bg-transparent'}`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <span className={`font-sans text-sm text-foreground ${unread ? 'font-semibold' : ''}`}>
                      {n.subject}
                    </span>
                    <p className="font-mono text-[10px] text-muted-foreground mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                      {n.sentAt
                        ? ` · emailed ${new Date(n.sentAt).toLocaleDateString()}`
                        : n.status === 'skipped'
                          ? ' · email muted'
                          : ''}
                    </p>
                  </div>
                </div>
                {unread && <Badge variant="outline">New</Badge>}
              </button>
              {isOpen && n.bodyText && (
                <pre className="px-4 pb-4 font-sans text-sm text-muted-foreground whitespace-pre-wrap break-words">
                  {n.bodyText}
                </pre>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
