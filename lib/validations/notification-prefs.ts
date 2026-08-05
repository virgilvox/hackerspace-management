import { z } from 'zod'
import { MUTEABLE_CATEGORIES } from '../notifications-prefs-logic'

// Only muteable categories are settable; billing is membership-critical and
// never user-controllable, so it is excluded from the enum (a request to set
// it is rejected at the boundary).
export const notificationPreferenceSchema = z.object({
  category: z.enum(MUTEABLE_CATEGORIES as unknown as [string, ...string[]]),
  enabled: z.boolean(),
})
