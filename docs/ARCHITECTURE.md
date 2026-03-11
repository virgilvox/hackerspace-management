# Hackerspace.sh - Architecture Documentation

> **Last Updated**: 2026-03-10  
> **Version**: 1.0.0  
> **Status**: Pre-Production Audit

---

## 1. System Overview

Hackerspace.sh is a comprehensive member management platform designed for hackerspaces, makerspaces, and community workshops. It provides tools for:

- **Member Management**: Registration, approval workflows, role assignment, payment tracking
- **Task & Chore System**: Recurring tasks, assignment, claiming, completion tracking
- **Project Management**: Kanban-style project tracking with area assignments
- **Financial Operations**: Payment reconciliation, multi-platform integration (PayPal, Zeffy, Venmo)
- **Communications**: Real-time chat via Supabase Realtime
- **Knowledge Base**: Documentation, secrets vault, area lead management
- **Contacts Management**: Vendor, supplier, and partner directory

---

## 2. Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.x | React framework with App Router |
| React | 19.2 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | Latest | Component library |
| Lucide React | Latest | Icons |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Supabase | Latest | PostgreSQL database, Auth, Realtime |
| Next.js Server Actions | - | Server-side mutations |
| Row Level Security (RLS) | - | Database-level authorization |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Vercel | Hosting, Edge Functions |
| Supabase Cloud | Database, Auth, Realtime subscriptions |

---

## 3. Project Structure

```
/
├── app/                          # Next.js App Router
│   ├── (app)/                    # Protected app routes (require auth)
│   │   ├── comms/               # Real-time chat
│   │   ├── contacts/            # Vendor/supplier directory
│   │   ├── dashboard/           # Main dashboard
│   │   ├── import/              # CSV/database import
│   │   ├── members/             # Member management
│   │   ├── ops/                 # Knowledge base, secrets, area leads
│   │   ├── payments/            # Payment reconciliation
│   │   ├── projects/            # Project kanban
│   │   ├── settings/            # Space settings, integrations
│   │   ├── tasks/               # Tasks & chores
│   │   └── layout.tsx           # App shell with sidebar
│   ├── auth/                    # Auth callback routes
│   ├── login/                   # Login page
│   ├── signup/                  # Signup flow (create/join space)
│   ├── globals.css              # Global styles
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Landing page (redirect)
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── app-shell.tsx            # App wrapper
│   ├── app-sidebar.tsx          # Navigation sidebar
│   ├── task-claim-button.tsx    # Task claiming component
│   └── theme-provider.tsx       # Dark/light theme
├── lib/
│   ├── supabase/
│   │   ├── admin.ts             # Service role client (bypasses RLS)
│   │   ├── client.ts            # Browser client
│   │   ├── proxy.ts             # Middleware session refresh
│   │   └── server.ts            # Server Component client
│   ├── actions.ts               # All server actions (CRUD)
│   ├── auth-actions.ts          # Auth-specific actions
│   ├── types.ts                 # TypeScript interfaces
│   └── utils.ts                 # Utility functions (cn)
├── scripts/                     # SQL migrations
│   ├── 000_reset_schema.sql    # Schema reset (dev only)
│   ├── 001_create_schema.sql   # Initial schema
│   ├── 002-011_*.sql           # Incremental fixes
│   └── patch-dashboard.mjs     # Utility script
├── middleware.ts                # Auth middleware
├── docs/                        # This documentation
└── [config files]               # next.config, tsconfig, etc.
```

---

## 4. Authentication Flow

### 4.1 Sign Up (New User)

```
[User] → /signup
    │
    ├─→ Step 1: Account info (name, email, password)
    ├─→ Step 2: Choose Create or Join space
    │
    ├─→ [Create Space Flow]
    │   └─→ supabase.auth.signUp() with metadata:
    │       {
    │         space_action: 'create',
    │         space_name, space_slug, space_city, invite_code
    │       }
    │       └─→ DB Trigger: handle_space_signup()
    │           └─→ INSERT spaces → INSERT space_members (admin)
    │
    └─→ [Join Space Flow]
        └─→ supabase.auth.signUp() with metadata:
            {
              space_action: 'join',
              join_invite_code
            }
            └─→ DB Trigger: handle_space_signup()
                └─→ INSERT space_members (member, status based on require_approval)
```

### 4.2 Sign In

```
[User] → /login
    │
    └─→ supabase.auth.signInWithPassword()
        └─→ Middleware refreshes session
            └─→ App layout checks space_members
                └─→ Has membership? → /dashboard
                └─→ No membership? → /signup
```

### 4.3 Returning User (Authenticated, No Space)

