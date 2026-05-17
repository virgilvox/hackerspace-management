// Pure, dependency-free decision logic for the forms/waivers feature.
// Extracted from the server actions and the builder so the security- and
// correctness-critical branches can be unit-tested directly. No Supabase,
// no React, no Next imports here.

// ─── CSV escaping (results export) ───────────────────────────────────────────

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = typeof value === 'string' ? value : JSON.stringify(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// ─── Client IP capture (e-sign defensibility) ────────────────────────────────
// Only a plausibly IP-shaped token is kept; anything else becomes null so it
// can never break the inet column or store junk in a waiver record.

const IP_RE = /^[0-9a-fA-F:.]{3,45}$/

export function parseClientIp(
  forwardedFor: string | null,
  realIp: string | null,
): string | null {
  const candidate = (forwardedFor ? forwardedFor.split(',')[0] : realIp)?.trim()
  if (!candidate || !IP_RE.test(candidate)) return null
  return candidate
}

// ─── Waiver version bump on update ───────────────────────────────────────────
// Bump only a published waiver whose legal text or field schema actually
// changed. Non-blocking re-sign: existing submissions stay valid against the
// snapshot they captured; the bump only nudges future signers.

export function shouldBumpFormVersion(input: {
  kind: string
  status: string
  legalChanged: boolean
  schemaChanged: boolean
}): boolean {
  return (
    input.kind === 'waiver' &&
    input.status === 'published' &&
    (input.legalChanged || input.schemaChanged)
  )
}

// ─── Required onboarding step satisfaction ───────────────────────────────────
// Decision for one required step that is NOT already in completed_step_ids.
//   - a non-form required step blocks (must be acknowledged in the flow)
//   - a form step with no configured form id is non-blocking (misconfig)
//   - a form step whose form is missing/unpublished is non-blocking
//     (cannot require a form nobody can fill — fail open, never trap a member)
//   - a form step with a published form is satisfied iff a submission by this
//     member exists (any version — re-sign is non-blocking / auto-satisfy)

export function evaluateRequiredFormStep(input: {
  stepType: string
  formId: string | null | undefined
  formPublished: boolean
  submissionExists: boolean
}): 'block' | 'pass' {
  if (input.stepType !== 'form') return 'block'
  if (!input.formId) return 'pass'
  if (!input.formPublished) return 'pass'
  return input.submissionExists ? 'pass' : 'block'
}

// ─── Builder field keys ──────────────────────────────────────────────────────
// The builder only ever asks for a label; keys are derived here so they are
// always valid (/^[a-z0-9_]+$/) and unique within a form. Duplicate or empty
// labels are made safe, matching the server-side formFieldSchema.

export function slugify(s: string, sep: '-' | '_'): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^\\${sep}+|\\${sep}+$`, 'g'), '')
}

export function deriveFieldKeys<T extends { label: string }>(
  fields: T[],
): (T & { key: string })[] {
  const seen = new Set<string>()
  return fields.map((f, i) => {
    const base = slugify(f.label || '', '_') || `field_${i + 1}`
    let key = base
    let n = 2
    while (seen.has(key)) key = `${base}_${n++}`
    seen.add(key)
    return { ...f, key }
  })
}

// Escape a literal so it can be used as a PostgREST/SQL ILIKE *value* and
// match exactly (case-insensitively) rather than as a pattern. Email local
// parts legitimately contain `_`, which is a single-char ILIKE wildcard --
// without escaping, `a_b@x.com` would also match `aXb@x.com`. Order matters:
// escape the escape char first.
export function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

// When an email matches more than one member row in a space (e.g. a manually
// added duplicate), associate deterministically with the earliest-joined one
// so the result is stable and reproducible.
export function pickMemberForEmail(
  rows: Array<{ id: string; joined_at: string | null }>,
): string | null {
  if (rows.length === 0) return null
  return [...rows].sort((a, b) =>
    (a.joined_at ?? '').localeCompare(b.joined_at ?? ''),
  )[0].id
}
