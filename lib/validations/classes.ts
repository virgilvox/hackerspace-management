import { z } from 'zod'

// Generic manual payment link only (no live payment integration). Empty
// string -> null so a cleared field is stored as "no link".
const paymentLink = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform(v => (v && v !== '' ? v : null))
  .refine(
    v => v === null || /^https?:\/\/.+/i.test(v),
    'Payment link must be an http(s) URL',
  )

const classCapacity = z
  .number()
  .int('Capacity must be a whole number')
  .positive('Capacity must be at least 1')
  .max(100000)
  .optional()
  .nullable()

const dateTimeString = z.string().min(1, 'A date and time is required').max(40)

export const createClassSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional().nullable(),
  payment_link: paymentLink,
  capacity: classCapacity,
  grants_certification_id: z.string().uuid('Invalid certification ID').optional().nullable(),
  required_form_id: z.string().uuid('Invalid form ID').optional().nullable(),
})

export const updateClassSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  payment_link: paymentLink,
  capacity: classCapacity,
  grants_certification_id: z.string().uuid('Invalid certification ID').optional().nullable(),
  required_form_id: z.string().uuid('Invalid form ID').optional().nullable(),
  is_active: z.boolean().optional(),
})

export const classIdSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
})

export const createSessionSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
  starts_at: dateTimeString,
  ends_at: z.string().max(40).optional().nullable().transform(v => (v && v !== '' ? v : null)),
  location: z.string().max(300).optional().nullable(),
  capacity: classCapacity,
  notes: z.string().max(5000).optional().nullable(),
})

export const updateSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  starts_at: dateTimeString.optional(),
  ends_at: z.string().max(40).optional().nullable().transform(v => (v && v !== '' ? v : null)),
  location: z.string().max(300).optional().nullable(),
  capacity: classCapacity,
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(['scheduled', 'cancelled', 'completed']).optional(),
})

export const sessionIdSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
})

export const signUpForClassSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  // Manager-only: sign another member up on their behalf (also bypasses the
  // required-form gate). Ignored for non-managers.
  memberId: z.string().uuid('Invalid member ID').optional().nullable(),
})

export const cancelSignupSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
})

export const markAttendanceSchema = z.object({
  signupId: z.string().uuid('Invalid signup ID'),
  attended: z.boolean(),
})

export const listSessionSignupsSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
})
