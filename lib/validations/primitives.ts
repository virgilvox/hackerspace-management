import { z } from 'zod'

/**
 * Accepts every date-ish string the app produces and normalizes to a
 * full RFC 3339 datetime so downstream `.datetime()` validation passes.
 *
 * - `""`, `null`, `undefined` → `null` (treat as unset)
 * - `"YYYY-MM-DD"` (HTML date input) → `"YYYY-MM-DDT00:00:00.000Z"`
 * - `"YYYY-MM-DDTHH:MM"` (datetime-local input) → ISO string in UTC
 * - `"YYYY-MM-DDTHH:MM:SS"` and full RFC 3339 → unchanged / normalised
 * - Anything `new Date()` can parse → its ISO form
 * - Unparseable → passed through so Zod rejects it
 *
 * Returns a Zod schema that produces a `string | null` (after preprocess +
 * `.datetime().nullable()`).
 */
export const flexibleDateTime = (): z.ZodType<string | null, z.ZodTypeDef, unknown> =>
  z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return null
      if (typeof val !== 'string') return val
      // Already full ISO datetime? Pass through.
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:?\d{2}|Z)$/.test(val)) {
        return val
      }
      // Try Date parsing for everything else (date-only, datetime-local, etc).
      const d = new Date(val)
      if (Number.isNaN(d.getTime())) return val // let Zod reject
      return d.toISOString()
    },
    z.string().datetime().nullable(),
  )

// Canonicalize every email to trimmed lowercase so case/whitespace variants
// cannot create duplicate members/contacts or fail sign-in.
export const emailField = (msg = 'Invalid email address') =>
  z.string().max(200).email(msg).transform(s => s.trim().toLowerCase())

// ─── Custom forms building blocks (shared) ───────────────────────────────────

export const formFieldTypes = [
  'short_text',
  'long_text',
  'email',
  'number',
  'date',
  'checkbox',
  'select',
  'radio',
] as const

export const formFieldSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9_]+$/, 'Field key must be lowercase letters, numbers, underscores'),
    type: z.enum(formFieldTypes),
    label: z.string().min(1, 'Field label is required').max(200),
    help: z.string().max(1000).optional().nullable(),
    required: z.boolean().optional().default(false),
    options: z.array(z.string().min(1).max(200)).max(100).optional(),
  })
  .superRefine((f, ctx) => {
    if ((f.type === 'select' || f.type === 'radio') && (!f.options || f.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Field "${f.label}" needs at least one option`,
        path: ['options'],
      })
    }
  })

// The field array is rejected if two fields share a key (answers are keyed by
// field key, so duplicates would silently overwrite).
export const formSchemaArray = z
  .array(formFieldSchema)
  .max(200, 'A form cannot have more than 200 fields')
  .superRefine((fields, ctx) => {
    const seen = new Set<string>()
    for (const f of fields) {
      if (seen.has(f.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate field key "${f.key}"`,
        })
      }
      seen.add(f.key)
    }
  })
