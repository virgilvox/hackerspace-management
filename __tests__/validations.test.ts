import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  flexibleDateTime,
  createTaskSchema,
  taskIdSchema,
  createProjectSchema,
  updateProjectStatusSchema,
  addMemberSchema,
  updateMemberSchema,
  createContactSchema,
  updateContactSchema,
  createKbEntrySchema,
  updateKbEntrySchema,
  createSecretSchema,
  logCashPaymentSchema,
  linkPaymentSchema,
  updateSpaceSettingsSchema,
  saveIntegrationSchema,
  upsertAreaLeadSchema,
  uuidSchema,
} from '@/lib/validations'

const VALID_UUID = '11111111-2222-3333-4444-555555555555'

describe('flexibleDateTime', () => {
  const schema = z.object({ when: flexibleDateTime().optional() })

  it('accepts a YYYY-MM-DD date-only string from <input type="date">', () => {
    const r = schema.safeParse({ when: '2026-05-22' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.when).toBe('2026-05-22T00:00:00.000Z')
    }
  })

  it('accepts a YYYY-MM-DDTHH:MM datetime-local string', () => {
    const r = schema.safeParse({ when: '2026-05-22T14:30' })
    expect(r.success).toBe(true)
    if (r.success && r.data.when) {
      // JS Date interprets "2026-05-22T14:30" as local time; the helper
      // outputs UTC ISO. We just assert it's a valid ISO datetime.
      expect(r.data.when).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    }
  })

  it('passes through a full RFC 3339 datetime unchanged', () => {
    const iso = '2026-05-22T14:30:00.000Z'
    const r = schema.safeParse({ when: iso })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.when).toBe(iso)
  })

  it('maps empty string to null (treats it as unset)', () => {
    const r = schema.safeParse({ when: '' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.when).toBeNull()
  })

  it('maps undefined to undefined / null', () => {
    const r = schema.safeParse({})
    expect(r.success).toBe(true)
  })

  it('rejects obvious garbage', () => {
    const r = schema.safeParse({ when: 'tomorrow at three' })
    expect(r.success).toBe(false)
  })
})

