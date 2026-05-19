import { defineConfig } from 'vitest/config'
import path from 'path'

// Integration suite: runs the shipped SQL (RPCs / constraints / RLS /
// triggers) against a REAL Postgres via psql. Deliberately separate from the
// default `pnpm test` (which stays hermetic, jsdom, no DB) and from the
// `__tests__/` include glob, so `pnpm test` never touches a database.
// Run with: pnpm test:integration  (prereq: a reachable Postgres, default
// the Supabase-CLI local stack — see docs/LOCAL_DEV.md). Self-skips cleanly
// when no DB is reachable, so it never blocks contributors/CI without one.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['integration/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
})
