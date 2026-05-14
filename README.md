# hackerspace-management

Multi-tenant member, payments, tasks, projects, ops, and comms platform for hackerspaces. Each tenant (a "space") owns its members, tasks, projects, payments, knowledge base, and chat channels. All access is row-level secured at the database.

## Stack

- Next.js 16 (App Router, React 19, TypeScript)
- Tailwind v4 + shadcn/ui
- Supabase (Postgres, Auth, Realtime)
- Vitest + Playwright

## Quick start (local)

```bash
git clone <repo-url>
cd hackerspace-management
pnpm install
cp .env.example .env.local
# Fill in Supabase URL, anon key, service role key in .env.local
```

Apply the database schema in your Supabase project:

1. Supabase dashboard, SQL Editor, New query.
2. Paste the contents of `scripts/schema.sql`.
3. Run.

Then:

```bash
pnpm dev
```

Open `http://localhost:3000`, sign up, create a space, land on `/dashboard`.

Health probe: `curl http://localhost:3000/api/health`.

## Documentation

| File | What it covers |
|------|----------------|
| [CLAUDE.md](./CLAUDE.md) | Working agreement for AI assistants in this repo |
| [docs/AUDIT.md](./docs/AUDIT.md) | Latest deep audit (2026-05-13): findings, fixes applied, open issues |
| [docs/HANDOFF.md](./docs/HANDOFF.md) | Session-by-session change log |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Local, Vercel, DigitalOcean App Platform, DigitalOcean Droplet (with managed Supabase) |
| [docs/DEPLOY_DO_SELFHOSTED.md](./docs/DEPLOY_DO_SELFHOSTED.md) | End-to-end self-hosted on a single DigitalOcean Droplet (Supabase + app) |
| [docs/LOCAL_DEV.md](./docs/LOCAL_DEV.md) | Fresh-clone to running app locally in five minutes, using the Supabase CLI |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design, project structure, auth flows |
| [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) | Full schema reference |
| [DB_SCHEMA_MAP.md](./DB_SCHEMA_MAP.md) | Quick column-by-column lookup |
| [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) | Server actions |
| [docs/COMPONENT_REFERENCE.md](./docs/COMPONENT_REFERENCE.md) | UI components |
| [TESTING.md](./TESTING.md) | How to run tests |
| [docs/GOVERNANCE_FEATURES.md](./docs/GOVERNANCE_FEATURES.md) | Diagnostic-to-feature roadmap for governance modules (proposals, incidents, policies) |

## Deployment

Four supported targets:

- **Vercel** (managed Supabase): zero-config, connect the GitHub repo, set env vars. See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).
- **DigitalOcean App Platform** (managed Supabase): spec ships at [.do/app.yaml](./.do/app.yaml). See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).
- **DigitalOcean Droplet, app only** (managed Supabase): Dockerfile and docker-compose.yml ship in the repo root. See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).
- **DigitalOcean Droplet, fully self-hosted** (your own Supabase, your own Postgres, your own data): full end-to-end guide in [docs/DEPLOY_DO_SELFHOSTED.md](./docs/DEPLOY_DO_SELFHOSTED.md).

Required environment variables are in [.env.example](./.env.example).

## Database migrations

`scripts/schema.sql` is the canonical, idempotent, full-schema deploy. Run it once on a fresh Supabase project. For existing deployments, only run new incremental files (`scripts/NNN_description.sql`).

## Scripts

```bash
pnpm dev          # development server
pnpm build        # production build
pnpm start        # serve production build
pnpm lint         # eslint
pnpm test         # vitest watch mode
pnpm test:ui      # vitest UI
pnpm test:e2e     # playwright
```

## Project status

The system is feature-functional but pre-production. See [docs/AUDIT.md](./docs/AUDIT.md) section 4 for known gaps (validation schema enum drift, dead scripts, UI-only OAuth buttons, no secrets encryption at rest, CSV import not wired, etc.).
