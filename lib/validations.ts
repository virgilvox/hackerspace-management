import { z } from 'zod'
import { INVITE_ROLES } from './invite-logic'

/**
 * Accepts every date-ish string the app produces and normalizes to a
 * full RFC 3339 datetime so downstream `.datetime()` validation passes.
 *
 * - `""`, `null`, `undefined` → `null` (treat as unset)
 * - `"YYYY-MM-DD"` (HTML date input) → `"YYYY-MM-DDT00:00:00.000Z"`
 * - `"YYYY-MM-DDTHH:MM"` (datetime-local input) → ISO string in UTC
 * - `"YYYY-MM-DDTHH:MM:SS"` and full RFC 3339 → unchanged / normalised
 * - Anything `new Date()` can parse → its ISO form
 * - Unparseable → passed through so Zod rejects it
 *
 * Returns a Zod schema that produces a `string | null` (after preprocess +
 * `.datetime().nullable()`).
 */
export const flexibleDateTime = () =>
  z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return null
      if (typeof val !== 'string') return val
      // Already full ISO datetime? Pass through.
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:?\d{2}|Z)$/.test(val)) {
        return val
      }
      // Try Date parsing for everything else (date-only, datetime-local, etc).
      const d = new Date(val)
      if (Number.isNaN(d.getTime())) return val // let Zod reject
      return d.toISOString()
    },
    z.string().datetime().nullable(),
  )

// ─── Auth ────────────────────────────────────────────────────────────────────

// Canonicalize every email to trimmed lowercase so case/whitespace variants
// cannot create duplicate members/contacts or fail sign-in.
export const emailField = (msg = 'Invalid email address') =>
  z.string().max(200).email(msg).transform(s => s.trim().toLowerCase())

export const signInSchema = z.object({
  email: emailField(),
  password: z.string().min(1, 'Password is required'),
})

export const signUpSchema = z.object({
  email: emailField(),
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
  type: z.enum(['task', 'chore']).default('task'),
  area: z.string().max(100).optional(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'biweekly', 'monthly']).default('none'),
  due_date: flexibleDateTime().optional(),
})

export const taskIdSchema = z.string().uuid('Invalid task ID')

// ─── Projects ────────────────────────────────────────────────────────────────

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

// ─── Members ─────────────────────────────────────────────────────────────────

export const addMemberSchema = z.object({
  email: emailField(),
  display_name: z.string().min(1, 'Display name is required').max(100),
  phone: z.string().max(20).optional().nullable(),
  handle: z.string().max(50).optional().nullable(),
  role: z.enum(['admin', 'board', 'treasurer', 'member', 'associate']).default('member'),
  tier: z.enum(['plus', 'basic', 'associate']).default('basic'),
  joined_at: flexibleDateTime().optional(),
  has_card_access: z.boolean().optional(),
})

export const updateMemberSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  display_name: z.string().min(1).max(100).optional(),
  email: emailField().optional(),
  phone: z.string().max(20).optional().nullable(),
  handle: z.string().max(50).optional().nullable(),
  role: z.enum(['admin', 'board', 'treasurer', 'member', 'associate']).optional(),
  tier: z.enum(['plus', 'basic', 'associate']).optional(),
  status: z.enum(['current', 'unverified', 'late', 'inactive']).optional(),
  has_card_access: z.boolean().optional(),
  payment_status: z.string().max(50).optional().nullable(),
  payment_note: z.string().max(500).optional().nullable(),
})

// ─── Contacts ────────────────────────────────────────────────────────────────

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

// ─── Knowledge Base ──────────────────────────────────────────────────────────

export const createKbEntrySchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(50000),
  area: z.string().max(100).optional().nullable(),
  visibility: z.enum(['all_members', 'board', 'admin_only']).default('all_members'),
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

export const updateSecretSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  value: z.string().min(1).max(5000).optional(),
  description: z.string().max(500).optional().nullable(),
  area: z.string().max(100).optional().nullable(),
  icon: z.string().max(10).optional().nullable(),
})

// ─── Payments ────────────────────────────────────────────────────────────────

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

// ─── Settings ────────────────────────────────────────────────────────────────

export const updateSpaceSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().regex(/^[a-z0-9]+$/, 'Slug must be lowercase letters and numbers only').max(50).optional(),
  city: z.string().max(100).optional().nullable(),
  require_approval: z.boolean().optional(),
  public_member_directory: z.boolean().optional(),
  mission_statement: z.string().max(5000).optional().nullable(),
})

