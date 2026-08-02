import { z } from 'zod'

export const upsertAreaLeadSchema = z.object({
  area_code: z.string().min(1, 'Area code is required').max(50),
  area_name: z.string().min(1, 'Area name is required').max(100),
  lead_id: z.string().uuid().optional().nullable(),
  lead_handle: z.string().max(100).optional().nullable(),
  status: z.enum(['active', 'vacant', 'handoff']).default('active'),
})