```
[User] → /signup (with active session)
    │
    └─→ Detects user via supabase.auth.getUser()
        └─→ Shows space selection (create/join) only
            └─→ Calls server action: createSpace() or joinSpace()
                └─→ Uses admin client (bypasses RLS)
```

---

## 5. Database Schema

### 5.1 Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `spaces` | Hackerspace instances | id, name, slug, invite_code, require_approval |
| `space_members` | User membership records | user_id, space_id, role, tier, status, approved |
| `tasks` | Tasks and chores | type, status, area, claimed_by, recurrence |
| `projects` | Project tracking | status (kanban), area, tags, due_date |
| `knowledge_base` | Documentation | visibility, is_pinned, area |
| `secrets` | Encrypted credentials | value, area (admin only) |
| `area_leads` | Area leadership | area_code, lead_id, status |
| `contacts` | Vendor directory | contact_type, group_label |
| `payments` | Payment records | platform, amount, member_id, link_status |
| `comms_channels` | Chat channels | channel_type, area_reference |
| `comms_messages` | Chat messages | channel_id, user_id, content |
| `integrations` | Platform connections | platform, is_connected, config |
| `activity_log` | Audit trail | action, entity_type, entity_id |

### 5.2 Enums (Exact Values)

| Enum | Values |
|------|--------|
| `member_role` | admin, board, treasurer, member, associate |
| `member_tier` | plus, basic, associate |
| `member_status` | current, late, inactive, unverified |
| `task_type` | chore, task |
| `task_status` | open, claimed, in_progress, overdue, due_today, completed, done, blocked |
| `recurrence_type` | none, daily, weekly, biweekly, monthly |
| `project_status` | backlog, in_progress, review, done, blocked |
| `kb_visibility` | all_members, board, admin_only |
| `contact_type` | vendor, supplier, partner, landlord, city |
| `payment_platform` | paypal, zeffy, venmo, cash |
| `payment_link_status` | linked, unlinked |
| `channel_type` | general, area, ops, project |

---

## 6. Authorization Model

### 6.1 Role Hierarchy

```
Admin (full access)
  │
  ├─ Board (members, payments, projects, board-level secrets)
  │   │
  │   ├─ Treasurer (payments, financial data)
  │   │
  │   └─ Member (tasks, projects, comms, public KB)
  │       │
  │       └─ Associate (read-only, can claim chores)
```

### 6.2 RLS Policies Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `spaces` | Own space | Admin client | Admin | - |
| `space_members` | Same space | Self/Admin | Self/Admin | Admin |
| `tasks` | Members | Members | Members | Members |
| `projects` | Members | Members | Members | Members |
| `knowledge_base` | Members (visibility-scoped) | Members | Members | Board/Admin |
| `secrets` | Admin/Board | Admin | Admin | Admin |
| `payments` | Treasurer/Board/Admin | Treasurer/Admin | Treasurer/Admin | Treasurer/Admin |
| `comms_*` | Members | Members | - | Board/Admin |

---

## 7. Server Actions Reference

### 7.1 Authentication (`lib/auth-actions.ts`)

| Action | Parameters | Role Required | Description |
|--------|------------|---------------|-------------|
| `signIn` | email, password | None | Authenticate user |
| `signUp` | email, password, fullName, action, ... | None | Create account |
| `signOut` | - | Authenticated | End session |
| `getUser` | - | Authenticated | Get current user |
| `getCurrentMembership` | - | Authenticated | Get member + space |
| `createSpace` | spaceName, spaceSlug, spaceCity, displayName | Authenticated | Create new space |
| `joinSpace` | inviteCode, displayName | Authenticated | Join existing space |

### 7.2 Tasks (`lib/actions.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `createTask` | title, description?, type, area?, recurrence?, due_date? | Member |
| `claimTask` | taskId | Member |
| `completeTask` | taskId | Claimant |
| `deleteTask` | taskId | Member |

### 7.3 Projects (`lib/actions.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `createProject` | title, description?, area?, tags?, due_date? | Member |
| `updateProjectStatus` | projectId, status | Member |
| `deleteProject` | projectId | Member |

### 7.4 Members (`lib/actions.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `addMember` | display_name, email, phone?, handle?, tier, role, ... | Admin/Board |
| `updateMember` | memberId, updates | Admin/Board |
| `approveMember` | memberId | Admin/Board |
| `removeMember` | memberId | Admin |
| `importMembers` | rows[] | Admin/Board |

### 7.5 Payments (`lib/actions.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `logCashPayment` | amount, from_note, member_id?, transaction_date? | Treasurer/Admin |
| `linkPaymentToMember` | paymentId, memberId | Treasurer/Admin |
| `importPaymentsCsv` | rows[] | Treasurer/Admin |

