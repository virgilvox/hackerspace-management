# hackerspace-management

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-self--hosted-3FCF8E.svg)](https://supabase.com)

A multi-tenant operating system for hackerspaces, makerspaces, and member-run shops. One installation can host many independent spaces. Each space owns its own members, tasks, projects, payments, knowledge base, proposals, incidents, policies, and chat channels. All data access is enforced at the database with row-level security.

- Live site: <https://hackerspace.sh>
- Source: <https://github.com/virgilvox/hackerspace-management>

## Features

- **Members and tiers.** Roster, tiers (Plus, Basic, Associate), roles (admin, board, treasurer, member, associate), state (current, late, inactive, unverified), per-member skills, certifications, and badges.
- **Tasks and projects.** Project boards, task assignment, status, area tagging, priority, comments.
- **Operations.** Knowledge base, secrets vault, area leads, equipment, maintenance log.
- **Payments and financials.** Per-member payment ledger, integration credentials per space, exports, monthly financial summary.
- **Governance.** Proposals with vote tracking and expiry, incident reports, policy library, area-of-interest configuration.
- **Communications.** Multi-channel chat with realtime delivery.
- **Recruitment.** Public-facing recruitment page per space.
- **API.** PostgREST-generated REST for every table, gated by RLS. Optional webhooks with HMAC-signed deliveries.

## Stack

| Layer | Technology |
|-------|------------|
| App | Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui |
| Data | PostgreSQL 17 via self-hosted Supabase |
| Auth | Supabase GoTrue, JWT, email + password |
| Realtime | Supabase Realtime (Phoenix channels over WebSocket) |
| Storage | Block volume on the host (database), local FS (uploads) |
| Email | Resend (SMTP) |
| Reverse proxy | Caddy 2 (automatic Let's Encrypt) |
| Tests | Vitest (unit), Playwright (end to end) |

## Quick start (local development)

Requirements: Node.js 20 or later, pnpm 10 or later, Docker (for the local Supabase CLI), git.

```bash
git clone https://github.com/virgilvox/hackerspace-management.git
cd hackerspace-management
pnpm install
cp .env.example .env.local
```

Edit `.env.local` with values from your local Supabase project (see `docs/LOCAL_DEV.md` to start one in seconds using the Supabase CLI), then:

```bash
pnpm dev
```

Open `http://localhost:3000`, sign up, create a space, you land on the dashboard.

Detailed local setup: [docs/LOCAL_DEV.md](./docs/LOCAL_DEV.md).

## Production deployment

The supported production target is a single DigitalOcean Droplet running self-hosted Supabase plus the Next.js app behind Caddy with Let's Encrypt. No managed Supabase, no third-party application data store.

End-to-end guide: [docs/DEPLOY_DO_SELFHOSTED.md](./docs/DEPLOY_DO_SELFHOSTED.md).

Summary:

1. Provision a Droplet (4 GB RAM, 2 vCPU, 80 GB disk recommended).
2. Attach a block volume mounted at `/mnt/data` for the Postgres data directory and backups.
3. Point DNS A records for your domain, `www`, `supabase`, `studio` at the Droplet.
4. Run the bootstrap script in `scripts/` to install Docker, Supabase, Node, Caddy, the app, the systemd unit, backup cron, and the deploy hook.
5. Push to `main`. GitHub Actions runs `deploy.sh` on the Droplet over SSH: pull, install, apply pending migrations, build, restart.

The deploy script is idempotent and tracked: every numbered migration in `scripts/` is recorded in `public._migrations_applied`. New migrations are applied automatically on push.

## Database

`scripts/schema.sql` is the canonical, idempotent, full schema. Run it once on a fresh Supabase project. Subsequent changes are added as numbered migrations (`scripts/021_*.sql`, `022_*.sql`, etc.) and applied incrementally.

| Topic | Doc |
|-------|-----|
| Conventions | [scripts/README.md](./scripts/README.md) |
| Full reference | [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) |
| Column map | [DB_SCHEMA_MAP.md](./DB_SCHEMA_MAP.md) |

## Documentation

| File | Contents |
|------|----------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design, project structure, auth flow |
| [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) | Tables, enums, indexes, RLS policies |
| [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) | Server actions and REST endpoints |
| [docs/COMPONENT_REFERENCE.md](./docs/COMPONENT_REFERENCE.md) | UI components and props |
| [docs/DEPLOY_DO_SELFHOSTED.md](./docs/DEPLOY_DO_SELFHOSTED.md) | End to end production deploy |
| [docs/LOCAL_DEV.md](./docs/LOCAL_DEV.md) | Fresh clone to running locally |
| [docs/GOVERNANCE_FEATURES.md](./docs/GOVERNANCE_FEATURES.md) | Proposals, incidents, policies |
| [docs/WEBHOOKS.md](./docs/WEBHOOKS.md) | Webhook payload, signing, verification |
| [TESTING.md](./TESTING.md) | Test commands and coverage |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute |
| [CHANGELOG.md](./CHANGELOG.md) | Notable changes per release |
| [SECURITY.md](./SECURITY.md) | Vulnerability disclosure |
| [LICENSE](./LICENSE) | MIT |

## Scripts

```bash
pnpm dev          # development server
pnpm build        # production build
pnpm start        # serve production build
pnpm lint         # eslint
pnpm test         # vitest watch mode
pnpm test:ui      # vitest UI
pnpm test:e2e     # playwright end-to-end
```

## Project status

The system is feature-functional and serving production traffic at `hackerspace.sh`. See [docs/AUDIT.md](./docs/AUDIT.md) for the latest audit and the open issues list.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. Security issues: see [SECURITY.md](./SECURITY.md).

## License

MIT. See [LICENSE](./LICENSE).
