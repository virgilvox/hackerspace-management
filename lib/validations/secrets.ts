import { z } from 'zod'

export const createSecretSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  value: z.string().min(1, 'Value is required').max(5000),
  description: z.string().max(500).optional().nullable(),
  area: z.string().max(100).optional().nullable(),
  icon: z.string().max(10).optional().nullable(),
})

export const updateSecretSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  value: z.string().min(1).max(5000).optional(),
  description: z.string().max(500).optional().nullable(),
  area: z.string().max(100).optional().nullable(),
  icon: z.string().max(10).optional().nullable(),
})

export type CreateSecretInput = z.infer<typeof createSecretSchema>
