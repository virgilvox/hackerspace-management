import { describe, it, expect } from 'vitest'
import {
  createFormSchema,
  updateFormSchema,
  submitFormSchema,
  setFormStatusSchema,
  formIdSchema,
  linkSubmissionsSchema,
  getPublicFormSchema,
  formSlug,
  formSchemaArray,
  formFieldSchema,
  formFieldTypes,
  onboardingStepTypeSchema,
  createOnboardingStepSchema,
} from '@/lib/validations'
import { parseFormSchema, validateAnswers, type FormField } from '@/lib/forms-schema'
import {
  csvCell,
  parseClientIp,
  shouldBumpFormVersion,
  evaluateRequiredFormStep,
  slugify,
  deriveFieldKeys,
  escapeLike,
  pickMemberForEmail,
} from '@/lib/forms-logic'
import { INVITE_ROLES, isInviteRole, canAssignInviteRole } from '@/lib/invite-logic'
import { createInviteSchema, updateInviteSchema } from '@/lib/validations'

// ─── formSlug ────────────────────────────────────────────────────────────────

describe('formSlug', () => {
  it('accepts valid slugs', () => {
    for (const s of ['a', 'ab', 'a1', '1a', 'a-b', 'liability-waiver-2026', '0']) {
      expect(formSlug.safeParse(s).success, s).toBe(true)
    }
  })
  it('accepts an 80-char slug and rejects 81', () => {
    expect(formSlug.safeParse('a'.repeat(80)).success).toBe(true)
    expect(formSlug.safeParse('a'.repeat(81)).success).toBe(false)
  })
  it('rejects invalid slugs', () => {
    for (const s of ['', 'A', 'aB', 'a_b', '-a', 'a-', ' a', 'a b', 'a.b', 'café']) {
      expect(formSlug.safeParse(s).success, s).toBe(false)
    }
  })
})

// ─── formFieldSchema ─────────────────────────────────────────────────────────

