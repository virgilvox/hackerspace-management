import { z } from 'zod'
import { emailField, flexibleDateTime } from './primitives'

export const addMemberSchema = z.object({
  email: emailField(),
  display_name: z.string().min(1, 'Display name is required').max(100),
  phone: z.string().max(20).optional().nullable(),
  handle: z.string().max(50).optional().nullable(),
  role: z.enum(['admin', 'board', 'treasurer', 'member', 'associate']).default('member'),
  tier: z.enum(['plus', 'basic', 'associate']).default('basic'),
  joined_at: flexibleDateTime().optional(),
  has_card_access: z.boolean().optional(),
})

export const updateMemberSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  display_name: z.string().min(1).max(100).optional(),
  email: emailField().optional(),
  phone: z.string().max(20).optional().nullable(),
  handle: z.string().max(50).optional().nullable(),
  role: z.enum(['admin', 'board', 'treasurer', 'member', 'associate']).optional(),
  tier: z.enum(['plus', 'basic', 'associate']).optional(),
  status: z.enum(['current', 'unverified', 'late', 'inactive']).optional(),
  has_card_access: z.boolean().optional(),
  payment_status: z.string().max(50).optional().nullable(),
  payment_note: z.string().max(500).optional().nullable(),
})

// ─── Member self-profile and COI ─────────────────────────────────────────────

export const emailChangeSchema = z.object({
  email: z.string().email('Enter a valid email address').max(254),
})

export const updateMyProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  handle: z.string().max(50).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  skills: z.array(z.string().min(1).max(60)).max(40).optional(),
  interests: z.array(z.string().min(1).max(60)).max(40).optional(),
  willing_to: z.array(z.string().min(1).max(60)).max(20).optional(),
})
