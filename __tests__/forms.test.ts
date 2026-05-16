import { describe, it, expect } from 'vitest'
import {
  createFormSchema,
  updateFormSchema,
  submitFormSchema,
  formSchemaArray,
  formFieldSchema,
  onboardingStepTypeSchema,
  createOnboardingStepSchema,
} from '@/lib/validations'
import { parseFormSchema, validateAnswers, type FormField } from '@/lib/forms-schema'

describe('form field schema', () => {
  it('accepts a valid text field and defaults required to false', () => {
    const r = formFieldSchema.safeParse({ key: 'full_name', type: 'short_text', label: 'Name' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.required).toBe(false)
  })

  it('rejects a select field with no options', () => {
    const r = formFieldSchema.safeParse({ key: 'tier', type: 'select', label: 'Tier' })
    expect(r.success).toBe(false)
  })

  it('rejects an invalid field key', () => {
    const r = formFieldSchema.safeParse({ key: 'Full Name', type: 'short_text', label: 'X' })
    expect(r.success).toBe(false)
  })

  it('rejects duplicate field keys in the array', () => {
    const r = formSchemaArray.safeParse([
      { key: 'a', type: 'short_text', label: 'A' },
      { key: 'a', type: 'short_text', label: 'A again' },
    ])
    expect(r.success).toBe(false)
  })
})

describe('createFormSchema', () => {
  it('applies defaults', () => {
    const r = createFormSchema.safeParse({ slug: 'liability-waiver', title: 'Waiver' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.kind).toBe('form')
      expect(r.data.visibility).toBe('members')
      expect(r.data.schema).toEqual([])
    }
  })

  it('rejects an uppercase or hyphen-edged slug', () => {
    expect(createFormSchema.safeParse({ slug: 'Waiver', title: 'x' }).success).toBe(false)
    expect(createFormSchema.safeParse({ slug: '-waiver', title: 'x' }).success).toBe(false)
    expect(createFormSchema.safeParse({ slug: 'waiver-', title: 'x' }).success).toBe(false)
  })
})

describe('submitFormSchema', () => {
  it('requires formId or slug', () => {
    expect(submitFormSchema.safeParse({ answers: {} }).success).toBe(false)
    expect(submitFormSchema.safeParse({ slug: 'a', answers: {} }).success).toBe(true)
  })
})

describe('updateFormSchema', () => {
  it('does not accept a slug change', () => {
    const r = updateFormSchema.safeParse({
      formId: '11111111-1111-1111-1111-111111111111',
      slug: 'new-slug',
    })
    // slug is simply stripped (not in the schema), so parse still succeeds
    expect(r.success).toBe(true)
    if (r.success) expect('slug' in r.data).toBe(false)
  })
})

const fields: FormField[] = [
  { key: 'full_name', type: 'short_text', label: 'Full name', required: true },
  { key: 'agree', type: 'checkbox', label: 'I agree', required: true },
  { key: 'shirt', type: 'select', label: 'Shirt', required: false, options: ['S', 'M', 'L'] },
  { key: 'contact', type: 'email', label: 'Email', required: false },
]

describe('validateAnswers', () => {
  it('errors when a required field is missing', () => {
    const r = validateAnswers(fields, { agree: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Full name/)
  })

  it('errors when a required checkbox is not checked', () => {
    const r = validateAnswers(fields, { full_name: 'Ada', agree: false })
    expect(r.ok).toBe(false)
  })

  it('rejects a select value outside the options', () => {
    const r = validateAnswers(fields, { full_name: 'Ada', agree: true, shirt: 'XL' })
    expect(r.ok).toBe(false)
  })

  it('drops unknown keys and normalizes', () => {
    const r = validateAnswers(fields, {
      full_name: '  Ada  ',
      agree: 'on',
      contact: 'Ada@Example.COM',
      injected: 'evil',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toEqual({ full_name: 'Ada', agree: true, contact: 'ada@example.com' })
      expect('injected' in r.value).toBe(false)
    }
  })
})

describe('onboarding form step (Phase 4)', () => {
  it('onboardingStepTypeSchema accepts "form" and rejects unknown', () => {
    expect(onboardingStepTypeSchema.safeParse('form').success).toBe(true)
    expect(onboardingStepTypeSchema.safeParse('content').success).toBe(true)
    expect(onboardingStepTypeSchema.safeParse('quiz').success).toBe(false)
  })

  it('createOnboardingStepSchema accepts a form step with a form_id config', () => {
    const r = createOnboardingStepSchema.safeParse({
      step_type: 'form',
      title: 'Sign the liability waiver',
      config: { form_id: '11111111-1111-1111-1111-111111111111' },
    })
    expect(r.success).toBe(true)
  })
})

describe('parseFormSchema', () => {
  it('returns [] for malformed stored schema', () => {
    expect(parseFormSchema('not an array')).toEqual([])
    expect(parseFormSchema([{ key: 'a' }])).toEqual([])
  })

  it('round-trips a valid schema', () => {
    const raw = [{ key: 'a', type: 'short_text', label: 'A' }]
    expect(parseFormSchema(raw)).toHaveLength(1)
  })
})