describe('formFieldSchema', () => {
  it('accepts a minimal text field and defaults required to false', () => {
    const r = formFieldSchema.safeParse({ key: 'name', type: 'short_text', label: 'Name' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.required).toBe(false)
  })
  it('requires options for select and radio', () => {
    expect(formFieldSchema.safeParse({ key: 'a', type: 'select', label: 'A' }).success).toBe(false)
    expect(formFieldSchema.safeParse({ key: 'a', type: 'radio', label: 'A' }).success).toBe(false)
    expect(
      formFieldSchema.safeParse({ key: 'a', type: 'select', label: 'A', options: ['x'] }).success,
    ).toBe(true)
  })
  it('enforces the key character set and length', () => {
    expect(formFieldSchema.safeParse({ key: 'Bad Key', type: 'short_text', label: 'L' }).success).toBe(false)
    expect(formFieldSchema.safeParse({ key: '', type: 'short_text', label: 'L' }).success).toBe(false)
    expect(formFieldSchema.safeParse({ key: 'a'.repeat(61), type: 'short_text', label: 'L' }).success).toBe(false)
    expect(formFieldSchema.safeParse({ key: 'ok_key1', type: 'short_text', label: 'L' }).success).toBe(true)
  })
  it('requires a non-empty label within length', () => {
    expect(formFieldSchema.safeParse({ key: 'k', type: 'short_text', label: '' }).success).toBe(false)
    expect(formFieldSchema.safeParse({ key: 'k', type: 'short_text', label: 'x'.repeat(201) }).success).toBe(false)
  })
  it('every declared field type parses', () => {
    for (const t of formFieldTypes) {
      const base: Record<string, unknown> = { key: 'k', type: t, label: 'L' }
      if (t === 'select' || t === 'radio') base.options = ['o1']
      expect(formFieldSchema.safeParse(base).success, t).toBe(true)
    }
  })
})

// ─── formSchemaArray ─────────────────────────────────────────────────────────

describe('formSchemaArray', () => {
  it('accepts an empty array', () => {
    expect(formSchemaArray.safeParse([]).success).toBe(true)
  })
  it('rejects duplicate field keys', () => {
    const r = formSchemaArray.safeParse([
      { key: 'a', type: 'short_text', label: 'A' },
      { key: 'a', type: 'short_text', label: 'A2' },
    ])
    expect(r.success).toBe(false)
  })
  it('rejects more than 200 fields', () => {
    const mk = (n: number) => ({ key: `k${n}`, type: 'short_text', label: `L${n}` })
    expect(formSchemaArray.safeParse(Array.from({ length: 200 }, (_, i) => mk(i))).success).toBe(true)
    expect(formSchemaArray.safeParse(Array.from({ length: 201 }, (_, i) => mk(i))).success).toBe(false)
  })
  it('propagates an inner field error', () => {
    const r = formSchemaArray.safeParse([{ key: 'a', type: 'select', label: 'A' }])
    expect(r.success).toBe(false)
  })
})

// ─── createFormSchema ────────────────────────────────────────────────────────

describe('createFormSchema', () => {
  it('applies defaults', () => {
    const r = createFormSchema.safeParse({ slug: 'waiver', title: 'Waiver' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.kind).toBe('form')
      expect(r.data.visibility).toBe('members')
      expect(r.data.schema).toEqual([])
    }
  })
  it('rejects bad enums', () => {
    expect(createFormSchema.safeParse({ slug: 'a', title: 'T', kind: 'survey' }).success).toBe(false)
    expect(createFormSchema.safeParse({ slug: 'a', title: 'T', visibility: 'world' }).success).toBe(false)
  })
  it('rejects an empty or oversized title', () => {
    expect(createFormSchema.safeParse({ slug: 'a', title: '' }).success).toBe(false)
    expect(createFormSchema.safeParse({ slug: 'a', title: 'x'.repeat(201) }).success).toBe(false)
  })
  it('bounds legal_text to 100000 chars', () => {
    expect(createFormSchema.safeParse({ slug: 'a', title: 'T', legal_text: 'x'.repeat(100000) }).success).toBe(true)
    expect(createFormSchema.safeParse({ slug: 'a', title: 'T', legal_text: 'x'.repeat(100001) }).success).toBe(false)
  })
  it('propagates slug and nested field errors', () => {
    expect(createFormSchema.safeParse({ slug: 'BAD', title: 'T' }).success).toBe(false)
    expect(
      createFormSchema.safeParse({ slug: 'a', title: 'T', schema: [{ key: 'q', type: 'select', label: 'Q' }] }).success,
    ).toBe(false)
  })
})

// ─── updateFormSchema ────────────────────────────────────────────────────────

describe('updateFormSchema', () => {
  const ID = '11111111-1111-1111-1111-111111111111'
  it('requires a valid formId', () => {
    expect(updateFormSchema.safeParse({}).success).toBe(false)
    expect(updateFormSchema.safeParse({ formId: 'nope' }).success).toBe(false)
    expect(updateFormSchema.safeParse({ formId: ID }).success).toBe(true)
  })
  it('strips a slug change (slug is immutable post-create)', () => {
    const r = updateFormSchema.safeParse({ formId: ID, slug: 'new-slug' })
    expect(r.success).toBe(true)
    if (r.success) expect('slug' in r.data).toBe(false)
  })
  it('validates schema when provided', () => {
    expect(
      updateFormSchema.safeParse({ formId: ID, schema: [{ key: 'a', type: 'radio', label: 'A' }] }).success,
    ).toBe(false)
  })
})

// ─── status / id / link / public schemas ─────────────────────────────────────

describe('setFormStatusSchema / formIdSchema', () => {
  const ID = '11111111-1111-1111-1111-111111111111'
  it('accepts the three statuses, rejects others', () => {
    for (const s of ['draft', 'published', 'closed']) {
      expect(setFormStatusSchema.safeParse({ formId: ID, status: s }).success, s).toBe(true)
    }
    expect(setFormStatusSchema.safeParse({ formId: ID, status: 'archived' }).success).toBe(false)
    expect(setFormStatusSchema.safeParse({ formId: 'x', status: 'draft' }).success).toBe(false)
  })
  it('formIdSchema requires a uuid', () => {
    expect(formIdSchema.safeParse({ formId: ID }).success).toBe(true)
    expect(formIdSchema.safeParse({ formId: 'x' }).success).toBe(false)
    expect(formIdSchema.safeParse({}).success).toBe(false)
  })
})

describe('linkSubmissionsSchema', () => {
  const ID = '11111111-1111-1111-1111-111111111111'
  it('requires a uuid memberId and normalizes the email', () => {
    expect(linkSubmissionsSchema.safeParse({ memberId: 'x', email: 'a@b.com' }).success).toBe(false)
    expect(linkSubmissionsSchema.safeParse({ memberId: ID }).success).toBe(false)
    const r = linkSubmissionsSchema.safeParse({ memberId: ID, email: 'Foo@Bar.COM' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('foo@bar.com')
  })
})

describe('getPublicFormSchema', () => {
  it('requires both a space and a valid form slug', () => {
    expect(getPublicFormSchema.safeParse({ space: 'heatsynclabs', slug: 'a-form' }).success).toBe(true)
    expect(getPublicFormSchema.safeParse({ slug: 'a-form' }).success).toBe(false)
    expect(getPublicFormSchema.safeParse({ space: 'heatsynclabs' }).success).toBe(false)
    expect(getPublicFormSchema.safeParse({ space: 'heatsynclabs', slug: 'Bad' }).success).toBe(false)
    expect(getPublicFormSchema.safeParse({ space: '', slug: 'a-form' }).success).toBe(false)
  })
})

// ─── submitFormSchema ────────────────────────────────────────────────────────

describe('submitFormSchema', () => {
  const ID = '11111111-1111-1111-1111-111111111111'
  it('requires a valid formId (slug is no longer accepted post-028)', () => {
    expect(submitFormSchema.safeParse({ answers: {} }).success).toBe(false)
    expect(submitFormSchema.safeParse({ slug: 'a', answers: {} }).success).toBe(false)
    expect(submitFormSchema.safeParse({ formId: 'nope' }).success).toBe(false)
    expect(submitFormSchema.safeParse({ formId: ID }).success).toBe(true)
  })
  it('defaults answers to an empty object', () => {
    const r = submitFormSchema.safeParse({ formId: ID })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.answers).toEqual({})
  })
  it('email is optional/nullable and normalized; consent is boolean', () => {
    expect(submitFormSchema.safeParse({ formId: ID, email: null }).success).toBe(true)
    expect(submitFormSchema.safeParse({ formId: ID, email: 'not-an-email' }).success).toBe(false)
    const r = submitFormSchema.safeParse({ formId: ID, email: 'Me@Example.COM', consent: true })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.email).toBe('me@example.com')
    expect(submitFormSchema.safeParse({ formId: ID, consent: 'yes' }).success).toBe(false)
  })
})

// ─── onboarding form step ────────────────────────────────────────────────────

describe('onboarding form step contract', () => {
  it('onboardingStepTypeSchema accepts "form" and rejects unknown', () => {
    expect(onboardingStepTypeSchema.safeParse('form').success).toBe(true)
    expect(onboardingStepTypeSchema.safeParse('content').success).toBe(true)
    expect(onboardingStepTypeSchema.safeParse('quiz').success).toBe(false)
  })
  it('createOnboardingStepSchema accepts a form step with config and rejects no title', () => {
    expect(
      createOnboardingStepSchema.safeParse({
        step_type: 'form',
        title: 'Sign the waiver',
        config: { form_id: '11111111-1111-1111-1111-111111111111' },
      }).success,
    ).toBe(true)
    expect(createOnboardingStepSchema.safeParse({ step_type: 'form', title: '' }).success).toBe(false)
  })
})

// ─── validateAnswers (server-side input boundary) ────────────────────────────

const fields: FormField[] = [
  { key: 'name', type: 'short_text', label: 'Name', required: true },
  { key: 'bio', type: 'long_text', label: 'Bio', required: false },
  { key: 'mail', type: 'email', label: 'Email', required: false },
  { key: 'age', type: 'number', label: 'Age', required: false },
  { key: 'dob', type: 'date', label: 'DOB', required: false },
  { key: 'agree', type: 'checkbox', label: 'Agree', required: true },
  { key: 'news', type: 'checkbox', label: 'News', required: false },
  { key: 'size', type: 'select', label: 'Size', required: false, options: ['S', 'M'] },
  { key: 'pick', type: 'radio', label: 'Pick', required: false, options: ['x', 'y'] },
]

describe('validateAnswers', () => {
  it('errors on a missing required field, naming it', () => {
    const r = validateAnswers(fields, { agree: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Name/)
  })

  it('reports the FIRST failing field by schema order, not a later one', () => {
    // name (field 0) has a wrong type and agree (field 5) is unchecked; the
    // error must be about Name, proving evaluation stops at the first failure.
    const r = validateAnswers(fields, { name: 123, agree: false })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toMatch(/Name/)
      expect(r.error).not.toMatch(/Agree/)
    }
  })

  it('requires a checked required checkbox', () => {
    const r = validateAnswers(fields, { name: 'A', agree: false })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Agree/)
  })

  it('accepts truthy checkbox encodings and stores a boolean', () => {
    for (const v of [true, 'true', 'on', 1]) {
      const r = validateAnswers(fields, { name: 'A', agree: v })
      expect(r.ok, String(v)).toBe(true)
      if (r.ok) expect(r.value.agree).toBe(true)
    }
  })

  it('stores an unchecked non-required checkbox as false, omits when absent', () => {
    const r1 = validateAnswers(fields, { name: 'A', agree: true, news: false })
    expect(r1.ok).toBe(true)
    if (r1.ok) expect(r1.value.news).toBe(false)
    const r2 = validateAnswers(fields, { name: 'A', agree: true })
    expect(r2.ok).toBe(true)
    if (r2.ok) expect('news' in r2.value).toBe(false)
  })

  it('trims text and enforces max lengths', () => {
    const ok = validateAnswers(fields, { name: '  Ada  ', agree: true })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.value.name).toBe('Ada')
    expect(validateAnswers(fields, { name: 'x'.repeat(2001), agree: true }).ok).toBe(false)
    expect(validateAnswers(fields, { name: 'A', agree: true, bio: 'x'.repeat(20001) }).ok).toBe(false)
  })

  it('rejects a non-string for a text field', () => {
    expect(validateAnswers(fields, { name: 123, agree: true }).ok).toBe(false)
  })

  it('validates and normalizes email', () => {
    const ok = validateAnswers(fields, { name: 'A', agree: true, mail: '  USER@Example.COM  ' })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.value.mail).toBe('user@example.com')
    expect(validateAnswers(fields, { name: 'A', agree: true, mail: 'bogus' }).ok).toBe(false)
  })

  it('coerces numbers and rejects non-numeric', () => {
    const ok = validateAnswers(fields, { name: 'A', agree: true, age: '42' })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.value.age).toBe(42)
    expect(validateAnswers(fields, { name: 'A', agree: true, age: 'abc' }).ok).toBe(false)
    const e = validateAnswers(fields, { name: 'A', agree: true, age: '1e3' })
    if (e.ok) expect(e.value.age).toBe(1000)
  })

  it('validates dates', () => {
    expect(validateAnswers(fields, { name: 'A', agree: true, dob: '2026-05-16' }).ok).toBe(true)
    expect(validateAnswers(fields, { name: 'A', agree: true, dob: 'not-a-date' }).ok).toBe(false)
    expect(validateAnswers(fields, { name: 'A', agree: true, dob: 99 }).ok).toBe(false)
  })

  it('enforces select/radio membership', () => {
    expect(validateAnswers(fields, { name: 'A', agree: true, size: 'XL' }).ok).toBe(false)
    expect(validateAnswers(fields, { name: 'A', agree: true, pick: 'z' }).ok).toBe(false)
    const ok = validateAnswers(fields, { name: 'A', agree: true, size: 'M', pick: 'x' })
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.value.size).toBe('M')
      expect(ok.value.pick).toBe('x')
    }
  })

  it('discards unknown keys (no arbitrary jsonb injection)', () => {
    const r = validateAnswers(fields, { name: 'A', agree: true, __proto__pollute: 1, evil: 'x' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect('evil' in r.value).toBe(false)
      expect(Object.keys(r.value).sort()).toEqual(['agree', 'name'])
    }
  })
})

