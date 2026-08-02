import { z } from 'zod'
import { flexibleDateTime } from './primitives'

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(2000, 'Description is too long').optional(),
  type: z.enum(['task', 'chore']).default('task'),
  area: z.string().max(100).optional(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'biweekly', 'monthly']).default('none'),
  due_date: flexibleDateTime().optional(),
})

export const taskIdSchema = z.string().uuid('Invalid task ID')

export type CreateTaskInput = z.infer<typeof createTaskSchema>
