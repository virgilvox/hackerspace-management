import { z } from 'zod'

export const createAreaSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Code must be lowercase letters, numbers, and hyphens only'),
  name: z.string().min(1, 'Name is required').max(80),
  icon: z.string().max(20).optional().nullable(),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const updateAreaSchema = z.object({
  areaId: z.string().uuid('Invalid area ID'),
  name: z.string().min(1).max(80).optional(),
  icon: z.string().max(20).optional().nullable(),
  sort_order: z.number().int().min(0).max(100000).optional(),
  is_archived: z.boolean().optional(),
})