// ─── parseFormSchema ─────────────────────────────────────────────────────────

describe('parseFormSchema', () => {
  it('round-trips a valid schema and applies the required default', () => {
    const out = parseFormSchema([{ key: 'a', type: 'short_text', label: 'A' }])
    expect(out).toHaveLength(1)
    expect(out[0].required).toBe(false)
  })
  it('returns [] for anything malformed', () => {
    expect(parseFormSchema('not an array')).toEqual([])
    expect(parseFormSchema(null)).toEqual([])
    expect(parseFormSchema([{ key: 'a' }])).toEqual([])
    expect(parseFormSchema([{ key: 'a', type: 'select', label: 'A' }])).toEqual([])
  })
  it('strips unknown properties on a field', () => {
    const out = parseFormSchema([{ key: 'a', type: 'short_text', label: 'A', danger: 'x' }])
    expect(out).toHaveLength(1)
    expect('danger' in out[0]).toBe(false)
  })
})

// ─── csvCell ─────────────────────────────────────────────────────────────────

describe('csvCell', () => {
  it('blanks null/undefined', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })
  it('passes plain strings and numbers through', () => {
    expect(csvCell('abc')).toBe('abc')
    expect(csvCell(5)).toBe('5')
    expect(csvCell(true)).toBe('true')
  })
  it('quotes and escapes commas, quotes, and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('a"b')).toBe('"a""b"')
    expect(csvCell('a\nb')).toBe('"a\nb"')
    expect(csvCell('a\r')).toBe('"a\r"')
  })
  it('JSON-encodes objects and quotes them when needed', () => {
    expect(csvCell({ x: 1 })).toBe('"{""x"":1}"')
    expect(csvCell([1, 2])).toBe('"[1,2]"')
  })
})

