import { describe, it, expect } from 'vitest'
import { scrubString, scrubValue } from '@/lib/observability/scrub'
import { parseDsn, buildEvent } from '@/lib/observability/capture'

describe('scrubString', () => {
  it('redacts email addresses', () => {
    expect(scrubString('to alice@example.com now')).toBe('to [email] now')
  })

  it('redacts stripe secret + restricted keys and webhook secret', () => {
    expect(scrubString('sk_test_abc123XYZ')).toBe('[stripe_key]')
    expect(scrubString('sk_live_DEADbeef00')).toBe('[stripe_key]')
    expect(scrubString('rk_test_zzz999')).toBe('[stripe_key]')
    expect(scrubString('whsec_qWErTy123')).toBe('[stripe_whsec]')
  })

  it('redacts a Resend key', () => {
    expect(scrubString('re_AbCd1234efgh')).toBe('[resend_key]')
  })

  it('redacts JWTs (supabase keys) and bearer tokens', () => {
    expect(scrubString('eyJhbG.eyJzdWIiOiIx.sIgnAtuRe-_0')).toBe('[jwt]')
    expect(scrubString('Authorization: Bearer abc.def_123')).toBe('Authorization: Bearer [redacted]')
  })

  it('redacts high-entropy hex but leaves UUIDs intact', () => {
    expect(scrubString('key=0123456789abcdef0123456789abcdef')).toBe('key=[hex]')
    const uuid = 'f56d5f3a-8877-4d56-a6bc-c572474935a8'
    expect(scrubString(`space ${uuid}`)).toBe(`space ${uuid}`)
  })

  it('leaves benign text unchanged', () => {
    expect(scrubString('handler error: timeout after 6s')).toBe('handler error: timeout after 6s')
  })
})

describe('scrubValue', () => {
  it('deep-walks objects and arrays', () => {
    const out = scrubValue({ a: 'x@y.com', b: { c: ['re_abcd1234', 'ok'] } })
    expect(out).toEqual({ a: '[email]', b: { c: ['[resend_key]', 'ok'] } })
  })

  it('breaks cycles without throwing', () => {
    const o: Record<string, unknown> = { name: 'safe' }
    o.self = o
    const out = scrubValue(o) as Record<string, unknown>
    expect(out.name).toBe('safe')
    expect(out.self).toBe('[circular]')
  })

  it('passes through non-string scalars', () => {
    expect(scrubValue({ n: 5, b: true, z: null })).toEqual({ n: 5, b: true, z: null })
  })
})

describe('parseDsn', () => {
  it('parses a well-formed DSN into a store URL', () => {
    const p = parseDsn('https://pubkey@glitchtip.example.com/7')
    expect(p).toEqual({
      key: 'pubkey',
      host: 'glitchtip.example.com',
      projectId: '7',
      storeUrl: 'https://glitchtip.example.com/api/7/store/',
    })
  })

  it('returns null for empty/garbage/missing parts', () => {
    expect(parseDsn(undefined)).toBeNull()
    expect(parseDsn('')).toBeNull()
    expect(parseDsn('not a url')).toBeNull()
    expect(parseDsn('https://glitchtip.example.com/7')).toBeNull() // no key
    expect(parseDsn('https://pubkey@glitchtip.example.com/')).toBeNull() // no project
  })
})

describe('buildEvent', () => {
  it('builds an exception event, scrubbing message + stack', () => {
    const err = new Error('charge failed for alice@example.com')
    err.stack = 'Error: charge failed for alice@example.com\n at x (sk_test_leak123)'
    const ev = buildEvent({ error: err }, { surface: 'stripe-webhook', tags: { space: 'abc' } }, 1_700_000_000_000)
    expect(ev.platform).toBe('node')
    expect(ev.level).toBe('error')
    expect(ev.timestamp).toBe(1_700_000_000)
    expect(ev.transaction).toBe('stripe-webhook')
    expect(ev.tags).toEqual({ space: 'abc' })
    expect(ev.exception?.values[0].type).toBe('Error')
    expect(ev.exception?.values[0].value).toBe('charge failed for [email]')
    expect(ev.exception?.values[0].stacktrace_raw).toContain('[email]')
    expect(ev.exception?.values[0].stacktrace_raw).toContain('[stripe_key]')
    expect(ev.event_id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('builds a message event and scrubs extra', () => {
    const ev = buildEvent(
      { message: 'prefs lookup failed' },
      { level: 'warning', extra: { recipient: 'bob@x.io' } },
    )
    expect(ev.message).toBe('prefs lookup failed')
    expect(ev.level).toBe('warning')
    expect(ev.extra).toEqual({ recipient: '[email]' })
    expect(ev.exception).toBeUndefined()
  })
})
