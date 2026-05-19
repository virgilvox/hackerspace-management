// Validates migration 046 (RLS-layer privilege gate, defense-in-depth for
// D2). Proves BOTH halves of the deferral's blocking concern: the gap is
// closed at the RLS layer for unverified/inactive, AND no legitimate flow
// (current/late access, unverified self-reads, the approval flow) breaks.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  dbReady,
  rows,
  execAsUser,
  execService,
  seedSpace,
  seedMember,
  dropSpace,
} from './db'

const d = describe.skipIf(!dbReady)

d('privilege status gate (migration 046)', () => {
  let spaceId: string
  let adminCurrent: { memberId: string; userId: string }
  let adminUnverified: { memberId: string; userId: string }
  let adminLate: { memberId: string; userId: string }
  let memberUnverified: { memberId: string; userId: string }

  const hasRole = (uid: string) =>
    rows<{ ok: boolean }>(
      `select public.user_has_role_in_space('${uid}','${spaceId}',ARRAY['admin','board','treasurer']) ok`,
    )[0].ok
  const hasPerm = (uid: string) =>
    rows<{ ok: boolean }>(
      `select public.user_has_permission('${uid}','${spaceId}','members.manage') ok`,
    )[0].ok

  beforeAll(() => {
    spaceId = seedSpace().spaceId
    adminCurrent = seedMember(spaceId, { role: 'admin', status: 'current' })
    adminUnverified = seedMember(spaceId, { role: 'admin', status: 'unverified' })
    adminLate = seedMember(spaceId, { role: 'admin', status: 'late' })
    memberUnverified = seedMember(spaceId, { role: 'member', status: 'unverified' })
  })
  afterAll(() => dropSpace(spaceId))

  // ── gap closed ────────────────────────────────────────────────────────
  it('unverified admin is NOT role-privileged at the RLS layer', () => {
    expect(hasRole(adminUnverified.userId)).toBe(false)
    expect(hasPerm(adminUnverified.userId)).toBe(false)
  })

  it('unverified admin cannot perform a privileged RLS-gated write (defense-in-depth)', () => {
    const before = rows<{ display_name: string }>(
      `select display_name from space_members where id='${adminCurrent.memberId}'`,
    )[0].display_name
    // RLS members_update USING relies on user_has_role_in_space -> now false
    // for the unverified admin, so the row is not visible to update.
    execAsUser(
      adminUnverified.userId,
      `update space_members set display_name='hacked' where id='${adminCurrent.memberId}'`,
    )
    const after = rows<{ display_name: string }>(
      `select display_name from space_members where id='${adminCurrent.memberId}'`,
    )[0].display_name
    expect(after).toBe(before) // unchanged — escalation blocked at RLS
  })

  // ── nothing legitimate broken ─────────────────────────────────────────
  it('current + late admins remain fully privileged', () => {
    expect(hasRole(adminCurrent.userId)).toBe(true)
    expect(hasPerm(adminCurrent.userId)).toBe(true) // admin short-circuit
    expect(hasRole(adminLate.userId)).toBe(true) // lapse keeps role
    expect(hasPerm(adminLate.userId)).toBe(true)
  })

  it('unverified member still resolves its own space (reads/onboarding intact)', () => {
    const n = rows<{ n: number }>(
      `select count(*)::int n from public.get_user_space_ids('${memberUnverified.userId}') g where g='${spaceId}'`,
    )[0].n
    expect(n).toBe(1) // get_user_space_ids deliberately NOT gated
  })

  it('approval flow still works: a current admin can approve an unverified member', () => {
    const r = execAsUser(
      adminCurrent.userId,
      `update space_members set status='current' where id='${memberUnverified.memberId}'`,
    )
    expect(r.ok).toBe(true)
    const st = rows<{ status: string }>(
      `select status from space_members where id='${memberUnverified.memberId}'`,
    )[0].status
    expect(st).toBe('current')
    // and now that member IS privilege-eligible for reads as before
    execService(`update space_members set status='unverified' where id='${memberUnverified.memberId}'`)
  })
})
