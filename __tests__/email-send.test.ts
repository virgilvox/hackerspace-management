import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { sendEmail } from '@/lib/email/send'

const OLD = { ...process.env }

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

beforeEach(() => {
  process.env.RESEND_API_KEY = 're_test'
  process.env.EMAIL_FROM = 'Acme <noreply@x.test>'
})
afterEach(() => {
  process.env = { ...OLD }
  vi.restoreAllMocks()
})

const msg = { to: 'a@b.test', subject: 's', html: '<p>h</p>', text: 't' }

describe('sendEmail', () => {
  it('non-retryable when transport is not configured', async () => {
    delete process.env.RESEND_API_KEY
    const r = await sendEmail(msg)
    expect(r).toEqual({ ok: false, error: expect.stringContaining('not configured'), retryable: false })
  })

  it('non-retryable on an invalid recipient (never calls fetch)', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const r = await sendEmail({ ...msg, to: 'nope' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.retryable).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })

  it('ok with the returned id on 200', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { id: 'e_123' }))
    const r = await sendEmail(msg)
    expect(r).toEqual({ ok: true, id: 'e_123' })
  })

  it('passes the Idempotency-Key header when given', async () => {
    const f = mockFetch(200, { id: 'e_1' })
    vi.stubGlobal('fetch', f)
    await sendEmail({ ...msg, idempotencyKey: 'row-42' })
    const headers = (f.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBe('row-42')
  })

  it('429 is retryable; 422 is not', async () => {
    vi.stubGlobal('fetch', mockFetch(429, { name: 'rate_limit_exceeded', message: 'slow down' }))
    const a = await sendEmail(msg)
    expect(a.ok).toBe(false)
    if (!a.ok) expect(a.retryable).toBe(true)

    vi.stubGlobal('fetch', mockFetch(422, { name: 'validation_error', message: 'bad from' }))
    const b = await sendEmail(msg)
    expect(b.ok).toBe(false)
    if (!b.ok) {
      expect(b.retryable).toBe(false)
      expect(b.error).toContain('422')
    }
  })

  it('network throw is retryable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET') }))
    const r = await sendEmail(msg)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.retryable).toBe(true)
  })
})
