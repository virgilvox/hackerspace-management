// Server-only. The single hardened egress point for door-controller HTTP.
// Every door call funnels through here so the SSRF guard, no-redirect rule,
// timeout, response cap and secret redaction cannot be bypassed. The secret
// is already embedded in `url` by the caller (per the verified firmware,
// auth is a query param); it is never logged -- only a redacted snippet is
// ever returned.

import { validateDoorTarget, redactDoorSecrets } from '@/lib/door-logic'

export type DoorCallResult =
  | { ok: true; status: number; snippet: string }
  | { ok: false; reason: string; status?: number }

const MAX_BODY = 4096
const SNIPPET = 500

export async function callDoor(opts: {
  url: string
  pinnedHost: string
  password?: string | null
  authParam?: string | null
  timeoutMs?: number
}): Promise<DoorCallResult> {
  const guard = validateDoorTarget(opts.url, opts.pinnedHost)
  if (!guard.ok) return { ok: false, reason: guard.reason }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 6000)
  try {
    const res = await fetch(guard.url, {
      method: 'GET',
      // Never chase a redirect: a 3xx could bounce us off the pinned host.
      redirect: 'manual',
      signal: controller.signal,
      headers: { accept: 'text/plain, text/html' },
      cache: 'no-store',
    })
    if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
      return {
        ok: false,
        reason: 'The controller returned a redirect, which is refused (anti-SSRF).',
        status: res.status || undefined,
      }
    }

    let received = ''
    const reader = res.body?.getReader()
    if (reader) {
      const dec = new TextDecoder()
      while (received.length < MAX_BODY) {
        const { done, value } = await reader.read()
        if (done) break
        received += dec.decode(value, { stream: true })
      }
      try {
        await reader.cancel()
      } catch {
        /* ignore */
      }
    }
    const snippet = redactDoorSecrets(received.slice(0, SNIPPET), opts.password, opts.authParam)
    return { ok: res.ok, status: res.status, snippet }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'request failed'
    return { ok: false, reason: redactDoorSecrets(msg, opts.password, opts.authParam) }
  } finally {
    clearTimeout(timer)
  }
}
