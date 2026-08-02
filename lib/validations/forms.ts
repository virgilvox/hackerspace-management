import { z } from 'zod'
import { emailField, formSchemaArray } from './primitives'

export const formKinds = ['form', 'waiver'] as const
export const formVisibilities = ['public_anon', 'public_auth', 'members'] as const
export const formStatuses = ['draft', 'published', 'closed'] as const

export const formSlug = z
  .string()
  .min(1, 'Slug is required')
  .max(80, 'Slug must be 80 characters or fewer')
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    'Slug must be lowercase letters, numbers, and internal hyphens only',
  )

export const createFormSchema = z.object({
  slug: formSlug,
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  kind: z.enum(formKinds).optional().default('form'),
  visibility: z.enum(formVisibilities).optional().default('members'),
  schema: formSchemaArray.optional().default([]),
  legal_text: z.string().max(100000).optional().nullable(),
})

// slug is intentionally immutable after creation: a published form/waiver may
// already be linked from elsewhere and submissions reference it.
export const updateFormSchema = z.object({
  formId: z.string().uuid('Invalid form ID'),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  visibility: z.enum(formVisibilities).optional(),
  schema: formSchemaArray.optional(),
  legal_text: z.string().max(100000).optional().nullable(),
})

export const setFormStatusSchema = z.object({
  formId: z.string().uuid('Invalid form ID'),
  status: z.enum(formStatuses),
})

export const formIdSchema = z.object({ formId: z.string().uuid('Invalid form ID') })

// Envelope only. The answers object is validated dynamically against the
// form's stored field schema inside submitForm (see lib/forms-schema.ts).
// formId is required: form slugs are only unique per space now, so a bare
// slug is ambiguous. Both callers (public page + onboarding) submit by id.
export const submitFormSchema = z.object({
  formId: z.string().uuid('Invalid form ID'),
  answers: z.record(z.unknown()).default({}),
  email: emailField().optional().nullable(),
  consent: z.boolean().optional(),
})

export const linkSubmissionsSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  email: emailField(),
})

export const memberSubmissionsSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
})

// Deleting a form permanently removes it AND every submission (FK cascade),
// including signed waivers. `confirm` must be explicitly true so an
// accidental/stale client call cannot destroy records.
export const deleteFormSchema = z.object({
  formId: z.string().uuid('Invalid form ID'),
  confirm: z.literal(true),
})

export const deleteSubmissionSchema = z.object({
  submissionId: z.string().uuid('Invalid submission ID'),
})

export const getPublicFormSchema = z.object({
  space: z.string().min(1).max(100),
  slug: formSlug,
})
