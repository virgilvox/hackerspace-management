# Local development quickstart

Fresh-clone to running app in under five minutes. Uses the Supabase CLI to spin up a complete local stack (Postgres + Auth + PostgREST + Realtime + Storage + Studio) in Docker. No Supabase account needed.

## Prerequisites

- macOS, Linux, or WSL2 on Windows.
- **Docker** (running). `docker info` should print a server section.
- **Homebrew** on macOS, or follow the [Supabase CLI install docs](https://supabase.com/docs/guides/cli/getting-started) for your OS.
- **Node 20+** and **pnpm 9+**. nvm works fine.

## 1. Install the Supabase CLI

```bash
brew install supabase/tap/supabase
supabase --version    # 1.x or 2.x
```

## 2. Clone and install

```bash
git clone <repo-url>
cd hackerspace-management
pnpm install
```

## 3. Initialize and start the local Supabase stack

```bash
supabase init        # writes supabase/config.toml; safe if it already exists
supabase start
```

First run pulls a few GB of images and takes 1–3 minutes. Subsequent starts are seconds.

When it finishes, the CLI prints something like:

```
         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Save the **anon key** and **service_role key**. You can re-print them anytime with `supabase status`.

The DB is at `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Studio (Supabase dashboard, locally) is at `http://127.0.0.1:54323`. The Inbucket email catcher is at `http://127.0.0.1:54324` — every email the app would send shows up there.

## 4. Apply the schema and the seed

```bash
# Schema (canonical, covers every migration through 019)
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f scripts/schema.sql

# Optional but recommended for local: load a demo space with members, tasks,
# proposals, an incident, a policy, and activity-log entries.
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f scripts/seed.sql
```

You can verify with Studio: open `http://127.0.0.1:54323`, switch to the `public` schema, and see 18 tables including `proposals`, `incidents`, `policies`.

## 5. Generate TypeScript types from the live local schema

```bash
supabase gen types typescript --local > types/database.ts
```

This clears the masked TS errors that `next.config.mjs: typescript.ignoreBuildErrors: true` was hiding. After this you can drop that ignoreBuildErrors flag and any future schema drift surfaces in CI.

## 6. Write `.env.local`

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste anon key from step 3>
SUPABASE_SERVICE_ROLE_KEY=<paste service_role key from step 3>
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

## 7. Run the dev server

```bash
pnpm dev
```

Open `http://localhost:3000`. Health check: `curl http://localhost:3000/api/health` returns `{"status":"ok"}`.

## 8. Sign up as a real user and join the demo space

1. Visit `/signup`.
2. Pick **Join a Space** and enter invite code: `DEMO-2026-TEST`.
3. Fill in your email / password.
4. Local Supabase is configured to skip email confirmation by default, so signup takes you straight to `/dashboard`.
5. The dashboard now shows the seeded activity. Visit `/proposals`, `/incidents`, `/policies`, `/financials` to see the full feature surface.

If you want admin permissions for the demo: connect to the DB (or via Studio) and run:

```sql
UPDATE public.space_members
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

## Common dev tasks

### Wipe and re-seed

```bash
supabase db reset                                                        # drops & re-runs the database
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f scripts/schema.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f scripts/seed.sql
```

### Apply a new incremental migration

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f scripts/0NN_my_change.sql
```

PostgREST auto-refreshes on schema changes locally; no restart needed.

### Run tests

```bash
pnpm vitest run        # 259 tests across 8 files; no DB needed
pnpm exec playwright test    # E2E (Playwright will spin up the dev server)
```

### Type check

```bash
pnpm exec tsc --noEmit
```

After step 5, this should be clean. If it isn't, regenerate types.

### Stop the local stack

```bash
supabase stop
```

Containers are stopped but volumes persist. To nuke them entirely: `supabase stop --no-backup` then `supabase start` for a fresh slate.

### Tail logs

```bash
supabase logs           # all services
supabase logs --type api
supabase logs --type db
```

### Run the proposal-expiry job manually

```sql
SELECT public.expire_proposals();
-- returns the number of proposals flipped from 'open' to 'decided' or 'expired'
```

In production you'd schedule this via pg_cron (the schema's migration 019 sets this up automatically when pg_cron is available) or via a Next.js cron endpoint guarded by a `CRON_SECRET`.

## Troubleshooting

### `supabase start` hangs or fails

Make sure Docker Desktop is open and `docker info` works. Some corporate VPNs interfere with the local images; turn the VPN off, run `supabase start`, then turn it back on.

### "relation does not exist" when the app runs

You skipped step 4. Apply `scripts/schema.sql`.

### "Invalid API key" toasts in the app

The anon key in `.env.local` doesn't match `supabase status`. `supabase stop --no-backup && supabase start` will regenerate the keys cleanly; paste the new ones into `.env.local`.

### Emails aren't arriving

Local Supabase routes outbound mail to Inbucket. Open `http://127.0.0.1:54324`.

### Signup says "Database error saving new user"

The `handle_space_signup` trigger fired but couldn't insert the space_members row. Almost always because `space_id` metadata was missing. The app's signup flow handles this correctly via the admin client; if you're testing direct `auth.users` inserts, that path doesn't write a space_members row by design.

### Realtime chat doesn't refresh

Confirm `comms_messages` and `comms_channels` are in `supabase_realtime`:

```sql
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

If they aren't, re-run `scripts/schema.sql` (Section 8 handles it idempotently).
