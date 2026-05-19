# Hackerspace.sh - API Reference

> **Last Updated**: 2026-05-15  
> Complete reference for all server actions, database operations, and API patterns.
> Actions added since the original baseline are listed in "Server actions added (migrations 016-024)" at the end.

---

## Table of Contents

1. [Server Actions Overview](#1-server-actions-overview)
2. [Authentication Actions](#2-authentication-actions)
3. [Task Actions](#3-task-actions)
4. [Project Actions](#4-project-actions)
5. [Member Actions](#5-member-actions)
6. [Payment Actions](#6-payment-actions)
7. [Knowledge Base Actions](#7-knowledge-base-actions)
8. [Contact Actions](#8-contact-actions)
9. [Settings Actions](#9-settings-actions)
10. [Data Fetching Patterns](#10-data-fetching-patterns)
11. [Real-time Subscriptions](#11-real-time-subscriptions)
12. [Error Handling](#12-error-handling)

---

## 1. Server Actions Overview

All mutations use Next.js Server Actions with `'use server'` directive. Actions:
- Authenticate via `supabase.auth.getUser()`
- Validate membership and roles
- Return `{ data?, error?, success? }` objects
- Call `revalidatePath()` for cache invalidation

### Import Pattern

```typescript
// In client components
import { createTask, claimTask } from '@/lib/actions'
import { signIn, signOut } from '@/lib/auth-actions'

// Usage
const result = await createTask({ title: 'Clean laser', type: 'chore' })
if (result.error) {
  setError(result.error)
} else {
  // Success - result.data contains the new task
}
```

---

## 2. Authentication Actions

**File**: `lib/auth-actions.ts`

### `signIn(email, password)`

Authenticates user with email/password.

```typescript
async function signIn(email: string, password: string): Promise<{
  data?: AuthData
  error?: string
}>
```

**Parameters**:
- `email` (string, required): User email
- `password` (string, required): User password

**Returns**:
- `{ data: AuthData }` on success
- `{ error: string }` on failure

**Example**:
```typescript
const result = await signIn('user@example.com', 'password123')
if (result.error) {
  toast.error(result.error)
} else {
  router.push('/dashboard')
}
```

---

### `signUp(formData)`

Creates new account and optionally creates/joins a space.

```typescript
async function signUp(formData: {
  email: string
  password: string
  fullName: string
  action: 'create' | 'join'
  spaceName?: string
  spaceSlug?: string
  city?: string
  inviteCode?: string
}): Promise<{ data?: AuthData; error?: string }>
```

**Parameters**:
- `email` (string, required): User email
- `password` (string, required): Minimum 8 characters
- `fullName` (string, required): Display name
- `action` ('create' | 'join', required): Space action
- `spaceName` (string): Required if action='create'
- `spaceSlug` (string): Required if action='create'
- `city` (string, optional): Space location
- `inviteCode` (string): Required if action='join'

**Behavior**:
- Creates auth user with metadata
- DB trigger `handle_space_signup` creates space/member
- Returns session if email confirmation disabled
- Otherwise redirects to confirmation page

---

### `signOut()`

Signs out current user and redirects to login.

```typescript
async function signOut(): Promise<never>
```

**Behavior**:
- Calls `supabase.auth.signOut()`
- Redirects to `/login`

---

### `getUser()`

Gets current authenticated user.

```typescript
async function getUser(): Promise<User | null>
```

---

### `getCurrentMembership()`

Gets current user's space membership with space details.

```typescript
async function getCurrentMembership(): Promise<SpaceMember & { spaces: Space } | null>
```

---

### `createSpace(formData)`

Creates a new space for authenticated user.

```typescript
async function createSpace(formData: {
  spaceName: string
  spaceSlug: string
  spaceCity?: string
  displayName: string
}): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Authenticated (no existing space membership)

**Behavior**:
- Uses admin client (bypasses RLS)
- Creates space with auto-generated invite code
- Creates member as admin/plus/current

---

### `joinSpace(formData)`

Joins existing space via invite code.

```typescript
async function joinSpace(formData: {
  inviteCode: string
  displayName: string
}): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Authenticated

**Behavior**:
- Validates invite code
- Creates member with status based on `require_approval`

---

## 3. Task Actions

**File**: `lib/actions/tasks.ts` (server actions are split per-domain under `lib/actions/*.ts`, re-exported from `lib/actions/index.ts`; there is no monolithic `lib/actions.ts`)

### `createTask(formData)`

Creates a new task or chore.

```typescript
async function createTask(formData: {
  title: string
  description?: string
  type: string          // 'task' | 'chore'
  area?: string
  recurrence?: string   // 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly'
  due_date?: string     // ISO date string
}): Promise<{ data?: Task; error?: string }>
```

**Role Required**: Member

**Behavior**:
- Sets `requested_by` to current user
- Sets `status` to 'open'
- Logs activity
- Revalidates `/tasks` and `/dashboard`

---

### `claimTask(taskId)`

Claims an open task.

```typescript
async function claimTask(taskId: string): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Member

**Behavior**:
- Sets `claimed_by` to current user
- Sets `status` to 'claimed'
- Logs activity

---

### `completeTask(taskId)`

Marks task as completed.

```typescript
async function completeTask(taskId: string): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Member (ideally claimant)

**Behavior**:
- Sets `status` to 'completed'
- Sets `completed_at` and `last_done_at`
- Logs activity

---

### `deleteTask(taskId)`

Deletes a task.

```typescript
async function deleteTask(taskId: string): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Member

---

## 4. Project Actions

### `createProject(formData)`

Creates a new project.

```typescript
async function createProject(formData: {
  title: string
  description?: string
  area?: string
  tags?: string[]
  due_date?: string
}): Promise<{ data?: Project; error?: string }>
```

**Role Required**: Member

**Behavior**:
- Sets `status` to 'backlog'
- Logs activity

---

### `updateProjectStatus(projectId, status)`

Updates project kanban status.

```typescript
async function updateProjectStatus(
  projectId: string, 
  status: string  // 'backlog' | 'in_progress' | 'review' | 'done' | 'blocked'
): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Member

---

### `deleteProject(projectId)`

Deletes a project.

```typescript
async function deleteProject(projectId: string): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Member

---

## 5. Member Actions

### `addMember(formData)`

Manually adds a member to the space.

```typescript
async function addMember(formData: {
  display_name: string
  email: string
  phone?: string
  handle?: string
  tier: string          // 'plus' | 'basic' | 'associate'
  role: string          // 'admin' | 'board' | 'treasurer' | 'member' | 'associate'
  joined_at?: string
  has_card_access?: boolean
}): Promise<{ data?: SpaceMember; error?: string }>
```

**Role Required**: Admin or Board

**Note**: Creates member without user_id (offline member). User can claim via signup later.

---

### `updateMember(memberId, updates)`

Updates member details.

```typescript
async function updateMember(memberId: string, updates: {
  display_name?: string
  email?: string
  phone?: string
  handle?: string
  tier?: string
  role?: string
  status?: string
  has_card_access?: boolean
  payment_status?: string
  payment_note?: string
}): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Admin or Board

---

### `approveMember(memberId)`

Approves a pending member.

```typescript
async function approveMember(memberId: string): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Admin or Board

**Behavior**:
- Sets `status` to 'current'
- Sets `approved` to true
- Logs activity

---

### `removeMember(memberId)`

Removes member from space.

```typescript
async function removeMember(memberId: string): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Admin only

---

### `importMembers(rows)`

Bulk import members from CSV data.

```typescript
async function importMembers(rows: Array<{
  display_name: string
  email: string
  phone?: string
  tier?: string
  joined_at?: string
  last_paid_at?: string
  has_card_access?: boolean
}>): Promise<{ data?: SpaceMember[]; count?: number; error?: string }>
```

**Role Required**: Admin or Board

**Behavior**:
- Upserts on `(space_id, email)` to avoid duplicates

---

## 6. Payment Actions

### `logCashPayment(formData)`

Records a cash payment.

```typescript
async function logCashPayment(formData: {
  amount: number
  from_note: string
  member_id?: string
  transaction_date?: string
}): Promise<{ data?: Payment; error?: string }>
```

**Role Required**: Treasurer, Board, or Admin

**Behavior**:
- Sets `platform` to 'cash'
- If `member_id` provided, sets `link_status` to 'linked'
- Updates member's `last_paid_at` if linked
- Logs activity

---

### `linkPaymentToMember(paymentId, memberId)`

Links an unlinked payment to a member.

```typescript
async function linkPaymentToMember(
  paymentId: string, 
  memberId: string
): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Treasurer, Board, or Admin

**Behavior**:
- Updates payment `member_id` and `link_status`
- Updates member `last_paid_at` and `payment_status`

---

### `importPaymentsCsv(rows)`

Bulk import payments.

```typescript
async function importPaymentsCsv(rows: Array<{
  platform: string
  amount: number
  from_identifier: string
  from_note?: string
  transaction_date: string
}>): Promise<{ data?: Payment[]; count?: number; error?: string }>
```

**Role Required**: Treasurer, Board, or Admin

---

## 7. Knowledge Base Actions

### `createKbEntry(formData)`

Creates knowledge base entry.

```typescript
async function createKbEntry(formData: {
  title: string
  content: string
  description?: string
  area?: string
  visibility?: string   // 'all_members' | 'board' | 'admin_only'
  is_pinned?: boolean
  tags?: string[]
  icon?: string
}): Promise<{ data?: KnowledgeBase; error?: string }>
```

**Role Required**: Member

---

### `updateKbEntry(entryId, updates)`

Updates knowledge base entry.

```typescript
async function updateKbEntry(entryId: string, updates: {
  title?: string
  content?: string
  area?: string
  visibility?: string
  is_pinned?: boolean
  tags?: string[]
}): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Member

---

### `deleteKbEntry(entryId)`

Deletes knowledge base entry.

```typescript
async function deleteKbEntry(entryId: string): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Board or Admin (via RLS)

---

### `createSecret(formData)`

Creates encrypted secret.

```typescript
async function createSecret(formData: {
  title: string
  value: string
  description?: string
  area?: string
  icon?: string
}): Promise<{ data?: Secret; error?: string }>
```

**Role Required**: Admin or Board

---

### `deleteSecret(secretId)`

Deletes secret.

```typescript
async function deleteSecret(secretId: string): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Admin only

---

### `upsertAreaLead(formData)`

Creates or updates area lead assignment.

```typescript
async function upsertAreaLead(formData: {
  area_code: string
  area_name: string
  lead_id?: string
  lead_handle?: string
  status?: string       // 'active' | 'vacant' | 'handoff'
}): Promise<{ data?: AreaLead; error?: string }>
```

**Role Required**: Admin or Board

**Behavior**:
- Upserts on `(space_id, area_code)`

---

## 8. Contact Actions

### `createContact(formData)`

Creates a contact entry.

```typescript
async function createContact(formData: {
  name: string
  contact_type: string  // 'vendor' | 'supplier' | 'partner' | 'landlord' | 'city'
  email?: string
  phone?: string
  details?: string
  note?: string
  group_label?: string
  tags?: string[]
}): Promise<{ data?: Contact; error?: string }>
```

**Role Required**: Member

**Behavior**:
- Auto-generates 3-letter code from name

---

### `updateContact(contactId, updates)`

Updates contact.

```typescript
async function updateContact(contactId: string, updates: {
  name?: string
  contact_type?: string
  email?: string
  phone?: string
  details?: string
  note?: string
  group_label?: string
  tags?: string[]
}): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Member

---

### `deleteContact(contactId)`

Deletes contact.

```typescript
async function deleteContact(contactId: string): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Member

---

## 9. Settings Actions

### `updateSpaceSettings(updates)`

Updates space configuration.

```typescript
async function updateSpaceSettings(updates: {
  name?: string
  slug?: string
  city?: string
  require_approval?: boolean
  public_member_directory?: boolean
}): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Admin only

---

### `saveIntegration(platform, config)`

Saves integration configuration.

```typescript
async function saveIntegration(
  platform: string, 
  config: Record<string, string>
): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Admin only

**Behavior**:
- Upserts on `(space_id, platform)`
- Stores config with `_set` indicators for each field
- Secret-named fields (`client_secret`, `*_secret`, `api_key`, `secret_key`) are NEVER stored in `integrations.config` in plaintext: they go to the AES-256-GCM secrets vault and only a `<field>_ref` id is kept (same vault Stripe/door use). A blank submit preserves the existing ref (write-only, like Stripe); any legacy plaintext secret already on file is auto-migrated into the vault on the next save. The PayPal sync route reads `client_secret` from the vault (with a transitional fallback to legacy plaintext until the next save).

---

### `disconnectIntegration(platform)`

Disconnects/clears integration.

```typescript
async function disconnectIntegration(platform: string): Promise<{ success?: boolean; error?: string }>
```

**Role Required**: Admin only

---

### `rotateWebhookSecret()`

Generates new webhook secret.

```typescript
async function rotateWebhookSecret(): Promise<{ secret?: string; error?: string }>
```

**Role Required**: Admin only

**Returns**: New `whsec_` prefixed secret

---

## 10. Data Fetching Patterns

### Server Component Fetch

```typescript
// In page.tsx (Server Component)
import { createClient } from '@/lib/supabase/server'

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data: member } = await supabase
    .from('space_members')
    .select('space_id, display_name, role')
    .eq('user_id', user!.id)
    .eq('status', 'current')
    .single()

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('space_id', member.space_id)
    .order('created_at', { ascending: false })

  return <TasksClient tasks={tasks ?? []} />
}
```

### Parallel Fetching

```typescript
const [
  { data: tasks },
  { data: projects },
  { count: memberCount }
] = await Promise.all([
  supabase.from('tasks').select('*').eq('space_id', spaceId),
  supabase.from('projects').select('*').eq('space_id', spaceId),
  supabase.from('space_members').select('*', { count: 'exact', head: true }).eq('space_id', spaceId)
])
```

---

## 11. Real-time Subscriptions

### Comms Messages

```typescript
'use client'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

function useChannelMessages(channelId: string) {
  const [messages, setMessages] = useState([])

  useEffect(() => {
    const supabase = createClient()
    
    // Initial fetch
    supabase
      .from('comms_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at')
      .then(({ data }) => setMessages(data ?? []))

    // Subscribe to new messages
    const subscription = supabase
      .channel(`messages:${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'comms_messages',
        filter: `channel_id=eq.${channelId}`
      }, payload => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [channelId])

  return messages
}
```

---

## 12. Error Handling

### Action Return Pattern

All actions return a consistent shape:

```typescript
// Success with data
{ data: T }

// Success without data
{ success: true }

// Error
{ error: string }
```

### Client-side Handling

```typescript
const [error, setError] = useState('')
const [loading, setLoading] = useState(false)

async function handleSubmit() {
  setLoading(true)
  setError('')
  
  const result = await createTask(formData)
  
  if (result.error) {
    setError(result.error)
  } else {
    // Success - close modal, refresh data, etc.
  }
  
  setLoading(false)
}
```

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Not authenticated" | No session | Redirect to login |
| "No active membership" | User has no space | Redirect to signup |
| "Admin access required" | Role check failed | Show permission error |
| "Treasurer access required" | Payment role check | Show permission error |
| "Invalid invite code" | Code not found | Ask user to verify |
| "A space with this URL slug already exists" | Duplicate slug | Suggest different slug |

---

## Server actions added (migrations 016-026)

All are `'use server'` in `lib/actions/*`, re-exported from `lib/actions/index.ts`,
validate input with Zod via `parseInput`, authorize via `requireMember` /
`requireMemberWithRole`, scope writes by `member.space_id`, and `revalidatePath`.

### Governance — `proposals.ts`, `incidents.ts`, `policies.ts`
`createProposal`, `openProposal`, `castVote`, `decideProposal`, `withdrawProposal`, `deleteProposal`; `fileIncident`, `updateIncidentStatus`, `addIncidentUpdate`, `appealIncident`; `createPolicy`, `supersedePolicy`, `updatePolicyStatus`.

`trackIncident({ token })` — public, unauthenticated. An anonymous reporter's `fileIncident` returns a 192-bit `reporter_token` (UNIQUE column); this looks the case up by that token using the service client (anon has no RLS path) and returns a redacted projection via `lib/incident-logic.ts` `publicIncidentView` (board-only updates, subjects, decision-maker ids dropped; disposition only after decided/closed). Public page `/track` (in middleware PUBLIC_ROUTES); the filing UI deep-links `/track?token=`.

### Areas — `areas.ts`
`createArea`, `updateArea`, `deleteArea` (admin/board; delete admin).

### Forum + comments — `forum.ts`
`createForumThread`, `updateForumThread` (pin/lock = admin/board), `deleteForumThread`, `addComment`, `editComment`, `deleteComment`. All space-scoped in code.

### Chat channels — `comms.ts`
`createChannel` (any member), `renameChannel`, `deleteChannel` (creator or admin/board; default channels protected).

### Tiers / roles / invites — `tiers.ts`, `roles.ts`, `invites.ts`
`createTier`/`updateTier`/`deleteTier`; `upsertRoleLabel`, `createCustomRole`/`updateCustomRole`/`deleteCustomRole`, `assignCustomRole`/`unassignCustomRole`; `createInvite`/`updateInvite`/`deleteInvite`. Invites (migration 029) carry a granted `role` and usage caps (`max_uses`, single-use); `joinSpace` applies the invite's role. Who may grant which role is enforced by `lib/invite-logic.ts` `canAssignInviteRole` (admin → any; board → anything except admin). Space-scoped link `/join/[space]?code=` hands off to `/signup?invite=`.

### Onboarding — `onboarding.ts`
`createOnboardingStep`/`updateOnboardingStep`/`deleteOnboardingStep` (admin/board); `markOnboardingStepDone`, `finishOnboarding`, `skipOnboarding` (member; completion writes via the service client after the server-side required-steps check, so the self-change trigger cannot be bypassed).

### Permissions / Ops ACLs / area-lead — `permissions.ts`
`setRolePermissions(subject, permissions[])`, `setOpsAcl(entity_type, entity_id, roles[])` (admin/board), `createAreaLeadRole`, `assignAreaLead`, `unassignAreaLead`, `deleteAreaLeadRole`. ACLs are additive: empty list falls back to the item's default visibility.

### Secrets — `secrets.ts`
`createSecret`, `updateSecret`, `revealSecret` (server-only plaintext path, audit-logged, errors on corrupt ciphertext), `deleteSecret`. The list query never selects `value`/`encrypted_value`.

### Bulk import — `imports.ts`, `payments.ts`
`importMembers`, `importPaymentsCsv`: per-row Zod validation, lowercased emails, `flexibleDateTime` date normalization, enum-checked platform/tier, positive finite amounts; invalid rows skipped and returned as a `skipped` count.

### Forms & waivers: `forms.ts` (migrations 026-029)
Management actions are gated by `forms.manage` (checked via the `user_has_permission` RPC; the `forms` RLS independently enforces it):
- `getPublicForm({ space, slug })` — service-client read for the public `/f/[space]/[slug]` page; returns only a published, non-members form. `createForm(input)` — friendly error on slug collision (slug is unique per space, migration 028). `updateForm(input)` — slug is immutable; for a published waiver, a legal-text or schema change bumps `version` (existing submissions stay valid against their own snapshot, non-blocking re-sign). `setFormStatus(input)` — draft/published/closed. `deleteForm({formId, confirm:true})` — **permanently** deletes the form and FK-cascades every submission (including signed waivers); requires explicit `confirm:true` (a stale/accidental call cannot destroy records) and audits the destroyed count; the UI gates it behind a destructive confirm. `deleteSubmission({submissionId})` — `forms.manage`; permanently removes one submission via the service client (form_submissions has no client write policy), space-scoped, audited. `relinkAllSubmissions()` — `forms.manage`; re-runs email→member association across the whole space (members earliest-joined first for deterministic shared-email claim; reuses `linkSubmissionsByEmail`; NULL-only). `listForms()`, `getFormResults(input)`, `exportFormResultsCsv(input)` (audited via `activity_log`).
- `submitForm(input)` — public entry point (anonymous, signed-in non-member, or member by form `visibility`). Reads the form with the service client (anon has no `forms` grant), enforces visibility + waiver consent, validates `answers` against the stored field schema (`lib/forms-schema.ts`, unknown keys discarded), snapshots schema/legal-text/version, captures IP + user-agent, and writes the row with the service client (`form_submissions` has no write policy, so this is the only path; rows are immutable).
- `linkSubmissionsForMember(input)` — `forms.manage` admin manual re-link of prior submissions by email (kept for explicit re-linking).
- `listMemberSubmissions({ memberId })` — `forms.manage`; the forms a member has submitted (title, kind, version, date), for the per-member "Forms" panel on `/members`. Honors the `form_submissions`/`forms` RLS (no service-client bypass); metadata only — answers stay in the audited results surface.

Onboarding integration (Phase 4, migration 027): a `space_onboarding_steps` step can have `step_type = 'form'` with `config.form_id`. The onboarding flow renders the form/waiver and submits via `submitForm`; `finishOnboarding` treats a required form step as satisfied if a submission for that form by the member already exists (any version — re-sign is non-blocking), and fails open if the configured form is missing/unpublished so a misconfiguration cannot trap members.

Email-match association (PRODUCT DECISION 2026-05, owner-chosen — supersedes the earlier verified-email-only model): a submission is associated with a member whenever `submitter_email` matches a member in the space, **including raw anonymous public submissions**. Accepted tradeoff: someone could get a submission attributed to another member by typing that member's email (attribution only — grants no access). Paths: `submitForm` links at submit time (`pickMemberForEmail`, earliest-joined on duplicates; `escapeLike` makes `_`/`%` in addresses literal); `addMember` and email-changing `updateMember` call the shared `linkSubmissionsByEmail`; `claimMyAnonymousSubmissions()` (self-only, session-resolved) still runs from `joinSpace`/`finishOnboarding`; migration 039 backfilled existing rows. The inline note in `submitForm` flags this as intentional so an audit does not revert it.

### Certifications + Instructor: `certifications.ts` (migration 030)
Cert-type actions are gated by `certifications.manage`; grant actions by `certifications.grant` (the Instructor capability). Both checked via the `user_has_permission` RPC; the `certifications` / `member_certifications` RLS independently enforces the same permission.
- `createCertification(input)` / `updateCertification(input)` / `deleteCertification(input)` — manage. Name is unique per space (case-insensitive); friendly error on collision. `validity_months` null = never expires. `deleteCertification` is refused once the cert has been granted to anyone (archive via `updateCertification {is_active:false}` instead — grant history is immutable).
- `listCertifications()` — readable by a manager OR a granter (the admin list and the per-member award panel both need the catalog); returns all cert types for the caller's space (RLS-scoped), active first.
- `grantCertification(input)` — granter. Verifies the cert is in-space and active and the target member is in-space; computes `expires_at` from the cert's `validity_months` at grant time unless an explicit `expires_at` override is supplied; the partial unique index rejects a second active grant of the same cert to the same member with a friendly message.
- `revokeCertification(input)` — granter. Soft revoke (`revoked_at`/`revoked_by`/`revoked_reason`); refused if already revoked. No row is ever deleted (no DELETE policy; history immutable).
- `renewCertification(input)` — granter. Resets `granted_at` to now and recomputes expiry from the cert's current validity; a revoked grant is terminal (issue a fresh grant instead).
- `listMemberCertifications({ memberId })` — manager or granter; all grants for one member (joined with the cert) for the per-member award panel.
- `getMyCertifications()` — the signed-in member's own grants. No params: the member is resolved from the session and RLS independently restricts a member to their own rows (the `/me` view).

### Classes: `classes.ts` (migration 032)
Class/session management is gated by `classes.manage`; attendance/completion by `classes.instruct`. Member signup needs no permission (just membership). Gates use the `user_has_permission` RPC; the `classes`/`class_sessions`/`class_signups` RLS independently enforces the same.
- `createClass` / `updateClass` / `deleteClass` / `listClasses` — `classes.manage`. `deleteClass` is refused once the class has sessions (archive via `updateClass {is_active:false}`). `payment_link` is a generic http(s) link only (no payment integration); `grants_certification_id` is validated to be a cert in the space. `required_form_id` (migration 037) is validated via the service client to be a form in the space that is `published`; setting it hard-gates signup on a form submission being on file.
- `createSession` / `updateSession` / `deleteSession` — `classes.manage`. `updateSession` refuses `status:'completed'` (use `completeSession`); `deleteSession` refused if non-cancelled signups exist (cancel instead).
- `listUpcomingSessions()` — any member; upcoming non-cancelled sessions of active classes, joined with the class. `registered_count` is computed with the service client so a member sees "spots left" without being able to read who else signed up (`class_signups` SELECT hides other members); `my_status` is the caller's own signup status. When the class has a `required_form_id` it also returns `required_form { title, url, satisfied }` (the public `/f/{space}/{slug}` URL and whether THIS member has a submission on file) so the member surface can show/link the requirement.
- `signUpForClass(input)` / `cancelMySignup(input)` — any member. Validated service-client writes (`class_signups` has no INSERT/DELETE policy): `signUpForClass` checks eligibility (`canSignUp`), de-dupes, and registers vs waitlists by effective capacity. A `classes.manage` holder gets the override and may pass `memberId` to sign someone up on their behalf. If the class has a `required_form_id`, `signupFormEligibility` hard-blocks signup unless the target member has a `form_submissions` row for that form (checked via the service client, since a class manager need not hold `forms.manage`); the manager override bypasses the gate. `cancelMySignup` cancels (soft) and promotes the earliest waitlisted member when a registered seat frees (`pickPromotion`).
- `listSessionSignups(input)` — manager or instructor; the attendee list (name, status, attended) for a session. Surfaced both on the member page for instructors and behind a per-session "Signups" toggle on `/classes/manage`; members never see it.
- `markAttendance(input)` — `classes.instruct`; sets `attended` on a signup (RLS UPDATE = `classes.instruct`).
- `completeSession(input)` — `classes.instruct`; marks the session completed (validated service-client transition, since the `class_sessions` UPDATE policy is `classes.manage`). If the class has `grants_certification_id`, it awards the cert to each attended member **through the normal `grantCertification` path**, so it only happens when the acting instructor also holds `certifications.grant`; otherwise completion still succeeds and the result reports `certificatesSkipped: true`.
- `getMyClassSignups()` — the signed-in member's own signups (joined session + class). No params; RLS restricts to own rows (the `/me` view).

### Equipment: `equipment.ts` (migration 033)
Registry management is gated by `equipment.manage`; reserving needs only membership (gated by equipment status and the optional required certification). Gates use the `user_has_permission` RPC; the `equipment`/`equipment_reservations` RLS independently enforces the same.
- `createEquipment` / `updateEquipment` / `deleteEquipment` / `listEquipment` — `equipment.manage`. `deleteEquipment` is refused once the item has reservations (archive via `updateEquipment {is_active:false}`). `required_certification_id` is validated to be a cert in the space.
- `listEquipmentForMembers()` — any member; active equipment with the required-cert name and a `member_certified` flag (computed with the service client so the gate can be shown up front without exposing other members' certifications).
- `reserveEquipment(input)` / `cancelReservation(input)` — any member. Validated service-client writes (`equipment_reservations` has no INSERT/DELETE policy): `reserveEquipment` runs `reservationEligibility` (status/active, future window, `hasConflict` no-overlap, required-cert) — a holder of `equipment.manage` gets the override and may pass `memberId` to book on someone's behalf; `cancelReservation` allows the owner or an `equipment.manage` holder.
- `listEquipmentReservations(input)` — `equipment.manage`; reservations for one item (joined member name) for the schedule view. Surfaced behind a per-item "Reservations" toggle on `/equipment/manage` (who reserved + window + status, with a manager Cancel).
- `getMyReservations()` — the signed-in member's own reservations (joined equipment). No params; RLS restricts to own rows (the `/me` view).

### Door epic: `member-cards.ts` (migration 034) + `door.ts` (migrations 035-036)
Card UID is a credential. `member-cards.ts`: `addMemberCard`/`updateMemberCard`/`deleteMemberCard`/`listMemberCards` are `door.manage` (full UID); `getMyCards()` is the member's own MASKED view (service client, returns only count + last4, never the raw UID — `member_cards` has no member RLS SELECT).
`door.ts` (all `door.manage` except the read log): `createDoorConnection`/`updateDoorConnection`/`deleteDoorConnection`/`listDoorConnections`; `listSecretTitles()` (titles only, to pick a vault secret for the password). `testDoorConnection(input)` runs only the `status` verb through the hardened executor and writes one redacted audit row. `listDoorAccessLog()` is `door.manage` OR `door.operate`. Security model: the shared password is read from the AES-256-GCM secrets vault server-side and embedded in the request per the verified firmware (auth is a query param); `lib/door/executor.ts` is the single egress — it enforces `validateDoorTarget` (request host must equal the connection's pinned host; metadata/link-local always blocked; http(s) only), refuses redirects, caps time/body, and `redactDoorSecrets` scrubs the password before anything is logged. Native HeatSync verbs are encoded with the verified fixed-width zero-padding (slot 3 / perm 3 / tag 8 / `&e=` password); generic connections use admin `{slot}/{tag}/{pw}` templates.

Phase 3 live actions (all `door.operate`, rate-limited, every attempt writes one redacted `door_access_log` row, service client after the permission check since operators have no RLS read on `door_connections`/`member_cards`): `grantCard({connectionId, cardId, permissionMask?})` allocates the card's per-connection integer slot via the pure lowest-free allocator (`door_card_slots`; idempotent re-grant, `slot_exhausted` when full), reserves it in the DB first, calls the controller, and rolls the reservation back if the call fails. `revokeCard({connectionId, cardId})` is idempotent (no slot assigned means already revoked) and frees the slot only on confirmed controller success so the app's map never diverges from the device. `doorControl({connectionId, verb})` with `verb` of `open`/`unlock`/`lock` (HeatSync `open` is a momentary `o1`; generic controllers need the matching verb template) touches no slot.

Member self-entry (no permission code; any active member): `selfEntry({connectionId})` triggers a momentary OPEN only, allowed only when the connection is `is_enabled` AND `allow_member_self_entry` AND the caller has at least one active `member_card` on file (the locked eligibility rule: a `door_card_slots` row is NOT required). Membership and cards are resolved server-side, so a member can only ever open a door for themselves; never unlock/lock/grant/revoke, never anonymous. Strict per-member rate limit (5/min), one redacted `door_access_log` row `action='self_entry'` (`target_member_id` = self), through the same hardened executor. `listSelfEntryDoors()` returns the enabled self-entry connections for the caller's space, but only when the caller has an active card (otherwise empty), so the surface is hidden for ineligible members. `listMyDoorActivity()` returns the caller's own `door_access_log` rows (actor or target; service client after `requireMember`; `detail` is already secret-redacted at write time). Surfaced as a "Door access" panel on the dashboard and on the member `/doors` page (self-entry + masked own cards via `getMyCards` + recent personal activity).

### Presence & attendance: `presence.ts` (migration 038)
No permission code; any active member. All writes are self-only — the member is resolved server-side, never taken from input — and go through validated service-client actions (`space_visits` has no client write policy). Pure logic in `lib/presence-logic.ts` (`presenceStatus`, `hostEligibility`, `summarizePresence`) is unit-tested.
- `checkIn({asHost?, note?})` — opens a visit. Enforces one open visit per member (partial unique index); if an existing open visit is stale (`presenceStatus` past `PRESENCE_MAX_OPEN_HOURS`, 18h) it is auto-closed first (handles forgotten check-outs without a cron), and a fresh existing open visit is rejected ("already checked in"). `asHost` runs `hostEligibility`: if `spaces.host_requires_card` (default true) the caller must have an active `member_card` on file (count checked via the service client); a space may flip the toggle off to let anyone self-mark host. Writes an `activity_log` row.
- `checkOut({note?})` — closes the caller's current open visit (optional note). Errors if not checked in.
- `listPresentNow()` — any member; who is currently here (open visits with staleness filtered out in pure logic), with `isHost`/`isMe` flags. Presence is intentionally visible to all space members.
- `getMyVisits()` — the caller's own recent visits (the `/me` history).
- `listAttendance()` — any member (org-wide attendance history is all-members by product decision); last 250 visits with computed status. No new permission code; managers are not special here.
Surfaced as the "Who's here" panel on the dashboard (present list + self check-in/out + host + note), the `/attendance` page (all members), and "My recent visits" on `/me`.

### Previously-undocumented actions (audit addendum)
- `updateMyProfile(input)` — `members.ts`; any member edits their own profile fields (self-scoped).
- `discloseAffiliations(input)` — `members.ts`; the member records their own conflict-of-interest affiliations.
- `updateSpaceVisibility(input)` — `settings.ts`; admin toggles space/member-directory visibility.
- `listDoorCards(input)` — `door.ts`; `door.operate`, service client; active cards for a connection's grant/revoke UI, returning only the masked `last4` (raw UID never returned).

### Stripe recurring dues: `stripe.ts` + `lib/stripe/*` + webhook (migration 040)
Per-space OWN Stripe account (NOT Connect). Pure mapping in `lib/stripe-logic.ts` (pinned `STRIPE_API_VERSION`, `duesMemberStatus`, `graceExceeded`, `priceIdForTier`, `isStripeConfigured`) is unit-tested. Server helpers in `lib/stripe/config.ts` (vault store/read of the secret key + webhook signing secret — door secret pattern; `getStripeConfig`) and `lib/stripe/client.ts` (`getStripe`: a per-request client with the space's decrypted key + pinned apiVersion — never global, never client).
- `getStripeSettings()` / `saveStripeSettings(input)` — Admin only. Settings view returns status flags only, **never secret values**; save is write-only for secrets (blank = keep), config (mode, publishable key, tier→price map, grace days) in `integrations.config`, secrets encrypted in the vault.
- `startDuesCheckout()` — any member; resolves the caller + their tier server-side, ensures a Stripe Customer (reuse/create + `member_billing` upsert), returns a hosted Checkout Session URL in `subscription` mode with `client_reference_id` + metadata on the session AND `subscription_data.metadata`.
- `startBillingPortal()` — any member with a customer; returns a Stripe Billing Portal URL (self-serve card/plan/cancel; the space must activate the Portal in its Stripe Dashboard once).
- `getMyBilling()` — the caller's own billing status (service client; `member_billing` is admin-RLS, mirrors `getMyCards`). `listMemberBilling()` — admin/board/treasurer dues view.
- Webhook `POST /api/stripe/webhook/[space]` (nodejs, force-dynamic, unauthenticated by design — verify is signature-based; `proxy.ts` whitelists `/api/stripe/webhook` so the unauthenticated call is not redirected to `/login`): raw `req.text()` body, loads THAT space's secret + signing secret from the vault, `constructEvent`, idempotency via `stripe_webhook_events` PK (replay→200). On `checkout.session.completed` / `customer.subscription.*` / `invoice.paid|payment_succeeded`: upsert `member_billing`, record a `stripe` `payments` row, and map `duesMemberStatus`+`graceExceeded` onto `space_members.status` (only `current`↔`late` — never auto-inactive or auto-approve `unverified`; `last_paid_at` on paid). Member resolved by metadata then customer id, always space-scoped. It also enqueues dues-lifecycle notifications (see below). Bad signature/config → 400; handler error → 500 (Stripe retries; idempotency-safe).

### Transactional notifications: `notifications.ts` + `lib/email/*` + dispatcher (migrations 041, 047)
Outbox + dispatcher; the webhook never sends inline. Pure render + dedupe in `lib/notifications-logic.ts` (`renderDuesEmail`, `duesDedupeKey`, `isTerminalAttempt`, `MAX_NOTIFICATION_ATTEMPTS`, plus the Phase 4 additions below) is unit-tested. `lib/email/send.ts` (`sendEmail`) is the transport seam over Resend's HTTP API (no SDK; `fetch`), returning `{ ok, id } | { ok:false, error, retryable }`; unset `RESEND_API_KEY`/`EMAIL_FROM` is a non-retryable no-op. A shared best-effort helper `lib/notifications/enqueue.ts` (`resolveMemberContact`, `enqueueNotification`, `getSpaceName`, `buildManageUrl`) is the only enqueue path; it never throws into the calling action.
- The Stripe webhook enqueues into `notifications` (`ignoreDuplicates` on the `(space_id, dedupe_key)` unique index, so an event replay is a no-op): `invoice.paid` → `dues_renewed`, `invoice.payment_failed` → `dues_payment_failed`, transition to `late` (in `applySubscription`) → `dues_lapsed`. Recipient + space name resolved server-side; never sends inline.
- Phase 4 event types (no schema change to `notifications`; the `type` column is `text`):
    - `reserveEquipment` → `booking_confirmed` (always, to the booked-for member, so a manager booking on someone's behalf still emails the target). `cancelReservation` → `booking_cancelled` ONLY when the actor is not the affected member (self-cancels stay silent).
    - `signUpForClass` → `class_signup_registered` or `class_signup_waitlisted` (picked from `class_signup_tx`'s returned status, so a manager signing someone up still emails the target with the right copy). `cancelMySignup` → `class_signup_promoted` to whoever `class_cancel_tx` returned as `promoted_id`. `updateSession` setting `status='cancelled'` → `class_session_cancelled` fanned out to every still-active signup (dedupe by `(session, member)`).
    - `submitForm` → `form_submission_received` ONLY when the submitter is authenticated (recipient = verified `user.email`, never the typed body email; anonymous public submissions skip the confirmation because confirming to a typed address is a victim-spam vector). Plus `form_submission_admin` fanned out to every member who holds `forms.manage` (link goes to `/forms/<id>/results`; dedupe by `(submission, admin)`). The fan-out uses the new `members_with_permission(sid, perm)` SQL helper (migration 047), the inverted set-returning form of `user_has_permission`.
- Dispatcher `POST /api/cron/notifications` (nodejs, force-dynamic; constant-time `CRON_SECRET` bearer; 503 if unset, 401 on mismatch; `proxy.ts` whitelists `/api/cron`). Drains ≤20 oldest `pending` email rows with `attempts < MAX`, sends with the row id as Resend `Idempotency-Key` (overlap-safe), ~4.5/s spacing. Success → `sent`+`sent_at`; failure → `attempts++`, `pending` if retryable and budget remains else `failed`. Returns `{ scanned, sent, failed, retried }`. Hit once a minute by the droplet crontab.
- `getMyNotifications()` — the caller's own last 15 notifications (service client; `notifications` is admin-RLS, mirrors `getMyBilling`). Surfaced read-only on `/me`.
- `getMyPayments()` — the caller's own last 50 payments (service client; `payments` SELECT is treasurer-scoped, so the self-view is strictly scoped to the caller's `space_id` + `member_id`, same convention as `getMyBilling`). Surfaced read-only in the `/me` Membership tab.

### Member self-serve portal (`/me`, product spine Phase 3)
`/me` is a 3-tab portal (Profile / Membership / Activity); the server page fetches, a client component renders. Profile editing reuses `updateMyProfile` + `discloseAffiliations` (affiliations re-disclosed only when changed, so the COI timestamp is preserved). Class signups / reservations are cancellable inline via the existing `cancelMySignup` / `cancelReservation` (ownership + space scoping still enforced server-side).
- `requestEmailChange({ email })` — member-initiated login-email change. Validates with `emailChangeSchema`, requires an active member, calls `supabase.auth.updateUser({ email }, { emailRedirectTo: {origin}/auth/confirm })`. With "Secure email change" on (recommended), Supabase double-confirms (old + new); the change applies to `auth.users` only after both links. Returns `{ success }` / `{ error }` (error includes "email already in use"). NEVER writes the denormalized email here.
- `GET /auth/confirm` — email-change landing. Reads `token_hash` + `type`, calls `verifyOtp({ type: 'email_change', token_hash })`, and on success syncs `space_members.email` (service client, by `user_id`) to the now-authoritative `auth.users` email — idempotent, post-verification only. Whitelisted in `proxy.ts` (exact path; link is clicked with no session). Requires Supabase project config (see DEPLOYMENT).
