import { z } from 'zod'

// A grant subject is a built-in role or a custom-role slug.
const roleSubject = z.string().min(1).max(50).regex(/^[a-z0-9][a-z0-9_:-]{0,49}$/, 'Invalid role')

export const setRolePermissionsSchema = z.object({
  subject: roleSubject,
  permissions: z.array(z.string().min(1).max(60)).max(64),
})

export const opsEntityTypeSchema = z.enum(['secret', 'kb', 'process', 'area_lead'])

// The UI sends the full desired role list for one item; the server replaces.
// An empty list means "fall back to the item's existing visibility rule".
export const setOpsAclSchema = z.object({
  entity_type: opsEntityTypeSchema,
  entity_id: z.string().uuid('Invalid entity ID'),
  roles: z.array(z.string().min(1).max(64)).max(64),
})

export const createAreaLeadRoleSchema = z.object({
  area_code: z.string().min(1).max(60).regex(/^[a-z0-9][a-z0-9_-]{0,59}$/, 'Invalid area code'),
  name: z.string().min(1).max(100),
  color: z.string().max(20).optional().nullable(),
})

export const assignAreaLeadSchema = z.object({
  area_lead_role_id: z.string().uuid('Invalid role ID'),
  member_id: z.string().uuid('Invalid member ID'),
})
