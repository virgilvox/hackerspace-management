import { z } from 'zod'
import { emailField } from './primitives'

export const signInSchema = z.object({
  email: emailField(),
  password: z.string().min(1, 'Password is required'),
})

export const signUpSchema = z.object({
  email: emailField(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required').max(100, 'Name is too long'),
  action: z.enum(['create', 'join']),
  spaceName: z.string().max(100).optional(),
  spaceSlug: z.string().regex(/^[a-z0-9]+$/, 'Slug must be lowercase letters and numbers only').max(50).optional(),
  city: z.string().max(100).optional(),
  inviteCode: z.string().max(20).optional(),
})

export const createSpaceSchema = z.object({
  spaceName: z.string().min(1, 'Space name is required').max(100, 'Name is too long'),
  spaceSlug: z.string().min(1, 'Slug is required').max(50).regex(/^[a-z0-9]+$/, 'Slug must be lowercase letters and numbers only'),
  spaceCity: z.string().max(100).optional(),
  displayName: z.string().min(1, 'Display name is required').max(100),
})

export const joinSpaceSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required').max(20),
  displayName: z.string().min(1, 'Display name is required').max(100),
})
