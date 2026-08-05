import { z } from 'zod'

export const onboardingStepTypeSchema = z.enum(['welcome', 'code_of_conduct', 'profile', 'payment', 'content', 'form'])

export const createOnboardingStepSchema = z.object({
  step_type: onboardingStepTypeSchema,
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().max(50000).optional().nullable(),
  config: z.record(z.unknown()).optional(),
  is_enabled: z.boolean().optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const updateOnboardingStepSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(50000).optional().nullable(),
  config: z.record(z.unknown()).optional(),
  is_enabled: z.boolean().optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const discloseAffiliationsSchema = z.object({
  affiliations: z.array(z.string().min(1).max(200)).max(50).default([]),
})
