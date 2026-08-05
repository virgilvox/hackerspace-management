# hackerspace-management

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-self--hosted-3FCF8E.svg)](https://supabase.com)

A multi-tenant operating system for hackerspaces, makerspaces, and member-run shops. One installation can host many independent spaces. Each space owns its own members, tasks, projects, payments, knowledge base, proposals, incidents, policies, and chat channels. All data access is enforced at the database with row-level security.

- Live site: <https://hackerspace.sh>
- Source: <https://github.com/virgilvox/hackerspace-management>

## Features

- **Members and tiers.** Roster, tiers (Plus, Basic, Associate), built-in roles, custom roles, state (current, late, inactive, unverified), per-member skills. A per-space permissions matrix grants capabilities to any role additively, on top of role-based RLS.
- **Tasks and projects.** Project boards, task assignment, status, area tagging, priority, comments.
- **Operations.** Markdown knowledge base and processes (with working in-document anchor links), an AES-256-GCM secrets vault revealed on demand, per-item Ops ACLs, area leads.
- **Forms and waivers.** An easy builder for arbitrary forms and signable waivers. Public (anonymous or signed-in) or members-only; per-submission snapshots of schema and legal text so a waiver stays valid against exactly what was signed; CSV export; optional onboarding step.
- **Certifications and instructors.** Certification types with optional validity periods; an Instructor capability awards and revokes them; expiry and revocation tracked; members see their own record.
- **Classes.** Class offerings with scheduled sessions, member signup with waitlists, attendance, and an optional certification granted on completion.
- **Equipment.** Tool and equipment registry with time-window reservations, no-overlap enforcement, and an optional required certification per item.
- **Access control.** Member access cards (the card UID is treated as a credential), a configurable per-space door integration (native HeatSync controller or generic HTTP) behind an SSRF-guarded executor, live grant/revoke/open and member self-entry, inbound access-log ingest (a HeatSync `?z` poll plus a per-connection authenticated webhook, each card matched back to a member), and an immutable, secret-redacted access log. A universal **API-call button builder** generalizes this: admins define permission-gated buttons (any HTTP verb, headers, body, vault-stored secret) that fire through the same hardened egress, with a door-control preset.
- **Onboarding and invites.** A configurable member onboarding flow; multi-use, expiring, role-granting invite links.
- **Payments and financials.** Per-member payment ledger, integration credentials per space, exports, monthly financial summary. **Stripe recurring dues** are a first-class integration: each space configures its own Stripe account (not Connect), members pay through hosted Checkout and self-serve cancel/update through the hosted Billing Portal (no card data on our servers), and a per-space signed webhook keeps `member_billing` and member status (`current` / `late`) in sync, never auto-downgrading past `late`.
- **Transactional email and notifications.** An idempotent notifications outbox writes dues-lifecycle emails (renewal receipt, payment failed, lapse) from the Stripe webhook; a small dispatcher cron drains them through Resend with a fair per-space queue and per-attempt idempotency. Adding other domains (bookings, forms) reuses the same outbox.
- **Member self-serve portal.** Every member's `/me` is a tabbed portal: profile editing, dues management (Pay / Manage Billing), cancel class signups and equipment reservations, a personal payment history, and a verified self-service email change.
- **Governance.** Proposals with quorum, vote tracking and expiry; incident reports with anonymous reporter tracking by token; versioned policy library; member forum with polymorphic comments.
- **Communications.** Multi-channel chat with realtime delivery.
- **Recruitment.** Public-facing recruitment page per space.
- **API.** PostgREST-generated REST for every table, gated by RLS. Webhook HMAC signing contract + secret rotation are defined; per-event delivery is a follow-up (see [docs/WEBHOOKS.md](./docs/WEBHOOKS.md)).

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

### Single-tenant deployments

By default the app is the multi-tenant platform (one deployment hosts many spaces). You can also run it as a private, white-labeled instance for exactly one space: signup becomes "join THE space", the create-a-space flow is disabled, and the hackerspace.sh marketing shell is hidden. Set `NEXT_PUBLIC_SINGLE_TENANT=true`, then run `pnpm setup` once to create the space and the first admin. See [docs/SINGLE_TENANT.md](./docs/SINGLE_TENANT.md) for the end-to-end guide and [docs/CUSTOMIZE.md](./docs/CUSTOMIZE.md) for the branding and configuration pattern.

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
| [docs/SPINE_VALIDATION.md](./docs/SPINE_VALIDATION.md) | Owner runbook: provision + prove dues/email/door end to end |
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

The system is feature-functional and serving production traffic at `hackerspace.sh`. The running session log, deploy state, and rolling security audits live in [docs/HANDOFF.md](./docs/HANDOFF.md) (newest on top). [docs/AUDIT.md](./docs/AUDIT.md) is a deeper full-codebase audit snapshot from 2026-05-14 (historical context).

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. Security issues: see [SECURITY.md](./SECURITY.md).

## License

MIT. See [LICENSE](./LICENSE).
