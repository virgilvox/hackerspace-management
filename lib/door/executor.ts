// Server-only. The single hardened egress point for both the door controller
// HTTP (callDoor) and the universal API-call buttons (callApi). Every outbound
// call funnels through `egress` so the SSRF guard, no-redirect rule, timeout,
// response cap and secret redaction cannot be bypassed. Secrets are never
// logged -- only a redacted snippet is ever returned.

import dns from 'node:dns/promises'
import { validateDoorTarget, redactDoorSecrets, isBlockedDoorIp } from '@/lib/door-logic'
import { buildApiRequest, type ApiAuthMode } from '@/lib/api-call-logic'

export type DoorCallResult =
  | { ok: true; status: number; snippet: string }
  | { ok: false; reason: string; status?: number }

const MAX_BODY = 4096
const SNIPPET = 500
// Log-ingest polls (HeatSync ?z) need the whole ring-buffer dump, which is
// larger than a status snippet. Capped so a hostile/garbage response still
// cannot exhaust memory.
const MAX_BODY_INGEST = 32768
// API-button responses: enough for a useful audit detail, not unbounded.
const MAX_BODY_API = 8192
const SNIPPET_API = 1000

// The shared hardened egress. Validates the target against the connection's
// pinned host, resolves once and connects to the validated IP literal (so
// fetch performs no second resolution -> closes the DNS-rebind TOCTOU),
// refuses redirects, caps time and body, and redacts secrets from anything
// returned. `headers.host` is always forced to the original pinned host, so a
// caller-supplied header map can never repoint routing or override it.
async function egress(opts: {
  method: string
  url: string
  pinnedHost: string
  headers?: Record<string, string>
  body?: string | null
  redactSecret?: string | null
  redactAuthParam?: string | null
  timeoutMs?: number
  maxBody: number
  snippetLen: number
}): Promise<DoorCallResult> {
  const guard = validateDoorTarget(opts.url, opts.pinnedHost)
  if (!guard.ok) return { ok: false, reason: guard.reason }

  // Defeat DNS-rebinding: validateDoorTarget only string-checked the host, and
  // a bare fetch would do its OWN resolution (a hostname could resolve to
  // 127.0.0.1 / 169.254.169.254 between check and connect). Resolve once here,
  // reject if ANY resolved address is blocked, then connect to the validated
  // IP literal so fetch performs no second resolution. Plaintext HTTP to LAN
  // devices that don't vhost, so connecting by IP (with a best-effort original
  // Host header) is correct; no TLS/SNI concern.
  const target = new URL(guard.url)
  let resolved: { address: string; family: number }[]
  try {
    resolved = await dns.lookup(target.hostname, { all: true, verbatim: true })
  } catch {
    return { ok: false, reason: 'Could not resolve the target host.' }
  }
  if (resolved.length === 0) {
    return { ok: false, reason: 'The target host did not resolve.' }
  }
  for (const a of resolved) {
    if (isBlockedDoorIp(a.address)) {
      return {
        ok: false,
        reason: 'The target host resolves to a blocked address (loopback / link-local / metadata).',
      }
    }
  }
  const pinned = new URL(guard.url)
  const isV6 = resolved[0].family === 6
  pinned.hostname = isV6 ? `[${resolved[0].address}]` : resolved[0].address

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 6000)
  try {
    // Host forced last so a custom header map cannot override the pinned host.
    const headers: Record<string, string> = { ...(opts.headers ?? {}), host: target.host }
    const res = await fetch(pinned.toString(), {
      method: opts.method,
      // Never chase a redirect: a 3xx could bounce us off the pinned host (and
      // would re-resolve, escaping the IP pin).
      redirect: 'manual',
      signal: controller.signal,
      headers,
      body: opts.body ?? undefined,
      cache: 'no-store',
    })
    if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
      return {
        ok: false,
        reason: 'The target returned a redirect, which is refused (anti-SSRF).',
        status: res.status || undefined,
      }
    }

    let received = ''
    const reader = res.body?.getReader()
    if (reader) {
      const dec = new TextDecoder()
      while (received.length < opts.maxBody) {
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
    const snippet = redactDoorSecrets(received.slice(0, opts.snippetLen), opts.redactSecret, opts.redactAuthParam)
    return { ok: res.ok, status: res.status, snippet } as DoorCallResult
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'request failed'
    return { ok: false, reason: redactDoorSecrets(msg, opts.redactSecret, opts.redactAuthParam) }
  } finally {
    clearTimeout(timer)
  }
}

// Door controller call. GET only; the secret (if any) is already embedded in
// `url` by the caller (per the verified firmware, auth is a query param).
// `fullBody` returns the whole capped body (the inbound-log poll); otherwise a
// 500-char snippet. Behavior is unchanged from the original single-function
// executor.
export async function callDoor(opts: {
  url: string
  pinnedHost: string
  password?: string | null
  authParam?: string | null
  timeoutMs?: number
  fullBody?: boolean
}): Promise<DoorCallResult> {
  return egress({
    method: 'GET',
    url: opts.url,
    pinnedHost: opts.pinnedHost,
    headers: { accept: 'text/plain, text/html' },
    redactSecret: opts.password,
    redactAuthParam: opts.authParam,
    timeoutMs: opts.timeoutMs,
    maxBody: opts.fullBody ? MAX_BODY_INGEST : MAX_BODY,
    snippetLen: opts.fullBody ? MAX_BODY_INGEST : SNIPPET,
  })
}

// Universal API-call button. Full verbs + custom headers + optional body, with
// the secret injected server-side per auth_mode (query param / custom header /
// bearer) and never returned. Same SSRF guard, host pin, no-redirect, caps and
// redaction as the door path.
export async function callApi(opts: {
  method: string
  baseUrl: string
  urlTemplate?: string | null
  pinnedHost: string
  headers?: Record<string, string> | null
  body?: string | null
  authMode: ApiAuthMode
  authParam?: string | null
  secret?: string | null
  timeoutMs?: number
}): Promise<DoorCallResult> {
  const req = buildApiRequest({
    baseUrl: opts.baseUrl,
    urlTemplate: opts.urlTemplate,
    method: opts.method,
    headers: { accept: '*/*', ...(opts.headers ?? {}) },
    body: opts.body,
    authMode: opts.authMode,
    authParam: opts.authParam,
    secret: opts.secret,
  })

  return egress({
    method: req.method,
    url: req.url,
    pinnedHost: opts.pinnedHost,
    headers: req.headers,
    body: req.body,
    redactSecret: opts.secret,
    redactAuthParam: opts.authParam,
    timeoutMs: opts.timeoutMs,
    maxBody: MAX_BODY_API,
    snippetLen: SNIPPET_API,
  })
}
