import { z } from 'zod'

// ─── Auth ────────────────────────────────────────────────────────────────────

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required').max(100, 'Name is too long'),
  action: z.enum(['create', 'join']),
  spaceName: z.string().max(100).optional(),
  spaceSlug: z.string().regex(/^[a-z0-9]+$/, 'Slug must be lowercase letters and numbers only').max(50).optional(),
  city: z.string().max(100).optional(),
  inviteCode: z.string().max(20).optional(),
})

export const createSpaceSchema = z.object({
  spaceName: z.string().min(1, 'Space name is required').max(100, 'Name is too long'),
  spaceSlug: z.string().min(1, 'Slug is required').max(50).regex(/^[a-z0-9]+$/, 'Slug must be lowercase letters and numbers only'),
  spaceCity: z.string().max(100).optional(),
  displayName: z.string().min(1, 'Display name is required').max(100),
})

export const joinSpaceSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required').max(20),
  displayName: z.string().min(1, 'Display name is required').max(100),
})

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().max(2000, 'Description is too long').optional(),
  type: z.string().max(50).default('task'),
  area: z.string().max(100).optional(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']).default('none'),
  due_date: z.string().datetime().optional().nullable(),
})

export const taskIdSchema = z.string().uuid('Invalid task ID')

// ─── Projects ────────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  area: z.string().max(100).optional(),
  due_date: z.string().datetime().optional().nullable(),
})

export const updateProjectStatusSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  status: z.enum(['planning', 'active', 'paused', 'completed', 'cancelled']),
})

// ─── Members ─────────────────────────────────────────────────────────────────

export const addMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  display_name: z.string().min(1, 'Display name is required').max(100),
  role: z.enum(['admin', 'board', 'treasurer', 'member']).default('member'),
  tier: z.enum(['plus', 'basic', 'associate']).default('basic'),
})

export const updateMemberSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  display_name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional().nullable(),
  handle: z.string().max(50).optional().nullable(),
  role: z.enum(['admin', 'board', 'treasurer', 'member']).optional(),
  tier: z.enum(['plus', 'basic', 'associate']).optional(),
  status: z.enum(['current', 'unverified', 'late', 'inactive']).optional(),
  has_card_access: z.boolean().optional(),
})

// ─── Contacts ────────────────────────────────────────────────────────────────

export const createContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  contact_type: z.enum(['vendor', 'sponsor', 'partner', 'city', 'media', 'other']),
  email: z.string().email().optional().nullable(),
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

// ─── Knowledge Base ──────────────────────────────────────────────────────────

export const createKbEntrySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(50000),
  area: z.string().max(100).optional().nullable(),
  visibility: z.enum(['public', 'members', 'board', 'admin']).default('members'),
  is_pinned: z.boolean().default(false),
  tags: z.array(z.string().max(50)).max(20).optional(),
  icon: z.string().max(10).optional().nullable(),
})

export const updateKbEntrySchema = createKbEntrySchema.partial().extend({
  entryId: z.string().uuid('Invalid entry ID'),
})

// ─── Secrets ─────────────────────────────────────────────────────────────────

export const createSecretSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  value: z.string().min(1, 'Value is required').max(5000),
  description: z.string().max(500).optional().nullable(),
  area: z.string().max(100).optional().nullable(),
  icon: z.string().max(10).optional().nullable(),
})

// ─── Payments ────────────────────────────────────────────────────────────────

export const logCashPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  from_identifier: z.string().min(1, 'Payer name is required').max(200),
  from_note: z.string().max(500).optional().nullable(),
  transaction_date: z.string().datetime().optional(),
})

export const linkPaymentSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID'),
  memberId: z.string().uuid('Invalid member ID'),
})

// ─── Settings ────────────────────────────────────────────────────────────────

export const updateSpaceSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  city: z.string().max(100).optional().nullable(),
  require_approval: z.boolean().optional(),
  public_member_directory: z.boolean().optional(),
})

export const saveIntegrationSchema = z.object({
  platform: z.string().min(1).max(50),
  config: z.record(z.string().max(500)),
})

// ─── Area Leads ──────────────────────────────────────────────────────────────

export const upsertAreaLeadSchema = z.object({
  id: z.string().uuid().optional(),
  area_name: z.string().min(1, 'Area name is required').max(100),
  lead_handle: z.string().min(1, 'Lead handle is required').max(100),
  description: z.string().max(500).optional().nullable(),
})

// ─── Generic ID schemas ──────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid('Invalid ID format')

// Helper type exports
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type CreateContactInput = z.infer<typeof createContactSchema>
export type CreateKbEntryInput = z.infer<typeof createKbEntrySchema>
export type CreateSecretInput = z.infer<typeof createSecretSchema>
