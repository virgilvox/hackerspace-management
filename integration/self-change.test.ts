// Validates the self-escalation guards: migration 044
// (prevent_member_self_role_change blocks self-edit of role/status AND the
// payment/dues columns) and migration 043 (members_update WITH CHECK blocks
// a privileged caller moving a row cross-space). Exercised through the real
// RLS/trigger path (role `authenticated` + request.jwt.claims.sub).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { dbReady, execService, execAsUser, seedSpace, seedMember, dropSpace, uuid } from './db'

const d = describe.skipIf(!dbReady)

d('self-change trigger (044) + members_update WITH CHECK (043)', () => {
  let spaceId: string
  let member: { memberId: string; userId: string }
  let admin: { memberId: string; userId: string }

  beforeAll(() => {
    spaceId = seedSpace().spaceId
    member = seedMember(spaceId, { role: 'member', status: 'current' })
    admin = seedMember(spaceId, { role: 'admin', status: 'current' })
  })
  afterAll(() => dropSpace(spaceId))

  it('member CANNOT self-escalate role', () => {
    const r = execAsUser(
      member.userId,
      `update space_members set role='admin' where id='${member.memberId}'`,
    )
    expect(r.ok).toBe(false)
    expect(r.err).toMatch(/42501|cannot change/i)
  })

  it('member CANNOT self-edit a payment/dues column (044)', () => {
    const r = execAsUser(
      member.userId,
      `update space_members set payment_status='paid' where id='${member.memberId}'`,
    )
    expect(r.ok).toBe(false)
    expect(r.err).toMatch(/42501|cannot change/i)
  })

  it('member CAN self-edit an allowed profile column', () => {
    const r = execAsUser(
      member.userId,
      `update space_members set display_name='renamed' where id='${member.memberId}'`,
    )
    expect(r.ok).toBe(true)
  })

  it('service path (no JWT) bypasses the trigger — the Stripe webhook path', () => {
    const r = execService(
      `update space_members set status='late', last_paid_at=now() where id='${member.memberId}'`,
    )
    expect(r.ok).toBe(true)
  })

  it('members_update WITH CHECK blocks a privileged cross-space move (043)', () => {
    const r = execAsUser(
      admin.userId,
      `update space_members set space_id='${uuid()}' where id='${member.memberId}'`,
    )
    expect(r.ok).toBe(false) // RLS WITH CHECK (or FK) rejects the post-image
  })
})
