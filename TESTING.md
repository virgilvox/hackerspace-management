# Testing Documentation

This project uses **Vitest** for unit/integration tests and **Playwright** for end-to-end testing.

## Quick Start

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run unit tests (watch mode)
pnpm test

# Run unit tests with UI
pnpm test:ui

# Run E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui
```

## Test Coverage

| Category | Tests | Coverage |
|----------|-------|----------|
| Actions | 50+ | Auth, Tasks, Projects, Members, Payments, Contacts, KB, Secrets |
| Components | 30+ | Badges, Tabs, Cards, Status, Toast, Empty, Loading |
| Utilities | 40+ | Date, String, Number, Array, Validation, URL |
| E2E Flows | 50+ | Auth, Dashboard, Tasks, Ops, Members, Payments, Projects |

## Unit Tests (Vitest)

Unit tests are located in `__tests__/` directory.

### Test Structure

- **`__tests__/actions.test.ts`** - Server actions and business logic (50+ tests)
  - Authentication (signIn, signOut, getUser)
  - Member status validation (current, unverified, late)
  - Task CRUD and filtering
  - Project management
  - Member management (role-based access)
  - Payment management (treasurer access)
  - Contact management
  - Knowledge base operations
  - Secrets management
  - Activity logging
  - RLS policy validation

- **`__tests__/components.test.tsx`** - React components (30+ tests)
  - TaskBadge (count display, overflow)
  - TabButton (active states, click handlers)
  - TaskCard (claim, complete, delete actions)
  - StatusBadge (color coding by status)
  - Toast notifications
  - Empty states
  - Loading spinners
  - Task filtering logic

- **`__tests__/utils.test.ts`** - Utility functions (40+ tests)
  - Date formatting and comparison
  - String manipulation (initials, codes, truncation)
  - Number formatting (currency)
  - Array operations (groupBy, sortBy, unique)
  - Validation (email, phone, required fields)
  - URL utilities
  - Status and role checks

### Writing Tests

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Feature', () => {
  beforeEach(() => {
    // Setup before each test
  })

  it('should do something', () => {
    expect(result).toBe(expected)
  })
})
```

### Key Testing Patterns

**Mocking Supabase:**
```typescript
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { ...} }),
}
```

**Testing Async Functions:**
```typescript
it('should fetch data', async () => {
  const result = await myAsyncFunction()
  expect(result).toBeDefined()
})
```

## E2E Tests (Playwright)

E2E tests are located in `e2e/` directory and test complete user flows.

### Test Structure

- **`e2e/critical-flows.spec.ts`** - Critical user journeys (40+ tests)
  - Landing & authentication
  - Dashboard loading and navigation
  - Tasks management (tabs, filtering, creation)
  - Operations & knowledge base
  - Members management
  - Payments management
  - Projects management
  - Contacts management
  - Communications
  - Settings
  - Mobile navigation
  - Error handling
  - Performance (load time checks)
  - Accessibility (headings, alt text, focus)

- **`e2e/auth.spec.ts`** - Authentication flows (15+ tests)
  - Login form display and validation
  - Signup flow
  - Session management
  - Protected route access
  - Password reset
  - OAuth (if configured)

### Writing E2E Tests

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/path')
  })

  test('should do something', async ({ page }) => {
    await page.click('button')
    await expect(page.locator('text=Success')).toBeVisible()
  })
})
```

### Common E2E Patterns

**Navigation:**
```typescript
await page.goto('/tasks', { waitUntil: 'networkidle' })
```

**Interaction:**
```typescript
await page.click('button:has-text("Add")')
await page.fill('input[name="title"]', 'New Task')
```

**Assertions:**
```typescript
await expect(page.locator('text=Task created')).toBeVisible()
expect(page.url()).toContain('/tasks')
```

## Coverage

Run tests with coverage:

```bash
npm test -- --coverage
```

Coverage reports are generated in `coverage/` directory.

## CI/CD Integration

Tests are configured to run in CI environments. Key CI-specific behaviors:

- E2E tests retry 2x on failure
- Screenshots/videos saved for failed tests
- Full parallelization in CI

## Debugging

**Vitest:**
```bash
npm test -- --inspect-brk
```

**Playwright:**
```bash
npm run test:e2e -- --debug
```

## Best Practices

1. **Test Behavior, Not Implementation** - Test what the user sees, not how code works
2. **Keep Tests Isolated** - Each test should be independent
3. **Use Meaningful Names** - Test names should describe what's being tested
4. **Mock External Dependencies** - Mock Supabase, APIs, etc.
5. **Test Happy & Sad Paths** - Test both success and failure scenarios

## Adding New Tests

When adding features:

1. Add unit tests in `__tests__/` for business logic
2. Add E2E tests in `e2e/` for user flows
3. Run `npm test` to verify
4. Check coverage with `npm test -- --coverage`

## Troubleshooting

**Tests timing out:**
- Increase timeout: `test('...', async () => {...}, { timeout: 10000 })`

**Playwright can't find elements:**
- Use `--debug` to step through: `npm run test:e2e -- --debug`
- Check selectors with: `await page.pause()`

**Vitest isolation issues:**
- Clear mocks: `vi.clearAllMocks()` in `beforeEach`
- Reset modules: `vi.resetModules()`