describe('createTaskSchema', () => {
  it('accepts minimal valid input', () => {
    const r = createTaskSchema.safeParse({ title: 'Fix laser cooling' })
    expect(r.success).toBe(true)
  })

  it('rejects empty title', () => {
    const r = createTaskSchema.safeParse({ title: '' })
    expect(r.success).toBe(false)
  })

  it('rejects title over 200 chars', () => {
    const r = createTaskSchema.safeParse({ title: 'x'.repeat(201) })
    expect(r.success).toBe(false)
  })

  it('accepts every database recurrence value, including biweekly', () => {
    for (const recurrence of ['none', 'daily', 'weekly', 'biweekly', 'monthly']) {
      const r = createTaskSchema.safeParse({ title: 'x', recurrence })
      expect(r.success, `recurrence=${recurrence}`).toBe(true)
    }
  })

  it('accepts due_date as YYYY-MM-DD (the bug fix from pass 9)', () => {
    const r = createTaskSchema.safeParse({ title: 'x', due_date: '2026-05-22' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.due_date).toBe('2026-05-22T00:00:00.000Z')
  })

  it('rejects unknown recurrence values', () => {
    const r = createTaskSchema.safeParse({ title: 'x', recurrence: 'fortnightly' })
    expect(r.success).toBe(false)
  })

  it('accepts task and chore as type, rejects other strings', () => {
    expect(createTaskSchema.safeParse({ title: 'x', type: 'task' }).success).toBe(true)
    expect(createTaskSchema.safeParse({ title: 'x', type: 'chore' }).success).toBe(true)
    expect(createTaskSchema.safeParse({ title: 'x', type: 'errand' }).success).toBe(false)
  })
})

describe('taskIdSchema', () => {
  it('accepts a valid UUID', () => {
    expect(taskIdSchema.safeParse(VALID_UUID).success).toBe(true)
  })
  it('rejects non-UUID strings', () => {
    expect(taskIdSchema.safeParse('not-a-uuid').success).toBe(false)
  })
})

describe('uuidSchema', () => {
  it('accepts a valid UUID', () => {
    expect(uuidSchema.safeParse(VALID_UUID).success).toBe(true)
  })
  it('rejects empty string', () => {
    expect(uuidSchema.safeParse('').success).toBe(false)
  })
})

describe('createProjectSchema', () => {
  it('accepts title only', () => {
    expect(createProjectSchema.safeParse({ title: 'Build CNC mount' }).success).toBe(true)
  })
  it('accepts optional tags', () => {
    expect(
      createProjectSchema.safeParse({ title: 'x', tags: ['fab', 'urgent'] }).success,
    ).toBe(true)
  })
})

describe('updateProjectStatusSchema', () => {
  it('accepts every real project_status enum value', () => {
    for (const status of ['backlog', 'in_progress', 'review', 'done', 'blocked']) {
      const r = updateProjectStatusSchema.safeParse({ projectId: VALID_UUID, status })
      expect(r.success, `status=${status}`).toBe(true)
    }
  })

  it('rejects legacy status names that the database does not have', () => {
    for (const status of ['planning', 'active', 'paused', 'completed', 'cancelled']) {
      const r = updateProjectStatusSchema.safeParse({ projectId: VALID_UUID, status })
      expect(r.success, `status=${status}`).toBe(false)
    }
  })

  it('rejects invalid projectId', () => {
    expect(
      updateProjectStatusSchema.safeParse({ projectId: 'nope', status: 'done' }).success,
    ).toBe(false)
  })
})

describe('addMemberSchema', () => {
  it('accepts the associate role (added in pass 2)', () => {
    const r = addMemberSchema.safeParse({
      email: 'a@b.com',
      display_name: 'Alex',
      role: 'associate',
      tier: 'basic',
    })
    expect(r.success).toBe(true)
  })

  it('rejects unknown role', () => {
    const r = addMemberSchema.safeParse({
      email: 'a@b.com',
      display_name: 'Alex',
      role: 'overlord',
      tier: 'basic',
    })
    expect(r.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const r = addMemberSchema.safeParse({
      email: 'not-an-email',
      display_name: 'Alex',
    })
    expect(r.success).toBe(false)
  })
})

describe('updateMemberSchema', () => {
  it('accepts a partial update with just memberId', () => {
    expect(
      updateMemberSchema.safeParse({ memberId: VALID_UUID }).success,
    ).toBe(true)
  })
  it('rejects unknown status', () => {
    expect(
      updateMemberSchema.safeParse({ memberId: VALID_UUID, status: 'banned' }).success,
    ).toBe(false)
  })
})

describe('createContactSchema', () => {
  it('accepts every database contact_type', () => {
    for (const t of ['vendor', 'supplier', 'partner', 'landlord', 'city']) {
      const r = createContactSchema.safeParse({ name: 'X', contact_type: t })
      expect(r.success, `contact_type=${t}`).toBe(true)
    }
  })
  it('rejects legacy contact_type values', () => {
    for (const t of ['sponsor', 'media', 'other']) {
      const r = createContactSchema.safeParse({ name: 'X', contact_type: t })
      expect(r.success, `contact_type=${t}`).toBe(false)
    }
  })
})

describe('updateContactSchema', () => {
  it('requires contactId', () => {
    expect(updateContactSchema.safeParse({ name: 'X' }).success).toBe(false)
  })
})

describe('createKbEntrySchema', () => {
  it('accepts the real visibility enum', () => {
    for (const v of ['all_members', 'board', 'admin_only']) {
      const r = createKbEntrySchema.safeParse({ title: 't', content: 'c', visibility: v })
      expect(r.success, `visibility=${v}`).toBe(true)
    }
  })
  it('rejects legacy visibility values', () => {
    for (const v of ['public', 'members', 'admin']) {
      const r = createKbEntrySchema.safeParse({ title: 't', content: 'c', visibility: v })
      expect(r.success, `visibility=${v}`).toBe(false)
    }
  })
  it('defaults visibility to all_members', () => {
    const r = createKbEntrySchema.safeParse({ title: 't', content: 'c' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.visibility).toBe('all_members')
  })
})

describe('updateKbEntrySchema', () => {
  it('requires entryId', () => {
    expect(updateKbEntrySchema.safeParse({ title: 't' }).success).toBe(false)
  })
})

describe('createSecretSchema', () => {
  it('requires title and value', () => {
    expect(createSecretSchema.safeParse({ title: 't', value: 'v' }).success).toBe(true)
    expect(createSecretSchema.safeParse({ title: 't' }).success).toBe(false)
    expect(createSecretSchema.safeParse({ value: 'v' }).success).toBe(false)
  })
})

describe('logCashPaymentSchema', () => {
  it('accepts a positive amount and a non-empty note', () => {
    const r = logCashPaymentSchema.safeParse({ amount: 25, from_note: 'May dues' })
    expect(r.success).toBe(true)
  })
  it('rejects zero or negative amounts', () => {
    expect(logCashPaymentSchema.safeParse({ amount: 0, from_note: 'x' }).success).toBe(false)
    expect(logCashPaymentSchema.safeParse({ amount: -5, from_note: 'x' }).success).toBe(false)
  })
  it('member_id must be a UUID if present', () => {
    expect(
      logCashPaymentSchema.safeParse({ amount: 1, from_note: 'x', member_id: 'nope' }).success,
    ).toBe(false)
    expect(
      logCashPaymentSchema.safeParse({ amount: 1, from_note: 'x', member_id: VALID_UUID }).success,
    ).toBe(true)
  })
})

describe('linkPaymentSchema', () => {
  it('requires both UUIDs', () => {
    expect(
      linkPaymentSchema.safeParse({ paymentId: VALID_UUID, memberId: VALID_UUID }).success,
    ).toBe(true)
    expect(linkPaymentSchema.safeParse({ paymentId: 'x', memberId: VALID_UUID }).success).toBe(false)
  })
})

describe('updateSpaceSettingsSchema', () => {
  it('accepts a partial update', () => {
    expect(updateSpaceSettingsSchema.safeParse({ name: 'New name' }).success).toBe(true)
  })
  it('enforces slug character set when slug is present', () => {
    expect(updateSpaceSettingsSchema.safeParse({ slug: 'good-slug' }).success).toBe(false)
    expect(updateSpaceSettingsSchema.safeParse({ slug: 'goodslug' }).success).toBe(true)
  })
})

describe('saveIntegrationSchema', () => {
  it('requires platform and a config record', () => {
    expect(
      saveIntegrationSchema.safeParse({ platform: 'paypal', config: { client_id: 'x' } }).success,
    ).toBe(true)
    expect(saveIntegrationSchema.safeParse({ platform: 'paypal' }).success).toBe(false)
  })
})

describe('upsertAreaLeadSchema', () => {
  it('accepts the real area_lead_status values', () => {
    for (const s of ['active', 'vacant', 'handoff']) {
      const r = upsertAreaLeadSchema.safeParse({
        area_code: 'LASER',
        area_name: 'Laser',
        status: s,
      })
      expect(r.success, `status=${s}`).toBe(true)
    }
  })
  it('rejects unknown status', () => {
    const r = upsertAreaLeadSchema.safeParse({
      area_code: 'LASER',
      area_name: 'Laser',
      status: 'pending',
    })
    expect(r.success).toBe(false)
  })
})
