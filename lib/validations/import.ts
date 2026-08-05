import { z } from 'zod'
import { emailField, flexibleDateTime } from './primitives'

const importEmail = emailField('Invalid email')

export const importMembersSchema = z.array(
  z.object({
    display_name: z.string().min(1, 'Name required').max(100),
    email: importEmail,
    phone: z.string().max(20).optional().nullable(),
    tier: z.enum(['plus', 'basic', 'associate']).optional(),
    joined_at: flexibleDateTime().optional(),
    last_paid_at: flexibleDateTime().optional(),
    has_card_access: z.boolean().optional(),
  }),
).max(5000)

export const importPaymentsCsvSchema = z.array(
  z.object({
    platform: z.enum(['paypal', 'zeffy', 'venmo', 'cash']),
    amount: z.number().finite().positive('Amount must be positive').max(10_000_000),
    from_identifier: z.string().min(1, 'Payer required').max(200),
    from_note: z.string().max(500).optional().nullable(),
    transaction_date: flexibleDateTime().optional(),
  }),
).max(10000)
