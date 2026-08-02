import { z } from 'zod'
import { flexibleDateTime } from './primitives'

export const createKbEntrySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(50000),
  area: z.string().max(100).optional().nullable(),
  visibility: z.enum(['all_members', 'board', 'admin_only']).default('all_members'),
  is_pinned: z.boolean().default(false),
  tags: z.array(z.string().max(50)).max(20).optional(),
  icon: z.string().max(10).optional().nullable(),
})

export const updateKbEntrySchema = createKbEntrySchema.partial().extend({
  entryId: z.string().uuid('Invalid entry ID'),
})

// ─── Knowledge base meeting minutes ─────────────────────────────────────────

export const meetingMinutesSchema = z.object({
  entryId: z.string().uuid('Invalid entry ID'),
  is_meeting_minutes: z.boolean().default(true),
  meeting_date: flexibleDateTime().optional(),
})

export type CreateKbEntryInput = z.infer<typeof createKbEntrySchema>
