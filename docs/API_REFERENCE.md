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

**File**: `lib/actions.ts`

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

### Areas — `areas.ts`
`createArea`, `updateArea`, `deleteArea` (admin/board; delete admin).

### Forum + comments — `forum.ts`
`createForumThread`, `updateForumThread` (pin/lock = admin/board), `deleteForumThread`, `addComment`, `editComment`, `deleteComment`. All space-scoped in code.

### Chat channels — `comms.ts`
`createChannel` (any member), `renameChannel`, `deleteChannel` (creator or admin/board; default channels protected).

### Tiers / roles / invites — `tiers.ts`, `roles.ts`, `invites.ts`
`createTier`/`updateTier`/`deleteTier`; `upsertRoleLabel`, `createCustomRole`/`updateCustomRole`/`deleteCustomRole`, `assignCustomRole`/`unassignCustomRole`; `createInvite`/`updateInvite`/`deleteInvite`.

### Onboarding — `onboarding.ts`
`createOnboardingStep`/`updateOnboardingStep`/`deleteOnboardingStep` (admin/board); `markOnboardingStepDone`, `finishOnboarding`, `skipOnboarding` (member; completion writes via the service client after the server-side required-steps check, so the self-change trigger cannot be bypassed).

### Permissions / Ops ACLs / area-lead — `permissions.ts`
`setRolePermissions(subject, permissions[])`, `setOpsAcl(entity_type, entity_id, roles[])` (admin/board), `createAreaLeadRole`, `assignAreaLead`, `unassignAreaLead`, `deleteAreaLeadRole`. ACLs are additive: empty list falls back to the item's default visibility.

### Secrets — `secrets.ts`
`createSecret`, `updateSecret`, `revealSecret` (server-only plaintext path, audit-logged, errors on corrupt ciphertext), `deleteSecret`. The list query never selects `value`/`encrypted_value`.

### Bulk import — `imports.ts`, `payments.ts`
`importMembers`, `importPaymentsCsv`: per-row Zod validation, lowercased emails, `flexibleDateTime` date normalization, enum-checked platform/tier, positive finite amounts; invalid rows skipped and returned as a `skipped` count.

### Forms & waivers — `forms.ts` (migration 026)
Management actions are gated by `forms.manage` (checked via the `user_has_permission` RPC; the `forms` RLS independently enforces it):
- `createForm(input)` — friendly error on slug collision (slug is globally unique). `updateForm(input)` — slug is immutable; for a published waiver, a legal-text or schema change bumps `version` (existing submissions stay valid against their own snapshot, non-blocking re-sign). `setFormStatus(input)` — draft/published/closed. `deleteForm(input)` — refused if the form has any submissions (close instead; submissions are immutable records). `listForms()`, `getFormResults(input)`, `exportFormResultsCsv(input)` (audited via `activity_log`).
- `submitForm(input)` — public entry point (anonymous, signed-in non-member, or member by form `visibility`). Reads the form with the service client (anon has no `forms` grant), enforces visibility + waiver consent, validates `answers` against the stored field schema (`lib/forms-schema.ts`, unknown keys discarded), snapshots schema/legal-text/version, captures IP + user-agent, and writes the row with the service client (`form_submissions` has no write policy, so this is the only path; rows are immutable).
- `linkSubmissionsForMember(input)` — `forms.manage` admin manual-link of prior anonymous submissions by email. The automatic verified-email retro-link is Phase 5.

Onboarding integration (Phase 4, migration 027): a `space_onboarding_steps` step can have `step_type = 'form'` with `config.form_id`. The onboarding flow renders the form/waiver and submits via `submitForm`; `finishOnboarding` treats a required form step as satisfied if a submission for that form by the member already exists (any version — re-sign is non-blocking), and fails open if the configured form is missing/unpublished so a misconfiguration cannot trap members.

Retro-link (Phase 5): `claimMyAnonymousSubmissions()` is a safe, self-only, verified-email-gated action — it resolves the member/email from the caller's session (no trusted params), so a client can only ever link its own anonymous submissions, and only with a confirmed email (the locked decision). It is invoked best-effort from `joinSpace` (new membership, verified email) and `finishOnboarding`. `addMember`/`importMembers` are deliberately NOT auto-linked: those emails are admin-asserted, not verified, so auto-linking would violate the verified-email rule and risk mis-attributing a waiver; the admin uses the forms.manage `linkSubmissionsForMember` for those (the "admin manual-link" path).