export const saveIntegrationSchema = z.object({
  platform: z.string().min(1).max(50),
  config: z.record(z.string().max(500)),
})

// ─── Area Leads ──────────────────────────────────────────────────────────────

export const upsertAreaLeadSchema = z.object({
  area_code: z.string().min(1, 'Area code is required').max(50),
  area_name: z.string().min(1, 'Area name is required').max(100),
  lead_id: z.string().uuid().optional().nullable(),
  lead_handle: z.string().max(100).optional().nullable(),
  status: z.enum(['active', 'vacant', 'handoff']).default('active'),
})

// ─── Governance: proposals ───────────────────────────────────────────────────

export const proposalTypes = ['bylaw_change','board_action','membership_vote','advisory_poll','recall','budget'] as const
export const proposalStatuses = ['draft','open','decided','withdrawn','expired'] as const
export const thresholdRules = ['simple_majority','two_thirds','three_fourths','unanimous'] as const
export const votePositions = ['yes','no','abstain','recused'] as const

export const createProposalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
  body: z.string().max(20000).default(''),
  proposal_type: z.enum(proposalTypes).default('advisory_poll'),
  threshold: z.enum(thresholdRules).optional(),
  policy_ref_id: z.string().uuid().optional().nullable(),
  parent_incident_id: z.string().uuid().optional().nullable(),
  voting_opens_at: flexibleDateTime().optional(),
  voting_closes_at: flexibleDateTime().optional(),
  open_immediately: z.boolean().optional(),
})

export const openProposalSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
  voting_closes_at: flexibleDateTime().optional(),
})

export const castVoteSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
  position: z.enum(votePositions),
  recusal_reason: z.string().max(1000).optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
}).refine(
  v => v.position !== 'recused' || (v.recusal_reason && v.recusal_reason.trim().length > 0),
  { message: 'Recusal requires a reason', path: ['recusal_reason'] },
)

export const decideProposalSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
})

export const withdrawProposalSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
})

// ─── Governance: incidents ───────────────────────────────────────────────────

export const incidentSeverities = ['low','medium','high','critical'] as const
export const incidentStatuses = ['received','under_review','decided','appealed','closed'] as const
export const incidentUpdateVisibilities = ['reporter_only','all_parties','board_only'] as const

export const fileIncidentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().min(1, 'Description is required').max(20000),
  category: z.string().max(50).default('general'),
  severity: z.enum(incidentSeverities).default('medium'),
  subjects: z.array(z.string().uuid()).max(20).optional(),
  is_anonymous: z.boolean().optional(),
})

export const updateIncidentStatusSchema = z.object({
  incidentId: z.string().uuid('Invalid incident ID'),
  status: z.enum(incidentStatuses),
  disposition: z.string().max(20000).optional().nullable(),
})

export const addIncidentUpdateSchema = z.object({
  incidentId: z.string().uuid('Invalid incident ID'),
  body: z.string().min(1, 'Update body is required').max(20000),
  visibility: z.enum(incidentUpdateVisibilities).default('all_parties'),
})

export const appealIncidentSchema = z.object({
  incidentId: z.string().uuid('Invalid incident ID'),
  title: z.string().min(1).max(200),
  body: z.string().max(20000).default(''),
})

// Anonymous reporters look their case up with the opaque token they were
// given at filing time (48 hex chars today; bound loosely so the format can
// evolve without breaking old tokens).
export const trackIncidentSchema = z.object({
  token: z.string().trim().min(16).max(128),
})

// ─── Governance: policies ────────────────────────────────────────────────────

export const policyStatuses = ['draft','active','deprecated','superseded'] as const

export const createPolicySchema = z.object({
  slug: z.string().min(1, 'Slug is required').max(80).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  title: z.string().min(1, 'Title is required').max(200),
  section_ref: z.string().max(80).optional().nullable(),
  parent_policy_id: z.string().uuid().optional().nullable(),
  body_formal: z.string().max(100000).default(''),
  body_plain: z.string().max(100000).optional().nullable(),
  effective_at: flexibleDateTime().optional(),
})

export const supersedePolicySchema = z.object({
  policyId: z.string().uuid('Invalid policy ID'),
  body_formal: z.string().max(100000).default(''),
  body_plain: z.string().max(100000).optional().nullable(),
  section_ref: z.string().max(80).optional().nullable(),
  title: z.string().min(1).max(200).optional(),
  adopted_by_proposal_id: z.string().uuid().optional().nullable(),
  effective_at: flexibleDateTime().optional(),
})

