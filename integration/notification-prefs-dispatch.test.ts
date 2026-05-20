// End-to-end integration of the notification dispatcher's preference check
// (migration 048): the ROUTE HANDLER reads notification_preferences and marks
// a muted row 'skipped' instead of sending, while billing types always send.
// This path is gated off in prod until CRON_SECRET is provisioned, so the
// integration harness is its first real exercise. Mirrors stripe-webhook's
// route-handler invocation (load supabase env, lazy-import POST). With no
// RESEND_API_KEY, sendEmail is a non-retryable no-op so an UNmuted row lands
// on 'failed' (NOT 'skipped'), which is exactly the distinction we assert.
import { describe, it, expect, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { NextRequest } from 'next/server'
import { dbReady, execService, rows, seedSpace, seedMember, dropSpace } from './db'

const CRON_SECRET = 'itest_cron_secret'

function loadSupabaseEnv(): boolean {
  try {
    const out = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' })
    const get = (k: string) =>
      out.split('\n').find(l => l.startsWith(k + '='))?.slice(k.length + 1).replace(/^"|"$/g, '')
    const url = get('API_URL')
    const key = get('SERVICE_ROLE_KEY')
    if (!url || !key) return false
    process.env.NEXT_PUBLIC_SUPABASE_URL = url
    process.env.SUPABASE_SERVICE_ROLE_KEY = key
    process.env.CRON_SECRET = CRON_SECRET
    delete process.env.RESEND_API_KEY
    return true
  } catch {
    return false
  }
}
const envOk = loadSupabaseEnv()
const d = describe.skipIf(!dbReady || !envOk)

async function runCron(): Promise<void> {
  const { POST } = await import('@/app/api/cron/notifications/route')
  const req = new NextRequest('http://localhost/api/cron/notifications', {
    method: 'POST',
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
  await POST(req)
}

function seedNotif(spaceId: string, memberId: string, type: string, dedupe: string): void {
  execService(
    `insert into notifications (space_id, member_id, type, channel, recipient, subject, body_html, body_text, status, dedupe_key)
     values ('${spaceId}','${memberId}','${type}','email','x@itest.local','s','h','t','pending','${dedupe}');`,
  )
}

function statusOf(spaceId: string, dedupe: string): string | undefined {
  const r = rows<{ status: string }>(
    `select status from notifications where space_id='${spaceId}' and dedupe_key='${dedupe}'`,
  )
  return r[0]?.status
}

// Drain until the given row leaves 'pending' (the global cron may need more
// than one pass if other test files left pending rows in the batch window).
async function drainUntilResolved(spaceId: string, dedupe: string): Promise<void> {
  for (let i = 0; i < 6; i++) {
    if (statusOf(spaceId, dedupe) !== 'pending') return
    await runCron()
  }
}

d('dispatcher honors notification preferences', () => {
  const spaces: string[] = []
  afterAll(() => spaces.forEach(dropSpace))

  it('skips a muted muteable category but always sends billing', async () => {
    const { spaceId } = seedSpace()
    spaces.push(spaceId)
    const { memberId } = seedMember(spaceId, { role: 'member' })
    execService(
      `insert into notification_preferences (space_id, member_id, category, enabled)
       values ('${spaceId}','${memberId}','bookings', false);`,
    )
    const bk = `bk-${spaceId}`
    const du = `du-${spaceId}`
    seedNotif(spaceId, memberId, 'booking_confirmed', bk)
    seedNotif(spaceId, memberId, 'dues_lapsed', du)

    await drainUntilResolved(spaceId, bk)
    await drainUntilResolved(spaceId, du)

    expect(statusOf(spaceId, bk)).toBe('skipped')
    // billing is never muteable: it must NOT be skipped (no RESEND -> 'failed')
    expect(statusOf(spaceId, du)).not.toBe('skipped')
  })

  it('sends a muteable category when the member has no pref row (default on)', async () => {
    const { spaceId } = seedSpace()
    spaces.push(spaceId)
    const { memberId } = seedMember(spaceId, { role: 'member' })
    const bk = `bk2-${spaceId}`
    seedNotif(spaceId, memberId, 'booking_confirmed', bk)

    await drainUntilResolved(spaceId, bk)

    expect(statusOf(spaceId, bk)).not.toBe('skipped')
  })
})
