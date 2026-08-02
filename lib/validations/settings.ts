import { z } from 'zod'

export const updateSpaceSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().regex(/^[a-z0-9]+$/, 'Slug must be lowercase letters and numbers only').max(50).optional(),
  city: z.string().max(100).optional().nullable(),
  require_approval: z.boolean().optional(),
  public_member_directory: z.boolean().optional(),
  mission_statement: z.string().max(5000).optional().nullable(),
})

export const saveIntegrationSchema = z.object({
  platform: z.string().min(1).max(50),
  config: z.record(z.string().max(500)),
})

// ─── Space settings (visibility) ─────────────────────────────────────────────

export const financialVisibilities = ['treasurer_only', 'board_visible', 'all_members_visible'] as const
export const directoryVisibilities = [
  'board_only',
  'member_count_visible',
  'members_visible',
  'public_members_visible',
] as const

export const updateSpaceVisibilitySchema = z.object({
  financial_visibility: z.enum(financialVisibilities).optional(),
  member_directory_visibility: z.enum(directoryVisibilities).optional(),
})