export const updatePolicyStatusSchema = z.object({
  policyId: z.string().uuid('Invalid policy ID'),
  status: z.enum(policyStatuses),
})

// ─── Member self-profile and COI ─────────────────────────────────────────────

export const updateMyProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  handle: z.string().max(50).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  skills: z.array(z.string().min(1).max(60)).max(40).optional(),
  interests: z.array(z.string().min(1).max(60)).max(40).optional(),
  willing_to: z.array(z.string().min(1).max(60)).max(20).optional(),
})

// ─── Onboarding ──────────────────────────────────────────────────────────────

export const onboardingStepTypeSchema = z.enum(['welcome', 'code_of_conduct', 'profile', 'payment', 'content', 'form'])

export const createOnboardingStepSchema = z.object({
  step_type: onboardingStepTypeSchema,
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().max(50000).optional().nullable(),
  config: z.record(z.unknown()).optional(),
  is_enabled: z.boolean().optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const updateOnboardingStepSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(50000).optional().nullable(),
  config: z.record(z.unknown()).optional(),
  is_enabled: z.boolean().optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const discloseAffiliationsSchema = z.object({
  affiliations: z.array(z.string().min(1).max(200)).max(50).default([]),
})

// ─── Space settings (visibility) ─────────────────────────────────────────────

export const financialVisibilities = ['treasurer_only', 'board_visible', 'all_members_visible'] as const
export const directoryVisibilities = [
  'board_only',
  'member_count_visible',
  'members_visible',
  'public_members_visible',
] as const

export const updateSpaceVisibilitySchema = z.object({
  financial_visibility: z.enum(financialVisibilities).optional(),
  member_directory_visibility: z.enum(directoryVisibilities).optional(),
})

// ─── Knowledge base meeting minutes ─────────────────────────────────────────

export const meetingMinutesSchema = z.object({
  entryId: z.string().uuid('Invalid entry ID'),
  is_meeting_minutes: z.boolean().default(true),
  meeting_date: flexibleDateTime().optional(),
})

// ─── Areas ───────────────────────────────────────────────────────────────────

export const createAreaSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Code must be lowercase letters, numbers, and hyphens only'),
  name: z.string().min(1, 'Name is required').max(80),
  icon: z.string().max(20).optional().nullable(),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const updateAreaSchema = z.object({
  areaId: z.string().uuid('Invalid area ID'),
  name: z.string().min(1).max(80).optional(),
  icon: z.string().max(20).optional().nullable(),
  sort_order: z.number().int().min(0).max(100000).optional(),
  is_archived: z.boolean().optional(),
})

// ─── Forum, comments, tiers, roles, invites ──────────────────────────────────

export const createForumThreadSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().max(20000).optional().nullable(),
  category: z.string().min(1).max(50).optional(),
})

export const updateForumThreadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(20000).optional().nullable(),
  category: z.string().min(1).max(50).optional(),
  pinned: z.boolean().optional(),
  locked: z.boolean().optional(),
})

export const commentEntityTypeSchema = z.enum(['forum_thread', 'proposal', 'incident', 'policy'])

export const createCommentSchema = z.object({
  entity_type: commentEntityTypeSchema,
  entity_id: z.string().uuid('Invalid entity ID'),
  body: z.string().min(1, 'Comment is required').max(10000),
  parent_id: z.string().uuid().optional().nullable(),
})

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(10000),
})

export const createTierSchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9][a-z0-9_-]{0,49}$/, 'Slug must be lowercase letters, numbers, _ or -'),
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional().nullable(),
  monthly_price_cents: z.number().int().min(0).max(100_000_000),
  billing_cadence: z.enum(['monthly', 'quarterly', 'annual', 'one_time', 'custom']).default('monthly'),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const updateTierSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional().nullable(),
  monthly_price_cents: z.number().int().min(0).max(100_000_000).optional(),
  billing_cadence: z.enum(['monthly', 'quarterly', 'annual', 'one_time', 'custom']).optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
  is_archived: z.boolean().optional(),
})

export const upsertRoleLabelSchema = z.object({
  role: z.enum(['admin', 'board', 'treasurer', 'member', 'associate']),
  display_name: z.string().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const createCustomRoleSchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9][a-z0-9_-]{0,49}$/, 'Slug must be lowercase letters, numbers, _ or -'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const updateCustomRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  sort_order: z.number().int().min(0).max(100000).optional(),
})

