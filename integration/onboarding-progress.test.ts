// Validates migration 055 (mark_onboarding_step_done) against a real Postgres:
// the atomic dedup-append into space_members.onboarding_progress that replaces
// the old read-modify-write in markOnboardingStepDone (deferred bug L3). The
// central case is CONCURRENCY: many simultaneous completions must all survive —
// the previous SELECT-then-UPDATE could silently drop steps under a lost update.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import {
  dbReady,
  DB_URL,
  rows,
  execService,
  execAsUser,
  seedSpace,
  seedMember,
  dropSpace,
  uuid,
} from './db'

const execFileP = promisify(execFile)
const d = describe.skipIf(!dbReady)

d('mark_onboarding_step_done (migration 055)', () => {
  let spaceId: string

  beforeAll(() => {
    spaceId = seedSpace().spaceId
  })
  afterAll(() => dropSpace(spaceId))

  // Completed step ids as the app stores/reads them: onboarding_progress
  // -> completed_step_ids (a jsonb string array), or [] when unset.
  function completedSteps(memberId: string): string[] {
    const r = rows<{ ids: string[] | null }>(
      `select (onboarding_progress -> 'completed_step_ids') as ids
         from space_members where id = '${memberId}'`,
    )
    return (r[0]?.ids as string[] | null) ?? []
  }

  const markService = (memberId: string, stepId: string) =>
    execService(`select mark_onboarding_step_done('${memberId}', '${stepId}')`)

  it('dedup-appends and is idempotent', () => {
    const { memberId } = seedMember(spaceId)
    const a = uuid()
    const b = uuid()
    expect(markService(memberId, a).ok).toBe(true)
    expect(markService(memberId, b).ok).toBe(true)
    expect(markService(memberId, a).ok).toBe(true) // repeat -> no-op

    const ids = completedSteps(memberId)
    expect([...ids].sort()).toEqual([a, b].sort())
    expect(ids).toHaveLength(2) // 'a' not duplicated
  })

  it('preserves other keys already in onboarding_progress', () => {
    const { memberId } = seedMember(spaceId)
    execService(
      `update space_members set onboarding_progress = '{"foo":"bar"}'::jsonb where id = '${memberId}'`,
    )
    const a = uuid()
    markService(memberId, a)

    const r = rows<{ p: { foo?: string; completed_step_ids?: string[] } }>(
      `select onboarding_progress as p from space_members where id = '${memberId}'`,
    )
    expect(r[0].p.foo).toBe('bar')
    expect(r[0].p.completed_step_ids).toEqual([a])
  })

  it('concurrent completions never lose an update (the L3 fix)', async () => {
    const { memberId } = seedMember(spaceId)
    const steps = Array.from({ length: 12 }, () => uuid())

    // Fire every append at once through separate psql connections. The old
    // read-modify-write would have interleaved SELECTs and dropped steps; the
    // single-statement atomic UPDATE serializes on the row lock so all survive.
    await Promise.all(
      steps.map(s =>
        execFileP('psql', [
          DB_URL,
          '-v',
          'ON_ERROR_STOP=1',
          '-tAc',
          `select mark_onboarding_step_done('${memberId}', '${s}')`,
        ]),
      ),
    )

    const ids = completedSteps(memberId)
    expect([...ids].sort()).toEqual([...steps].sort()) // all 12 present, none lost
  })

  it('ownership: with a JWT a member can only complete steps on their OWN row', () => {
    const owner = seedMember(spaceId)
    const other = seedMember(spaceId)
    const step = uuid()

    // `other`, acting as a logged-in user, aims the RPC at `owner`'s row.
    // auth.uid() != owner.user_id -> the WHERE matches nothing -> no-op.
    execAsUser(other.userId, `select mark_onboarding_step_done('${owner.memberId}', '${step}')`)
    expect(completedSteps(owner.memberId)).toEqual([])

    // The owner completing their own step works.
    execAsUser(owner.userId, `select mark_onboarding_step_done('${owner.memberId}', '${step}')`)
    expect(completedSteps(owner.memberId)).toEqual([step])
  })
})
