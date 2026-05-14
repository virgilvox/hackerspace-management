# Contributing to hackerspace-management

Thank you for your interest. This document explains how to set up a development environment, the conventions the codebase follows, and how to submit a change.

## Getting set up

1. Fork the repository on GitHub and clone your fork:

   ```bash
   git clone https://github.com/<your-user>/hackerspace-management.git
   cd hackerspace-management
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Copy the env template and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   For a fully local stack (recommended), follow [docs/LOCAL_DEV.md](./docs/LOCAL_DEV.md). It walks you through running Supabase locally with the Supabase CLI in under five minutes.

4. Start the dev server:

   ```bash
   pnpm dev
   ```

5. Sign up, create a space, and you should land on the dashboard at `http://localhost:3000/dashboard`.

## How the project is structured

Top-level directories:

- `app/` — Next.js App Router routes, grouped by `(app)` (authenticated app), `(landing)` (public landing), `(resources)` (legacy hackerspace.sh subsite).
- `components/` — Shared React components.
- `lib/` — Server actions, helpers, validations, type definitions.
- `scripts/` — Database schema and numbered SQL migrations.
- `docs/` — Long-form documentation.
- `e2e/` — Playwright end-to-end tests.
- `__tests__/` — Vitest unit tests.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for a deeper tour.

## Database changes

The schema is owned by `scripts/schema.sql` (full, idempotent state) and a sequence of numbered files (`scripts/NNN_description.sql`). Rules:

1. Add a new numbered file under `scripts/` for every schema change. Do not edit prior numbered files.
2. Update `scripts/schema.sql` to reflect the new canonical state.
3. Keep migrations idempotent (`IF NOT EXISTS`, `OR REPLACE`, exception-handled `CREATE TYPE`).
4. Add or update RLS policies whenever you add a table. Default to deny.
5. Note the change in [CHANGELOG.md](./CHANGELOG.md).

`scripts/README.md` documents the migration conventions in full.

## Coding conventions

- TypeScript strict mode. No `any` unless the third-party type is genuinely lost.
- Prefer server components and server actions. Push client interactivity to small leaf components.
- Tailwind for styling, shadcn/ui primitives for inputs, dialogs, dropdowns.
- Avoid premature abstraction. Three similar lines of code is better than a clever helper.
- Validation lives in `lib/validations.ts` (Zod). Every server action must validate its input.
- All queries that touch tenant data go through the Supabase server client. Service role only inside trusted server actions, never in client components.

## Tests

- Unit: `pnpm test`. Files live under `__tests__/`.
- End to end: `pnpm test:e2e`. Files live under `e2e/`. Requires a local dev server.
- New server actions need a unit test. New user-visible flows need an e2e test.

## Submitting a change

1. Create a branch off `main`:

   ```bash
   git checkout -b feat/short-description
   ```

2. Make your change. Run `pnpm lint` and `pnpm test`.

3. Commit. Write the message in the imperative mood, focused on the why:

   ```
   feat: surface webhook secret with copy button

   Admins could rotate the signing secret but never see the new value,
   making it impossible to use for signature verification.
   ```

4. Push and open a pull request against `main`. Describe what changed and why, link any related issue, and call out anything reviewers should pay extra attention to.

5. CI runs lint and tests. A maintainer will review.

## Security issues

Do not file public GitHub issues for security vulnerabilities. See [SECURITY.md](./SECURITY.md) for the disclosure process.

## Code of conduct

Be kind. Assume good faith. Hackerspaces and makerspaces thrive on collaboration. We extend the same expectation to the project.
