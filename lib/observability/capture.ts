// Backend-agnostic error capture seam. Mirrors lib/email/send.ts: a one-purpose
// transport over fetch, no SDK. Sends Sentry-format events to a self-hosted
// GlitchTip (or any Sentry-compatible) ingest endpoint named by SENTRY_DSN.
//
// Inert by default: with SENTRY_DSN unset every call is a no-op, so the seam
// can ship to prod and stay dark until the backend is provisioned. Capture is
// always best-effort and never throws into a caller -- observability must not
// be able to break the money path, a cron, or a request.
import { scrubString, scrubValue } from './scrub'

export type CaptureLevel = 'error' | 'warning' | 'info'

export interface CaptureContext {
  surface?: string // e.g. 'stripe-webhook', 'cron/notifications'
  tags?: Record<string, string | number | null | undefined>
  extra?: Record<string, unknown>
  level?: CaptureLevel
}

interface ParsedDsn {
  key: string
  host: string
  projectId: string
  storeUrl: string
}

// DSN shape: https://<publicKey>@<host>[:port]/<projectId>
export function parseDsn(dsn: string | undefined | null): ParsedDsn | null {
  if (!dsn) return null
  try {
    const u = new URL(dsn)
    const key = u.username
    const projectId = u.pathname.replace(/^\/+/, '')
    if (!key || !projectId) return null
    return {
      key,
      host: u.host,
      projectId,
      storeUrl: `${u.protocol}//${u.host}/api/${projectId}/store/`,
    }
  } catch {
    return null
  }
}

export interface SentryEvent {
  event_id: string
  timestamp: number
  platform: 'node'
  level: CaptureLevel
  environment: string
  logger: string
  server_name?: string
  transaction?: string
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  message?: string
  exception?: { values: Array<{ type: string; value: string; stacktrace_raw?: string }> }
}

function cleanTags(tags: CaptureContext['tags']): Record<string, string> | undefined {
  if (!tags) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(tags)) {
    if (v === null || v === undefined) continue
    out[k] = scrubString(String(v))
  }
  return Object.keys(out).length ? out : undefined
}

// Pure event assembly (no I/O), so it is unit-testable. Everything that can
// carry a secret -- message, exception value/stack, tags, extra -- is scrubbed
// here, NOT at the call site, so no caller can accidentally leak.
export function buildEvent(
  input: { error?: unknown; message?: string },
  ctx: CaptureContext = {},
  now: number = Date.now(),
): SentryEvent {
  const event: SentryEvent = {
    event_id: cryptoRandomHex32(),
    timestamp: Math.floor(now / 1000),
    platform: 'node',
    level: ctx.level ?? 'error',
    environment: process.env.NODE_ENV ?? 'development',
    logger: 'hsm',
  }
  if (ctx.surface) event.transaction = scrubString(ctx.surface)
  const tags = cleanTags(ctx.tags)
  if (tags) event.tags = tags
  if (ctx.extra) event.extra = scrubValue(ctx.extra)

  if (input.error !== undefined) {
    const err = input.error
    const type = err instanceof Error ? err.name || 'Error' : 'NonError'
    const value =
      err instanceof Error ? err.message : typeof err === 'string' ? err : safeStringify(err)
    const stack = err instanceof Error && err.stack ? scrubString(err.stack) : undefined
    event.exception = { values: [{ type, value: scrubString(value), stacktrace_raw: stack }] }
  } else if (input.message !== undefined) {
    event.message = scrubString(input.message)
  }
  return event
}

function cryptoRandomHex32(): string {
  try {
    return globalThis.crypto.randomUUID().replace(/-/g, '')
  } catch {
    return Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32)
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v) ?? String(v)
  } catch {
    return String(v)
  }
}

const SEND_TIMEOUT_MS = 2500

async function send(event: SentryEvent): Promise<void> {
  const dsn = parseDsn(process.env.SENTRY_DSN)
  if (!dsn) return
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
  try {
    await fetch(dsn.storeUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=hsm/1.0, sentry_key=${dsn.key}`,
      },
      body: JSON.stringify(event),
    })
  } catch {
    // Best-effort: a logging-backend blip must never surface to the caller.
  } finally {
    clearTimeout(t)
  }
}

export function captureException(error: unknown, ctx: CaptureContext = {}): void {
  if (!process.env.SENTRY_DSN) return
  // Fire and forget; swallow everything.
  void send(buildEvent({ error }, { ...ctx, level: ctx.level ?? 'error' })).catch(() => {})
}

export function captureMessage(message: string, ctx: CaptureContext = {}): void {
  if (!process.env.SENTRY_DSN) return
  void send(buildEvent({ message }, { ...ctx, level: ctx.level ?? 'info' })).catch(() => {})
}
