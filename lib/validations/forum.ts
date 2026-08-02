import { z } from 'zod'
import { INVITE_ROLES } from '../invite-logic'
import { flexibleDateTime } from './primitives'

export const createForumThreadSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().max(20000).optional().nullable(),
  category: z.string().min(1).max(50).optional(),
})

export const updateForumThreadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(20000).optional().nullable(),
  category: z.string().min(1).max(50).optional(),
  pinned: z.boolean().optional(),
  locked: z.boolean().optional(),
})

export const commentEntityTypeSchema = z.enum(['forum_thread', 'proposal', 'incident', 'policy'])

export const createCommentSchema = z.object({
  entity_type: commentEntityTypeSchema,
  entity_id: z.string().uuid('Invalid entity ID'),
  body: z.string().min(1, 'Comment is required').max(10000),
  parent_id: z.string().uuid().optional().nullable(),
})

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(10000),
})

export const createTierSchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9][a-z0-9_-]{0,49}$/, 'Slug must be lowercase letters, numbers, _ or -'),
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional().nullable(),
  monthly_price_cents: z.number().int().min(0).max(100_000_000),
  billing_cadence: z.enum(['monthly', 'quarterly', 'annual', 'one_time', 'custom']).default('monthly'),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const updateTierSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional().nullable(),
  monthly_price_cents: z.number().int().min(0).max(100_000_000).optional(),
  billing_cadence: z.enum(['monthly', 'quarterly', 'annual', 'one_time', 'custom']).optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
  is_archived: z.boolean().optional(),
})

export const upsertRoleLabelSchema = z.object({
  role: z.enum(['admin', 'board', 'treasurer', 'member', 'associate']),
  display_name: z.string().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const createCustomRoleSchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9][a-z0-9_-]{0,49}$/, 'Slug must be lowercase letters, numbers, _ or -'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const updateCustomRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const createInviteSchema = z.object({
  code: z.string().min(4).max(32).regex(/^[A-Z0-9-]+$/, 'Code must be uppercase letters, numbers, or hyphens').optional(),
  label: z.string().max(100).optional().nullable(),
  expires_at: flexibleDateTime(),
  max_uses: z.number().int().min(1).max(100000).optional().nullable(),
  is_enabled: z.boolean().optional(),
  role: z.enum(INVITE_ROLES).optional().default('member'),
})

export const updateInviteSchema = z.object({
  label: z.string().max(100).optional().nullable(),
  expires_at: flexibleDateTime(),
  max_uses: z.number().int().min(1).max(100000).optional().nullable(),
  is_enabled: z.boolean().optional(),
  role: z.enum(INVITE_ROLES).optional(),
})

export const createChannelSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z0-9][a-z0-9-]{0,49}$/, 'Channel names must be lowercase letters, numbers, or hyphens'),
  description: z.string().max(500).optional().nullable(),
  channel_type: z.enum(['general', 'area', 'ops', 'project']).default('general'),
})
