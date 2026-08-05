import { z } from 'zod'

const certificationName = z
  .string()
  .min(1, 'Name is required')
  .max(200, 'Name must be 200 characters or fewer')

// validity_months: null/omitted = never expires. When set it must be a
// positive integer (months added to grant time to compute expiry).
const validityMonths = z
  .number()
  .int('Validity must be a whole number of months')
  .positive('Validity must be at least 1 month')
  .max(1200, 'Validity is unreasonably large')
  .optional()
  .nullable()

export const createCertificationSchema = z.object({
  name: certificationName,
  description: z.string().max(2000).optional().nullable(),
  validity_months: validityMonths,
})

export const updateCertificationSchema = z.object({
  certificationId: z.string().uuid('Invalid certification ID'),
  name: certificationName.optional(),
  description: z.string().max(2000).optional().nullable(),
  validity_months: validityMonths,
  is_active: z.boolean().optional(),
})

export const certificationIdSchema = z.object({
  certificationId: z.string().uuid('Invalid certification ID'),
})

// Award a cert to a member. expires_at is optional: when omitted the action
// computes it from the cert's validity_months; when provided it overrides
// (e.g. an externally dated certificate). Empty string -> null (no expiry).
export const grantCertificationSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  certificationId: z.string().uuid('Invalid certification ID'),
  note: z.string().max(2000).optional().nullable(),
  expires_at: z
    .string()
    .optional()
    .nullable()
    .transform(v => (v && v.trim() !== '' ? v : null)),
})

export const revokeCertificationSchema = z.object({
  memberCertificationId: z.string().uuid('Invalid grant ID'),
  reason: z.string().max(500).optional().nullable(),
})

export const renewCertificationSchema = z.object({
  memberCertificationId: z.string().uuid('Invalid grant ID'),
  note: z.string().max(2000).optional().nullable(),
})

export const listMemberCertificationsSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
})
