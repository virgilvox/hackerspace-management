# Hackerspace.sh - Full Audit & Implementation Plan

## Critical Auth/Signup Issues (BLOCKING)

### 1. Signup Flow Completely Broken ❌
**Problem**: Signup page tries to manually insert spaces/members after auth.signUp, but RLS blocks it because user isn't confirmed yet (no session, auth.uid() = null)

**Fix**: Update signup to pass ALL metadata to trigger, remove manual inserts
- Pass `space_action`, `space_name`, `space_slug`, `space_city`, `invite_code` (for create)
- Pass `space_action`, `join_invite_code` (for join)
- Remove all manual supabase.from() inserts
- Trigger (003_signup_trigger.sql) already handles everything with security definer

**Files**: `/app/signup/page.tsx`

### 2. App Layout References Non-Existent Column ❌
**Problem**: Layout queries `approved` column but schema only has `status`

**Fix**: Change `.eq('approved', true)` to `.eq('status', 'active')`

**Files**: `/app/(app)/layout.tsx`

### 3. Login/Signup UI Changed from V5 ❌
**Problem**: User says login/signup UI changed from mockup version

**Fix**: Restore exact dark theme with lime-yellow accent (#d4f53c), grid background, monospace everything
- Login: same styling as mockup screenshot
- Signup: single-step form with inline "Create/Join" toggle, not two-step flow

**Files**: `/app/login/page.tsx`, `/app/signup/page.tsx`

---

## UI/UX Issues

### 4. Dashboard Has Undefined Variables ❌
**Problem**: Dashboard references `activeMembers`, `openPayments`, `openTasks`, `tasks`, `projects`, `activity` but never queries them

**Fix**: Add proper Supabase queries for all stats and data

**Files**: `/app/(app)/dashboard/page.tsx`

### 5. Comms Incorrectly Attributes CLASP ❌
**Problem**: Comms says "powered by CLASP" but we're using Supabase Realtime, not the CLASP relay

**Fix**: Remove CLASP attribution entirely

**Files**: `/app/(app)/comms/comms-client.tsx`

### 6. App Shell Component Not Used ❌
**Problem**: AppShell component exists but layout doesn't use it

**Fix**: Update layout to use AppShell wrapper

**Files**: `/app/(app)/layout.tsx`, `/components/app-shell.tsx`

---

## Non-Functional Features (UI-Only, No Backend)

### 7. Payment Integration Buttons Do Nothing ❌
**Problem**: PayPal/Zeffy/Venmo "Connect" buttons are placeholders

**Fix**: Implement OAuth flows + API key management for each:
- **PayPal**: OAuth 2.0 → store credentials encrypted → sync transactions API
- **Zeffy**: API key input → store encrypted → webhook listener
- **Venmo**: Business API (if available) or manual CSV import fallback

**Files**: `/app/(app)/settings/settings-client.tsx`, create `/app/api/integrations/[platform]/route.ts`

### 8. Payment Reconciliation "Link Member" Buttons Do Nothing ❌
**Problem**: Clicking "+ Link member" does nothing

**Fix**: Create modal/dialog with member search/select, update payment.member_id

**Files**: `/app/(app)/payments/page.tsx`

### 9. Sync Platforms Button Does Nothing ❌
**Problem**: "Sync Platforms" button is placeholder

**Fix**: Call APIs for connected platforms, fetch recent transactions, insert/update payments table

**Files**: `/app/(app)/payments/page.tsx`

### 10. Log Cash Button Does Nothing ❌
**Problem**: "Log Cash" button is placeholder

**Fix**: Create dialog to manually log cash payment with amount, member, date, note

**Files**: `/app/(app)/payments/page.tsx`

### 11. Settings "Save Changes" Doesn't Actually Save ❌
**Problem**: Settings has client-side state but doesn't persist beyond current session

**Fix**: Verify Update queries are working, add error handling

**Files**: `/app/(app)/settings/settings-client.tsx`

### 12. Import/Sync CSV Upload Does Nothing ❌
**Problem**: CSV upload UI exists but file handling is incomplete

**Fix**: Add file upload → parse CSV → preview → map columns → validate → batch insert with error handling

**Files**: `/app/(app)/import/page.tsx`

### 13. Database Connector Doesn't Connect ❌
**Problem**: "Connect & Map Schema" button placeholder

**Fix**: Implement connection string parsing → test connection → fetch schema → generate mapping → preview import

**Files**: `/app/(app)/import/page.tsx`

### 14. Task/Chore "Claim" Buttons Don't Work ❌
**Problem**: Claim buttons are placeholders

**Fix**: Update task status to 'claimed', set claimed_by to current user, refresh data

**Files**: `/app/(app)/dashboard/page.tsx`, `/app/(app)/tasks/page.tsx`

### 15. Quick Task Button Goes Nowhere ❌
**Problem**: "+ Quick Task" button links to non-existent `/tasks/new`

**Fix**: Create task creation modal or page

**Files**: `/app/(app)/dashboard/page.tsx`, create `/app/(app)/tasks/new/page.tsx` or modal

### 16. Members Page "Add Member" Does Nothing ❌
**Problem**: "+ Add Member" button placeholder

**Fix**: Create modal to manually add member or send invite

**Files**: `/app/(app)/members/page.tsx`

### 17. Projects "New Project" Does Nothing ❌
**Problem**: "+ New Project" button placeholder

**Fix**: Create project creation modal/page

**Files**: `/app/(app)/projects/page.tsx`

### 18. Contacts "Add Contact" Does Nothing ❌
**Problem**: "+ Add Contact" button placeholder

**Fix**: Create contact creation modal/page

**Files**: `/app/(app)/contacts/page.tsx`

### 19. Ops & Facilities "Add Entry" Does Nothing ❌
**Problem**: "+ Add Entry" button placeholder

**Fix**: Create KB/secret entry creation modal/page with access control

**Files**: `/app/(app)/ops/page.tsx`

---

## Testing

### 20. No Tests Exist ❌
**Problem**: User requested tests for everything

**Fix**: Add Vitest + React Testing Library, write:
- Unit tests for all utility functions
- Integration tests for auth flows
- Component tests for critical UI
- E2E tests for happy paths (signup → dashboard → claim task → etc)

**Files**: Create `/tests/*`, add vitest config

---

## Summary Stats
- **Blocking Issues**: 3 (signup broken, layout SQL error, UI mismatch)
- **Non-Functional Features**: 17
- **Total Issues**: 20

## Implementation Priority
1. Fix signup flow (trigger-based)
2. Fix app layout SQL query
3. Restore auth page UI to match mockups
4. Add all missing queries to dashboard
5. Remove CLASP attribution
6. Implement payment platform integrations
7. Make all buttons functional
8. Write comprehensive test suite