export const createInviteSchema = z.object({
  code: z.string().min(4).max(32).regex(/^[A-Z0-9-]+$/, 'Code must be uppercase letters, numbers, or hyphens').optional(),
  label: z.string().max(100).optional().nullable(),
  expires_at: flexibleDateTime(),
  max_uses: z.number().int().min(1).max(100000).optional().nullable(),
  is_enabled: z.boolean().optional(),
  role: z.enum(INVITE_ROLES).optional().default('member'),
})

export const updateInviteSchema = z.object({
  label: z.string().max(100).optional().nullable(),
  expires_at: flexibleDateTime(),
  max_uses: z.number().int().min(1).max(100000).optional().nullable(),
  is_enabled: z.boolean().optional(),
  role: z.enum(INVITE_ROLES).optional(),
})

export const createChannelSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[a-z0-9][a-z0-9-]{0,49}$/, 'Channel names must be lowercase letters, numbers, or hyphens'),
  description: z.string().max(500).optional().nullable(),
  channel_type: z.enum(['general', 'area', 'ops', 'project']).default('general'),
})

// ─── Permissions, Ops ACLs, area-lead roles ──────────────────────────────────

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

export const updateAreaLeadRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().max(20).optional().nullable(),
})

export const assignAreaLeadSchema = z.object({
  area_lead_role_id: z.string().uuid('Invalid role ID'),
  member_id: z.string().uuid('Invalid member ID'),
})

// ─── Bulk import ─────────────────────────────────────────────────────────────

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

// ─── Custom forms and waivers ────────────────────────────────────────────────

export const formFieldTypes = [
  'short_text',
  'long_text',
  'email',
  'number',
  'date',
  'checkbox',
  'select',
  'radio',
] as const
export const formKinds = ['form', 'waiver'] as const
export const formVisibilities = ['public_anon', 'public_auth', 'members'] as const
export const formStatuses = ['draft', 'published', 'closed'] as const

export const formSlug = z
  .string()
  .min(1, 'Slug is required')
  .max(80, 'Slug must be 80 characters or fewer')
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    'Slug must be lowercase letters, numbers, and internal hyphens only',
  )

export const formFieldSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9_]+$/, 'Field key must be lowercase letters, numbers, underscores'),
    type: z.enum(formFieldTypes),
    label: z.string().min(1, 'Field label is required').max(200),
    help: z.string().max(1000).optional().nullable(),
    required: z.boolean().optional().default(false),
    options: z.array(z.string().min(1).max(200)).max(100).optional(),
  })
  .superRefine((f, ctx) => {
    if ((f.type === 'select' || f.type === 'radio') && (!f.options || f.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Field "${f.label}" needs at least one option`,
        path: ['options'],
      })
    }
  })

// The field array is rejected if two fields share a key (answers are keyed by
// field key, so duplicates would silently overwrite).
export const formSchemaArray = z
  .array(formFieldSchema)
  .max(200, 'A form cannot have more than 200 fields')
  .superRefine((fields, ctx) => {
    const seen = new Set<string>()
    for (const f of fields) {
      if (seen.has(f.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate field key "${f.key}"`,
        })
      }
      seen.add(f.key)
    }
  })

export const createFormSchema = z.object({
  slug: formSlug,
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional().nullable(),
  kind: z.enum(formKinds).optional().default('form'),
  visibility: z.enum(formVisibilities).optional().default('members'),
  schema: formSchemaArray.optional().default([]),
  legal_text: z.string().max(100000).optional().nullable(),
})

// slug is intentionally immutable after creation: a published form/waiver may
// already be linked from elsewhere and submissions reference it.
export const updateFormSchema = z.object({
  formId: z.string().uuid('Invalid form ID'),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  visibility: z.enum(formVisibilities).optional(),
  schema: formSchemaArray.optional(),
  legal_text: z.string().max(100000).optional().nullable(),
})

export const setFormStatusSchema = z.object({
  formId: z.string().uuid('Invalid form ID'),
  status: z.enum(formStatuses),
})

export const formIdSchema = z.object({ formId: z.string().uuid('Invalid form ID') })

// Envelope only. The answers object is validated dynamically against the
// form's stored field schema inside submitForm (see lib/forms-schema.ts).
// formId is required: form slugs are only unique per space now, so a bare
// slug is ambiguous. Both callers (public page + onboarding) submit by id.
export const submitFormSchema = z.object({
  formId: z.string().uuid('Invalid form ID'),
  answers: z.record(z.unknown()).default({}),
  email: emailField().optional().nullable(),
  consent: z.boolean().optional(),
})

