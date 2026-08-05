import { z } from 'zod'
import { emailField } from './primitives'

export const createContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  contact_type: z.enum(['vendor', 'supplier', 'partner', 'landlord', 'city']),
  email: emailField().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  details: z.string().max(500).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  group_label: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  code: z.string().max(50).optional().nullable(),
})

export const updateContactSchema = createContactSchema.partial().extend({
  contactId: z.string().uuid('Invalid contact ID'),
})

export type CreateContactInput = z.infer<typeof createContactSchema>