// ─── parseClientIp ───────────────────────────────────────────────────────────

describe('parseClientIp', () => {
  it('takes the first XFF entry, trimmed', () => {
    expect(parseClientIp('1.2.3.4, 5.6.7.8', null)).toBe('1.2.3.4')
    expect(parseClientIp(' 9.9.9.9 ', null)).toBe('9.9.9.9')
  })
  it('prefers XFF over x-real-ip and falls back when XFF absent', () => {
    expect(parseClientIp('1.1.1.1', '2.2.2.2')).toBe('1.1.1.1')
    expect(parseClientIp(null, '2.2.2.2')).toBe('2.2.2.2')
  })
  it('returns null for nothing or junk', () => {
    expect(parseClientIp(null, null)).toBe(null)
    expect(parseClientIp('not an ip!', null)).toBe(null)
    expect(parseClientIp('x'.repeat(50), null)).toBe(null)
  })
  it('accepts an ipv6-shaped token', () => {
    expect(parseClientIp('::1', null)).toBe('::1')
  })
})

// ─── shouldBumpFormVersion ───────────────────────────────────────────────────

describe('shouldBumpFormVersion', () => {
  it('bumps only a published waiver whose legal text or schema changed', () => {
    expect(shouldBumpFormVersion({ kind: 'waiver', status: 'published', legalChanged: true, schemaChanged: false })).toBe(true)
    expect(shouldBumpFormVersion({ kind: 'waiver', status: 'published', legalChanged: false, schemaChanged: true })).toBe(true)
    expect(shouldBumpFormVersion({ kind: 'waiver', status: 'published', legalChanged: false, schemaChanged: false })).toBe(false)
    expect(shouldBumpFormVersion({ kind: 'form', status: 'published', legalChanged: true, schemaChanged: true })).toBe(false)
    expect(shouldBumpFormVersion({ kind: 'waiver', status: 'draft', legalChanged: true, schemaChanged: true })).toBe(false)
    expect(shouldBumpFormVersion({ kind: 'waiver', status: 'closed', legalChanged: true, schemaChanged: true })).toBe(false)
  })
})

