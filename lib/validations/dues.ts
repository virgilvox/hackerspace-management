import { z } from 'zod'
import { DUES_LINK_PLATFORMS, isSafeDuesUrl } from '../dues-payments-logic'

// One external pay-here URL per platform. url must be absolute https (no
// http downgrade, no javascript:/data: scheme) since it is rendered as a
// member-clickable anchor. instructions is an optional memo hint (e.g. "put
// your member name in the note") to help the treasurer reconcile later.
export const duesPaymentMethodSchema = z.object({
  platform: z.enum(DUES_LINK_PLATFORMS),
  url: z
    .string()
    .trim()
    .max(500)
    .refine(isSafeDuesUrl, 'Enter an absolute https:// URL'),
  instructions: z.string().trim().max(300).optional().nullable(),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).max(999).optional().default(0),
})
