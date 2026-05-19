// Validates migration 042: the GiST exclusion constraint
// equipment_reservations_no_overlap is the real concurrency arbiter (the app
// check-then-insert was a TOCTOU). Only 'reserved' rows conflict; tstzrange
// '[)' makes adjacent windows non-overlapping.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { dbReady, execService, seedSpace, seedMember, seedEquipment, dropSpace } from './db'

const d = describe.skipIf(!dbReady)

d('equipment_reservations_no_overlap (migration 042)', () => {
  let spaceId: string, equipmentId: string, memberId: string
  const T = `timestamptz '2026-09-01 18:00:00+00'`

  beforeAll(() => {
    spaceId = seedSpace().spaceId
    equipmentId = seedEquipment(spaceId).equipmentId
    memberId = seedMember(spaceId).memberId
  })
  afterAll(() => dropSpace(spaceId))

  const ins = (startOffH: number, endOffH: number, status = 'reserved') =>
    execService(
      `insert into equipment_reservations (equipment_id, space_id, member_id, starts_at, ends_at, status)
       values ('${equipmentId}','${spaceId}','${memberId}',
               ${T} + interval '${startOffH} hours', ${T} + interval '${endOffH} hours', '${status}');`,
    )

  it('accepts a first reservation [0h,2h)', () => {
    expect(ins(0, 2).ok).toBe(true)
  })

  it('REJECTS an overlapping reserved [1h,3h) (23P01)', () => {
    const r = ins(1, 3)
    expect(r.ok).toBe(false)
    expect(r.err).toMatch(/exclusion constraint|equipment_reservations_no_overlap|23P01/i)
  })

  it('allows an overlapping CANCELLED row (only reserved conflicts)', () => {
    expect(ins(1, 3, 'cancelled').ok).toBe(true)
  })

  it('allows an ADJACENT reserved [2h,4h) (tstzrange [) — no overlap)', () => {
    expect(ins(2, 4).ok).toBe(true)
  })

  it('a different equipment is unaffected', () => {
    const e2 = seedEquipment(spaceId).equipmentId
    expect(
      execService(
        `insert into equipment_reservations (equipment_id, space_id, member_id, starts_at, ends_at, status)
         values ('${e2}','${spaceId}','${memberId}', ${T}, ${T} + interval '2 hours','reserved');`,
      ).ok,
    ).toBe(true)
  })
})