// ─── evaluateRequiredFormStep ────────────────────────────────────────────────

describe('evaluateRequiredFormStep', () => {
  it('blocks a required non-form step', () => {
    expect(
      evaluateRequiredFormStep({ stepType: 'content', formId: null, formPublished: false, submissionExists: false }),
    ).toBe('block')
  })
  it('passes a form step with no configured form (misconfig is non-blocking)', () => {
    expect(
      evaluateRequiredFormStep({ stepType: 'form', formId: undefined, formPublished: false, submissionExists: false }),
    ).toBe('pass')
  })
  it('passes a form step whose form is missing/unpublished (fail open)', () => {
    expect(
      evaluateRequiredFormStep({ stepType: 'form', formId: 'f1', formPublished: false, submissionExists: false }),
    ).toBe('pass')
  })
  it('blocks a published required form with no submission', () => {
    expect(
      evaluateRequiredFormStep({ stepType: 'form', formId: 'f1', formPublished: true, submissionExists: false }),
    ).toBe('block')
  })
  it('passes (auto-satisfy) when a submission exists', () => {
    expect(
      evaluateRequiredFormStep({ stepType: 'form', formId: 'f1', formPublished: true, submissionExists: true }),
    ).toBe('pass')
  })
})

// ─── slugify / deriveFieldKeys ───────────────────────────────────────────────

