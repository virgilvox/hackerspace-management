import { z } from 'zod'
import { flexibleDateTime } from './primitives'

export const logCashPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  from_note: z.string().min(1, 'Payer note is required').max(500),
  member_id: z.string().uuid('Invalid member ID').optional().nullable(),
  transaction_date: flexibleDateTime().optional(),
})

export const linkPaymentSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID'),
  memberId: z.string().uuid('Invalid member ID'),
})
