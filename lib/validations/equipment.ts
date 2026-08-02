import { z } from 'zod'

const equipmentStatus = z.enum(['available', 'maintenance', 'retired'])

export const createEquipmentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(5000).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  status: equipmentStatus.optional().default('available'),
  required_certification_id: z.string().uuid('Invalid certification ID').optional().nullable(),
  asset_tag: z.string().max(120).optional().nullable(),
})

export const updateEquipmentSchema = z.object({
  equipmentId: z.string().uuid('Invalid equipment ID'),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  status: equipmentStatus.optional(),
  required_certification_id: z.string().uuid('Invalid certification ID').optional().nullable(),
  asset_tag: z.string().max(120).optional().nullable(),
  is_active: z.boolean().optional(),
})

export const equipmentIdSchema = z.object({
  equipmentId: z.string().uuid('Invalid equipment ID'),
})

export const reserveEquipmentSchema = z.object({
  equipmentId: z.string().uuid('Invalid equipment ID'),
  starts_at: z.string().min(1, 'A start time is required').max(40),
  ends_at: z.string().min(1, 'An end time is required').max(40),
  notes: z.string().max(2000).optional().nullable(),
  // Manager-only: book on another member's behalf. Ignored for non-managers.
  memberId: z.string().uuid('Invalid member ID').optional().nullable(),
})

export const cancelReservationSchema = z.object({
  reservationId: z.string().uuid('Invalid reservation ID'),
})

export const listEquipmentReservationsSchema = z.object({
  equipmentId: z.string().uuid('Invalid equipment ID'),
})