describe('invite role policy', () => {
  it('INVITE_ROLES is the member_role set; isInviteRole guards it', () => {
    expect([...INVITE_ROLES].sort()).toEqual(
      ['admin', 'associate', 'board', 'member', 'treasurer'].sort(),
    )
    expect(isInviteRole('admin')).toBe(true)
    expect(isInviteRole('superuser')).toBe(false)
    expect(isInviteRole('')).toBe(false)
  })

  it('admin may grant any role', () => {
    for (const r of INVITE_ROLES) expect(canAssignInviteRole('admin', r), r).toBe(true)
  })

  it('board may grant anything except admin', () => {
    expect(canAssignInviteRole('board', 'admin')).toBe(false)
    for (const r of ['board', 'treasurer', 'member', 'associate']) {
      expect(canAssignInviteRole('board', r), r).toBe(true)
    }
  })

  it('non-admin/board (or unknown) cannot grant anything, and unknown targets are rejected', () => {
    expect(canAssignInviteRole('member', 'member')).toBe(false)
    expect(canAssignInviteRole('treasurer', 'associate')).toBe(false)
    expect(canAssignInviteRole('admin', 'superuser')).toBe(false)
  })

  it('createInviteSchema defaults role to member and validates the enum', () => {
    const r = createInviteSchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.role).toBe('member')
    expect(createInviteSchema.safeParse({ role: 'admin' }).success).toBe(true)
    expect(createInviteSchema.safeParse({ role: 'superuser' }).success).toBe(false)
    expect(updateInviteSchema.safeParse({ role: 'board' }).success).toBe(true)
    expect(updateInviteSchema.safeParse({}).success).toBe(true)
    expect(updateInviteSchema.safeParse({ role: 'nope' }).success).toBe(false)
  })
})

describe('slugify / deriveFieldKeys', () => {
  it('slugifies with the requested separator and trims runs', () => {
    expect(slugify('Hello World', '-')).toBe('hello-world')
    expect(slugify('  --Trim__ ', '_')).toBe('trim')
    expect(slugify('A!!!B', '_')).toBe('a_b')
    expect(slugify('', '_')).toBe('')
    expect(slugify('   ', '_')).toBe('')
  })
  it('derives valid, unique keys from labels and dedupes', () => {
    const out = deriveFieldKeys([
      { label: 'Full Name' },
      { label: 'Full Name' },
      { label: '' },
      { label: '   ' },
      { label: 'Full Name' },
    ])
    expect(out.map(f => f.key)).toEqual([
      'full_name',
      'full_name_2',
      'field_3',
      'field_4',
      'full_name_3',
    ])
  })
  it('preserves the other field properties', () => {
    const out = deriveFieldKeys([{ label: 'Q', type: 'short_text', required: true }])
    expect(out[0]).toMatchObject({ label: 'Q', type: 'short_text', required: true, key: 'q' })
  })
})

describe('escapeLike', () => {
  it('escapes ILIKE wildcards so an email matches exactly', () => {
    expect(escapeLike('a_b@x.com')).toBe('a\\_b@x.com')
    expect(escapeLike('100%@x.com')).toBe('100\\%@x.com')
    expect(escapeLike('plain@x.com')).toBe('plain@x.com')
  })
  it('escapes the backslash first (no double-unescape)', () => {
    expect(escapeLike('a\\_b')).toBe('a\\\\\\_b')
  })
})

describe('pickMemberForEmail', () => {
  it('returns null when no member matches', () => {
    expect(pickMemberForEmail([])).toBeNull()
  })
  it('picks the earliest-joined member deterministically', () => {
    expect(pickMemberForEmail([
      { id: 'b', joined_at: '2026-02-01T00:00:00Z' },
      { id: 'a', joined_at: '2026-01-01T00:00:00Z' },
      { id: 'c', joined_at: '2026-03-01T00:00:00Z' },
    ])).toBe('a')
  })
  it('treats a null joined_at as earliest (stable)', () => {
    expect(pickMemberForEmail([
      { id: 'x', joined_at: '2026-01-01T00:00:00Z' },
      { id: 'y', joined_at: null },
    ])).toBe('y')
  })
})