### 7.6 Knowledge Base & Secrets (`lib/actions.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `createKbEntry` | title, content, area?, visibility?, is_pinned?, tags? | Member |
| `updateKbEntry` | entryId, updates | Member |
| `deleteKbEntry` | entryId | Board/Admin |
| `createSecret` | title, value, description?, area? | Admin/Board |
| `deleteSecret` | secretId | Admin |
| `upsertAreaLead` | area_code, area_name, lead_id?, lead_handle?, status? | Admin/Board |

### 7.7 Contacts (`lib/actions.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `createContact` | name, contact_type, email?, phone?, ... | Member |
| `updateContact` | contactId, updates | Member |
| `deleteContact` | contactId | Member |

### 7.8 Settings (`lib/actions.ts`)

| Action | Parameters | Role Required |
|--------|------------|---------------|
| `updateSpaceSettings` | name?, slug?, city?, require_approval?, public_member_directory? | Admin |
| `saveIntegration` | platform, config | Admin |
| `disconnectIntegration` | platform | Admin |
| `rotateWebhookSecret` | - | Admin |

---

## 8. Real-time Features

### 8.1 Comms (Chat)

The comms feature uses Supabase Realtime for live messaging:

```typescript
// Client-side subscription
const subscription = supabase
  .channel(`channel:${channelId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'comms_messages',
    filter: `channel_id=eq.${channelId}`
  }, payload => {
    setMessages(prev => [...prev, payload.new])
  })
  .subscribe()
```

### 8.2 Default Channels

Created automatically via DB trigger when a space is created:
- `general` - General discussion
- `announcements` - Official announcements
- `random` - Off-topic
- `facilities` - Building/equipment issues

---

## 9. File Structure Details

### 9.1 Page Components Pattern

Each feature follows a consistent pattern:

```
feature/
├── page.tsx          # Server Component - fetches data
└── feature-client.tsx # Client Component - UI + interactivity
```

**Example: Tasks**
- `page.tsx`: Fetches tasks, members, passes to client
- `tasks-client.tsx`: Renders tabs, modals, handles CRUD actions

### 9.2 Supabase Client Usage

| Location | Client | Use Case |
|----------|--------|----------|
| Server Components | `lib/supabase/server.ts` | Data fetching with RLS |
| Client Components | `lib/supabase/client.ts` | Realtime, client mutations |
| Server Actions | `lib/supabase/server.ts` | Protected mutations |
| Admin Operations | `lib/supabase/admin.ts` | Bypasses RLS (signup) |
| Middleware | `lib/supabase/proxy.ts` | Session refresh |

---

## 10. Security Considerations

### 10.1 RLS (Row Level Security)

All tables have RLS enabled. Policies enforce:
- Users can only see data from their space
- Role-based write permissions
- Admin client used only for initial space/member creation

### 10.2 Admin Client Safety

The admin client (`SUPABASE_SERVICE_ROLE_KEY`) is used ONLY for:
1. Creating spaces during signup (trigger handles member creation)
2. Adding first member to space
3. Operations where RLS would create circular dependencies

**Never expose to client-side code.**

### 10.3 Secrets Storage

Integration credentials stored in `integrations.config` (JSONB):
- Values stored with `_set` indicators
- UI shows masked values
- Consider encryption at rest for production

---

## 11. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin operations |
| `SUPABASE_JWT_SECRET` | Yes | JWT verification |

---

## 12. Migration History

| Script | Description |
|--------|-------------|
| 001 | Initial schema (13 tables, all enums) |
| 002 | Schema fixes, create_default_channels trigger |
| 003 | Signup trigger (handle_space_signup) |
| 004 | RLS helper functions |
| 005 | Additional RLS fixes |
| 006 | Comprehensive RLS rewrite |
| 007 | Added task_status 'done', contacts note/group_label |
| 008 | space_members.approved default=true |
| 009 | Member INSERT RLS, UNIQUE(space_id,email) |
| 010 | Fixed channel trigger (removed description column) |
| 011 | Fixed enum values (active→current, pending→unverified) |

---

## 13. Known Limitations

1. **No test suite** - Unit, integration, and E2E tests needed
2. **Payment integrations** - UI only, no actual OAuth/API
3. **Import feature** - UI only, no file processing
4. **Database connector** - UI only, not implemented
5. **Social auth** - GitHub/Google buttons present but not wired
6. **Webhook endpoint** - URL shown but no actual endpoint
7. **Email notifications** - Not implemented
8. **Search** - Client-side only, no full-text search
