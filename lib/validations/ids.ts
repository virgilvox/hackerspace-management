import { z } from 'zod'

export const uuidSchema = z.string().uuid('Invalid ID format')

export const bulkMemberIdsSchema = z
  .array(z.string().uuid('Invalid member ID'))
  .min(1, 'Select at least one member')
  .max(1000)

// Stripe dues config (admin). Secret fields are write-only: omitted/blank
// means "keep the stored one". prices maps a membership tier -> Stripe Price.
export const stripeSettingsSchema = z.object({
  mode: z.enum(['test', 'live']),
  publishable_key: z.string().trim().max(255).optional().nullable(),
  secret_key: z.string().trim().max(255).optional().nullable(),
  webhook_secret: z.string().trim().max(255).optional().nullable(),
  grace_days: z.number().int().min(0).max(90).optional().default(7),
  prices: z.record(z.string().trim().max(255)).optional().default({}),
})
