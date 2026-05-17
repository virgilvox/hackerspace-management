'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { trackIncident } from '@/lib/actions'
import type { PublicIncidentView } from '@/lib/incident-logic'

export function TrackClient({
  initialToken,
  autoSubmit,
}: {
  initialToken: string
  autoSubmit: boolean
}) {
  const [token, setToken] = useState(initialToken)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<PublicIncidentView | null>(null)
  const didAuto = useRef(false)

  async function lookup(t: string) {
    setError(null)
    setView(null)
    setLoading(true)
    const res = await trackIncident({ token: t.trim() })
    setLoading(false)
    if ('error' in res && res.error) {
      setError(res.error)
      return
    }
    setView(res.data)
  }

  useEffect(() => {
    if (autoSubmit && initialToken && !didAuto.current) {
      didAuto.current = true
      lookup(initialToken)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <form
        onSubmit={e => {
          e.preventDefault()
          if (token.trim()) lookup(token)
        }}
        className="flex gap-2"
      >
        <Input
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Tracking code"
          aria-label="Tracking code"
          className="font-mono"
        />
        <Button type="submit" disabled={loading || !token.trim()}>
          {loading ? 'Looking up…' : 'Track'}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {view && (
        <div className="space-y-5 rounded-lg border p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{view.title}</h2>
            <Badge variant="secondary">{view.statusLabel}</Badge>
            <Badge variant="outline">{view.severity}</Badge>
          </div>

          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{view.body}</p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <dt>Filed</dt>
            <dd>{new Date(view.createdAt).toLocaleString()}</dd>
            {view.acknowledgedAt && (
              <>
                <dt>Acknowledged</dt>
                <dd>{new Date(view.acknowledgedAt).toLocaleString()}</dd>
              </>
            )}
            {view.decidedAt && (
              <>
                <dt>Decided</dt>
                <dd>{new Date(view.decidedAt).toLocaleString()}</dd>
              </>
            )}
            {view.closedAt && (
              <>
                <dt>Closed</dt>
                <dd>{new Date(view.closedAt).toLocaleString()}</dd>
              </>
            )}
          </dl>

          {view.disposition && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="mb-1 font-medium">Outcome</p>
              <p className="whitespace-pre-wrap">{view.disposition}</p>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">Updates</p>
            {view.updates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No updates yet.</p>
            ) : (
              <ul className="space-y-3">
                {view.updates.map((u, i) => (
                  <li key={i} className="rounded-md border p-3 text-sm">
                    <p className="whitespace-pre-wrap">{u.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {u.author} · {new Date(u.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
