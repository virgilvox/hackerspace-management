import { z } from 'zod'
import { formSchemaArray, formFieldSchema } from './validations'

export type FormField = z.infer<typeof formFieldSchema>

const SHORT_TEXT_MAX = 2000
const LONG_TEXT_MAX = 20000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Parse a stored form field schema (jsonb) into a typed, validated array.
 * Schemas are validated on write, but stored jsonb is still untrusted input
 * on read, so this re-validates and drops anything malformed.
 */
export function parseFormSchema(raw: unknown): FormField[] {
  const parsed = formSchemaArray.safeParse(raw)
  return parsed.success ? parsed.data : []
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
}

export type ValidateAnswersResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string }

/**
 * Validate a raw answers object against a form's field schema.
 *
 * Returns a NEW object containing only keys that correspond to known fields,
 * coerced to their declared type. Unknown keys in the input are discarded so
 * a caller cannot smuggle arbitrary jsonb into a submission. The first failing
 * field produces the error (one message, matching the parseInput convention).
 */
export function validateAnswers(
  fields: FormField[],
  answers: Record<string, unknown>,
): ValidateAnswersResult {
  const value: Record<string, unknown> = {}

  for (const field of fields) {
    const raw = answers[field.key]

    if (isEmpty(raw)) {
      if (field.required) {
        return { ok: false, error: `"${field.label}" is required` }
      }
      continue
    }

    switch (field.type) {
      case 'short_text':
      case 'long_text': {
        if (typeof raw !== 'string') return bad(field)
        const max = field.type === 'short_text' ? SHORT_TEXT_MAX : LONG_TEXT_MAX
        const s = raw.trim()
        if (s.length > max) {
          return { ok: false, error: `"${field.label}" is too long` }
        }
        value[field.key] = s
        break
      }
      case 'email': {
        if (typeof raw !== 'string' || !EMAIL_RE.test(raw.trim())) {
          return { ok: false, error: `"${field.label}" must be a valid email` }
        }
        value[field.key] = raw.trim().toLowerCase()
        break
      }
      case 'number': {
        const n = typeof raw === 'number' ? raw : Number(raw)
        if (!Number.isFinite(n)) return bad(field)
        value[field.key] = n
        break
      }
      case 'date': {
        if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) {
          return { ok: false, error: `"${field.label}" must be a valid date` }
        }
        value[field.key] = raw
        break
      }
      case 'checkbox': {
        const b = raw === true || raw === 'true' || raw === 'on' || raw === 1
        if (field.required && !b) {
          return { ok: false, error: `"${field.label}" must be checked` }
        }
        value[field.key] = b
        break
      }
      case 'select':
      case 'radio': {
        const opts = field.options ?? []
        if (typeof raw !== 'string' || !opts.includes(raw)) {
          return { ok: false, error: `"${field.label}" has an invalid selection` }
        }
        value[field.key] = raw
        break
      }
      default:
        return bad(field)
    }
  }

  return { ok: true, value }
}

function bad(field: FormField): { ok: false; error: string } {
  return { ok: false, error: `"${field.label}" has an invalid value` }
}
