import { z } from 'zod'
import { flexibleDateTime } from './primitives'

export const createProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  area: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  due_date: flexibleDateTime().optional(),
})

export const updateProjectStatusSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  status: z.enum(['backlog', 'in_progress', 'review', 'done', 'blocked']),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
