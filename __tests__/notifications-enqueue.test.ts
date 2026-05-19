import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  resolveMemberContact,
  enqueueNotification,
  buildManageUrl,
  getSpaceName,
} from '@/lib/notifications/enqueue'

// Minimal hand-rolled mock of the supabase admin client. The helpers only use
// two query shapes: a chained select for member lookup and an upsert for the
// outbox write. Keeping it bare so the contract is obvious to a future reader.
type Row = Record<string, unknown>

function mockAdmin(opts: {
  selectResult?: { data: Row | null; error?: { message: string } | null }
  upsertResult?: { error: { message: string } | null }
  throwOnUpsert?: boolean
  throwOnMaybeSingle?: boolean
}) {
  const upsert = vi.fn(async () => {
    if (opts.throwOnUpsert) throw new Error('boom')
    return opts.upsertResult ?? { error: null }
  })

  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => {
      if (opts.throwOnMaybeSingle) throw new Error('network down')
      return opts.selectResult ?? { data: null, error: null }
    }),
    upsert,
  }
  const from = vi.fn(() => builder)
  return { from, builder, upsert } as unknown as {
    from: ReturnType<typeof vi.fn>
    builder: typeof builder
    upsert: typeof upsert
  }
}

describe('resolveMemberContact', () => {
  it('returns email + display_name when the member exists in the space', async () => {
    const admin = mockAdmin({
      selectResult: { data: { email: 'm@x.test', display_name: 'Mia' }, error: null },
    })
    const r = await resolveMemberContact(admin as never, 'space-1', 'member-1')
    expect(r).toEqual({ email: 'm@x.test', displayName: 'Mia' })
    expect(admin.from).toHaveBeenCalledWith('space_members')
    expect(admin.builder.eq).toHaveBeenCalledWith('id', 'member-1')
    expect(admin.builder.eq).toHaveBeenCalledWith('space_id', 'space-1')
  })

  it('returns null when the (member, space) pair has no row', async () => {
    const admin = mockAdmin({ selectResult: { data: null, error: null } })
    const r = await resolveMemberContact(admin as never, 'space-1', 'ghost')
    expect(r).toBeNull()
  })

  it('coerces missing fields to null', async () => {
    const admin = mockAdmin({
      selectResult: { data: { email: null, display_name: null }, error: null },
    })
    const r = await resolveMemberContact(admin as never, 'space-1', 'member-1')
    expect(r).toEqual({ email: null, displayName: null })
  })

  it('returns null and never throws when the lookup itself throws (best-effort)', async () => {
    const admin = mockAdmin({ throwOnMaybeSingle: true })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(resolveMemberContact(admin as never, 'space-1', 'member-1')).resolves.toBeNull()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('enqueueNotification', () => {
  const params = {
    spaceId: 'space-1',
    memberId: 'member-1',
    type: 'booking_confirmed' as const,
    recipient: 'm@x.test',
    subject: 'Reserved',
    bodyHtml: '<p>ok</p>',
    bodyText: 'ok',
    dedupeKey: 'booking_confirmed:r1',
  }

  it('upserts with onConflict + ignoreDuplicates so a replay is a no-op', async () => {
    const admin = mockAdmin({ upsertResult: { error: null } })
    await enqueueNotification(admin as never, params)
    expect(admin.from).toHaveBeenCalledWith('notifications')
    const [row, opts] = admin.upsert.mock.calls[0] as [Row, Row]
    expect(row).toMatchObject({
      space_id: 'space-1',
      member_id: 'member-1',
      type: 'booking_confirmed',
      channel: 'email',
      recipient: 'm@x.test',
      subject: 'Reserved',
      body_html: '<p>ok</p>',
      body_text: 'ok',
      status: 'pending',
      dedupe_key: 'booking_confirmed:r1',
    })
    expect(opts).toEqual({ onConflict: 'space_id,dedupe_key', ignoreDuplicates: true })
  })

  it('skips when the recipient is empty or missing an @', async () => {
    const admin = mockAdmin({})
    await enqueueNotification(admin as never, { ...params, recipient: '' })
    await enqueueNotification(admin as never, { ...params, recipient: 'not-an-email' })
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('never throws when the upsert errors (best-effort)', async () => {
    const admin = mockAdmin({ upsertResult: { error: { message: 'rls denied' } } })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(enqueueNotification(admin as never, params)).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('never throws when the upsert call itself throws (best-effort)', async () => {
    const admin = mockAdmin({ throwOnUpsert: true })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(enqueueNotification(admin as never, params)).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('buildManageUrl', () => {
  const OLD = { ...process.env }
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL
  })
  afterEach(() => {
    process.env = { ...OLD }
  })

  it('uses the provided host + proto when given', () => {
    expect(buildManageUrl('example.test', 'https')).toBe('https://example.test/me')
    expect(buildManageUrl('localhost:3000', 'http')).toBe('http://localhost:3000/me')
  })

  it('defaults proto to https when host is given without one', () => {
    expect(buildManageUrl('example.test')).toBe('https://example.test/me')
  })

  it('falls back to NEXT_PUBLIC_APP_URL then to the prod default', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://my.test'
    expect(buildManageUrl(null)).toBe('https://my.test/me')
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(buildManageUrl(null)).toBe('https://hackerspace.sh/me')
  })
})

describe('getSpaceName', () => {
  it('returns the name when present', async () => {
    const admin = mockAdmin({ selectResult: { data: { name: 'Acme Space' }, error: null } })
    expect(await getSpaceName(admin as never, 'space-1')).toBe('Acme Space')
  })
  it('returns empty string on miss', async () => {
    const admin = mockAdmin({ selectResult: { data: null, error: null } })
    expect(await getSpaceName(admin as never, 'ghost')).toBe('')
  })
  it('returns empty string when the lookup itself throws (best-effort)', async () => {
    const admin = mockAdmin({ throwOnMaybeSingle: true })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(getSpaceName(admin as never, 'space-1')).resolves.toBe('')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
