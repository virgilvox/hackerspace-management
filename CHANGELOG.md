# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project loosely follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Production deployment to a self-hosted DigitalOcean Droplet with automatic HTTPS via Caddy and Let's Encrypt.
- GitHub Actions workflow that pushes a deploy on every commit to `main`. Migrations are applied automatically via `_migrations_applied` tracking.
- Daily encrypted `pg_dumpall` backup cron, retained 14 days, written to the persistent block volume.
- Resend SMTP integration for transactional email (GoTrue).
- Open-source release scaffolding: `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, refreshed `README.md`, `docs/WEBHOOKS.md`.
- GitHub repository link on the landing page.
- Webhook signing secret is now displayed in the settings UI with show/hide and copy-to-clipboard.

### Changed
- Mobile responsiveness pass on the Kanban board, members table, payments table, proposal voting grids, and the landing mini board preview.
- `members` directory now respects the `member_directory_visibility` space setting for non-admin viewers.
- `lib/actions/settings.ts` now persists `mission_statement` alongside the rest of the space metadata.

### Removed
- `@vercel/analytics` dependency and all references to Vercel hosting. The project is self-hosted on a Droplet.
- Dead v0 codegen artifacts.

### Fixed
- Auth container crash-loop on first boot caused by an empty `DISABLE_SIGNUP` env value.
- Kong port-binding race that left `supabase.hackerspace.sh` returning 502 after a fresh stack bring-up.

## [0.1.0] - 2026-03-10

Initial pre-production cut. See `docs/HANDOFF.md` for the full session-by-session history of work prior to the open-source release.
