// Pure secret-scrubbing for outbound error events. Observability data must
// never carry a credential or PII off the box, so every string that goes into
// an event (message, exception value, tags, extra) is run through scrubString,
// and scrubValue deep-walks objects. Kept pure + framework-free so it is unit
// tested in isolation; the transport (capture.ts) only composes it.

// Order matters: structured tokens (jwt, bearer, keys) are redacted before the
// broad email pass so a key embedded in a URL is not partially missed.
const RULES: Array<[RegExp, string]> = [
  // JSON Web Tokens (Supabase anon/service keys are JWTs): header.payload.sig
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]'],
  // Authorization: Bearer <token>
  [/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]'],
  // Stripe secret/restricted keys + webhook signing secret
  [/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+/g, '[stripe_key]'],
  [/\bwhsec_[A-Za-z0-9]+/g, '[stripe_whsec]'],
  // Resend API key
  [/\bre_[A-Za-z0-9_]{8,}/g, '[resend_key]'],
  // Email addresses (PII)
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  // Bare high-entropy hex blobs (>=32 chars, no dashes so UUIDs survive intact)
  [/\b[0-9a-fA-F]{32,}\b/g, '[hex]'],
]

export function scrubString(input: string): string {
  let out = input
  for (const [re, replacement] of RULES) out = out.replace(re, replacement)
  return out
}

// Deep-walk a value, scrubbing every string. Bounded depth and breadth so a
// pathological object can never make scrubbing itself a hot loop. Cycles are
// broken via a seen set.
const MAX_DEPTH = 6
const MAX_KEYS = 100

export function scrubValue<T>(value: T, depth = 0, seen = new WeakSet<object>()): T {
  if (typeof value === 'string') return scrubString(value) as unknown as T
  if (value === null || typeof value !== 'object') return value
  if (depth >= MAX_DEPTH) return '[truncated]' as unknown as T
  if (seen.has(value as object)) return '[circular]' as unknown as T
  seen.add(value as object)

  if (Array.isArray(value)) {
    return value.slice(0, MAX_KEYS).map(v => scrubValue(v, depth + 1, seen)) as unknown as T
  }
  const out: Record<string, unknown> = {}
  let n = 0
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (n++ >= MAX_KEYS) break
    out[k] = scrubValue(v, depth + 1, seen)
  }
  return out as unknown as T
}
