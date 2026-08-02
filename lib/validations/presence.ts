import { z } from 'zod'

export const checkInSchema = z.object({
  asHost: z.boolean().optional().default(false),
  note: z.string().max(500).optional().nullable(),
})

export const checkOutSchema = z.object({
  note: z.string().max(500).optional().nullable(),
})
