// Server-only. The single hardened egress point for door-controller HTTP.
// Every door call funnels through here so the SSRF guard, no-redirect rule,
// timeout, response cap and secret redaction cannot be bypassed. The secret
// is already embedded in `url` by the caller (per the verified firmware,
// auth is a query param); it is never logged -- only a redacted snippet is
// ever returned.

import dns from 'node:dns/promises'
import { validateDoorTarget, redactDoorSecrets, isBlockedDoorIp } from '@/lib/door-logic'

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

  // Defeat DNS-rebinding: validateDoorTarget only string-checked the host,
  // and a bare fetch would do its OWN resolution (a hostname could resolve
  // to 127.0.0.1 / 169.254.169.254 between check and connect). Resolve once
  // here, reject if ANY resolved address is blocked, then connect to the
  // validated IP literal so fetch performs no second resolution. Plaintext
  // HTTP to LAN devices that don't vhost, so connecting by IP (with a
  // best-effort original Host header) is correct; no TLS/SNI concern.
  const target = new URL(guard.url)
  let resolved: { address: string; family: number }[]
  try {
    resolved = await dns.lookup(target.hostname, { all: true, verbatim: true })
  } catch {
    return { ok: false, reason: 'Could not resolve the controller host.' }
  }
  if (resolved.length === 0) {
    return { ok: false, reason: 'The controller host did not resolve.' }
  }
  for (const a of resolved) {
    if (isBlockedDoorIp(a.address)) {
      return {
        ok: false,
        reason: 'The controller host resolves to a blocked address (loopback / link-local / metadata).',
      }
    }
  }
  const pinned = new URL(guard.url)
  const isV6 = resolved[0].family === 6
  pinned.hostname = isV6 ? `[${resolved[0].address}]` : resolved[0].address

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 6000)
  try {
    const res = await fetch(pinned.toString(), {
      method: 'GET',
      // Never chase a redirect: a 3xx could bounce us off the pinned host
      // (and would re-resolve, escaping the IP pin).
      redirect: 'manual',
      signal: controller.signal,
      // Host preserved best-effort so a vhosting controller still routes;
      // single-purpose door firmware ignores it. The UA may drop a forbidden
      // Host header — harmless for these devices.
      headers: { accept: 'text/plain, text/html', host: target.host },
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
