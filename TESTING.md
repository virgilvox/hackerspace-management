# Testing Documentation

This project uses **Vitest** for unit/integration tests and **Playwright** for end-to-end testing.

## Quick Start

```bash
# Run unit tests (watch mode)
npm test

# Run unit tests with UI
npm run test:ui

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

## Unit Tests (Vitest)

Unit tests are located in `__tests__/` directory and test individual functions, hooks, and components in isolation.

### Test Structure

- **`__tests__/actions.test.ts`** - Tests for server actions and business logic
  - Member status validation
  - Task filtering logic
  - Database constraints

- **`__tests__/components.test.tsx`** - Tests for React components
  - Component rendering
  - User interactions
  - State management

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

E2E tests are located in `e2e/` directory and test complete user flows across the entire application.

### Test Structure

- **`e2e/critical-flows.spec.ts`** - Critical user journeys
  - Authentication and dashboard access
  - Task creation and management
  - Member operations
  - Secrets/ops management

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