export const linkSubmissionsSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  email: emailField(),
})

export const getPublicFormSchema = z.object({
  space: z.string().min(1).max(100),
  slug: formSlug,
})

// ─── Certifications ──────────────────────────────────────────────────────────

const certificationName = z
  .string()
  .min(1, 'Name is required')
  .max(200, 'Name must be 200 characters or fewer')

// validity_months: null/omitted = never expires. When set it must be a
// positive integer (months added to grant time to compute expiry).
const validityMonths = z
  .number()
  .int('Validity must be a whole number of months')
  .positive('Validity must be at least 1 month')
  .max(1200, 'Validity is unreasonably large')
  .optional()
  .nullable()

export const createCertificationSchema = z.object({
  name: certificationName,
  description: z.string().max(2000).optional().nullable(),
  validity_months: validityMonths,
})

export const updateCertificationSchema = z.object({
  certificationId: z.string().uuid('Invalid certification ID'),
  name: certificationName.optional(),
  description: z.string().max(2000).optional().nullable(),
  validity_months: validityMonths,
  is_active: z.boolean().optional(),
})

export const certificationIdSchema = z.object({
  certificationId: z.string().uuid('Invalid certification ID'),
})

// Award a cert to a member. expires_at is optional: when omitted the action
// computes it from the cert's validity_months; when provided it overrides
// (e.g. an externally dated certificate). Empty string -> null (no expiry).
export const grantCertificationSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  certificationId: z.string().uuid('Invalid certification ID'),
  note: z.string().max(2000).optional().nullable(),
  expires_at: z
    .string()
    .optional()
    .nullable()
    .transform(v => (v && v.trim() !== '' ? v : null)),
})

export const revokeCertificationSchema = z.object({
  memberCertificationId: z.string().uuid('Invalid grant ID'),
  reason: z.string().max(500).optional().nullable(),
})

export const renewCertificationSchema = z.object({
  memberCertificationId: z.string().uuid('Invalid grant ID'),
  note: z.string().max(2000).optional().nullable(),
})

export const listMemberCertificationsSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
})

// ─── Classes ─────────────────────────────────────────────────────────────────

// Generic manual payment link only (no live payment integration). Empty
// string -> null so a cleared field is stored as "no link".
const paymentLink = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform(v => (v && v !== '' ? v : null))
  .refine(
    v => v === null || /^https?:\/\/.+/i.test(v),
    'Payment link must be an http(s) URL',
  )

const classCapacity = z
  .number()
  .int('Capacity must be a whole number')
  .positive('Capacity must be at least 1')
  .max(100000)
  .optional()
  .nullable()

const dateTimeString = z.string().min(1, 'A date and time is required').max(40)

export const createClassSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional().nullable(),
  payment_link: paymentLink,
  capacity: classCapacity,
  grants_certification_id: z.string().uuid('Invalid certification ID').optional().nullable(),
})

export const updateClassSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  payment_link: paymentLink,
  capacity: classCapacity,
  grants_certification_id: z.string().uuid('Invalid certification ID').optional().nullable(),
  is_active: z.boolean().optional(),
})

export const classIdSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
})

export const createSessionSchema = z.object({
  classId: z.string().uuid('Invalid class ID'),
  starts_at: dateTimeString,
  ends_at: z.string().max(40).optional().nullable().transform(v => (v && v !== '' ? v : null)),
  location: z.string().max(300).optional().nullable(),
  capacity: classCapacity,
  notes: z.string().max(5000).optional().nullable(),
})

export const updateSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  starts_at: dateTimeString.optional(),
  ends_at: z.string().max(40).optional().nullable().transform(v => (v && v !== '' ? v : null)),
  location: z.string().max(300).optional().nullable(),
  capacity: classCapacity,
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(['scheduled', 'cancelled', 'completed']).optional(),
})

export const sessionIdSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
})

export const signUpForClassSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
})

export const cancelSignupSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
})

export const markAttendanceSchema = z.object({
  signupId: z.string().uuid('Invalid signup ID'),
  attended: z.boolean(),
})

export const listSessionSignupsSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
})

// ─── Equipment ───────────────────────────────────────────────────────────────

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

// ─── Generic ID schemas ──────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid('Invalid ID format')

// Helper type exports
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type CreateContactInput = z.infer<typeof createContactSchema>
export type CreateKbEntryInput = z.infer<typeof createKbEntrySchema>
export type CreateSecretInput = z.infer<typeof createSecretSchema>
