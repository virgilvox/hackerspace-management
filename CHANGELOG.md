# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project loosely follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Customizable permissions, per-item Ops ACLs, area-lead roles** (migration 023, additive and backward compatible):
  - Customize -> Permissions: a role x permission grid. Admin holds everything implicitly and cannot be locked out. Grants per built-in/custom role.
  - Per-item access control on Ops secrets (and KB/processes via the same infra): pick which roles, multiple, can access an item. Empty = existing default visibility. Secrets/KB SELECT policies were rewritten as `existing-rule OR acl-match`, so nothing changes until an admin sets an ACL.
  - Customize -> Area leads: create area-lead roles, see Vacant until assigned, assign/unassign a member from a picker. The assigned member effectively holds that role, so any Ops item whose access list includes it opens to them.
  - SECURITY DEFINER helpers `user_effective_roles` and `user_has_permission`.

### Changed
- All emails are canonicalized to trimmed lowercase (sign-in, sign-up, add/update member, contacts, imports) so case/whitespace variants no longer create duplicate members or fail sign-in.
- `types/database.ts` brought in sync with the schema (8 tables, the `comment_entity_type` enum, and the new columns); docs (`DATABASE_SCHEMA.md`, `DB_SCHEMA_MAP.md`, `API_REFERENCE.md`) refreshed for migrations 016-024.
- The member directory has a per-row "make area lead" assignment for admin/board (mirrors Customize -> Area leads).

### Fixed
- Production report: a basic member filing an incident hit `new row violates row-level security policy for table "incidents"`, including the anonymous path. Not reproducible from source (the code and the 016/017 policy both permit it). Migration 025 idempotently re-asserts the hardened `incidents_insert` policy verbatim so the deployed policy converges to the known-good definition (access-neutral, no schema change). The file-incident action now maps an RLS rejection to an actionable message and logs the technical detail server-side. If the report persists after deploy, the root cause is not policy drift; see `docs/HANDOFF.md` for the discriminating queries.

### UX
- Accessibility and consistency polish pass (Tier 1 systemic, in progress): distinct Ops nav icon (was a duplicate of Settings), `aria-current` on active nav, accessible mobile drawer (role/aria-modal, Escape, scroll lock, focus management), skip-to-content link, shared `BrandMark` in the sidebar, a shared `PageTitle`/`SectionTitle` primitive adopted app-wide, and a single shared `Empty` primitive replacing ~18 ad-hoc empty states (projects gains a real empty state with a CTA).

### Security
- Closed two member self-escalation paths: a non-privileged member can no longer change their own `tier_id` or `onboarding_completed_at` on the `space_members` row (migration 024 extends the self-change trigger). Onboarding completion now goes through the service client after server-side validation.
- Added in-code space scoping to forum/comment/channel mutations (defence-in-depth on top of RLS).
- Invite codes are now cryptographically random and wider.
- `SafeMarkdown` no longer allows `iframe` or arbitrary `style` (no unsandboxed embeds or UI-redress).
- `/settings` is gated server-side to admins before any space/integration data is fetched.

### Fixed
- Bulk import (`importMembers`, `importPaymentsCsv`) now validates every row with Zod: lowercased emails, `flexibleDateTime` date normalization, enum-checked platform/tier, positive finite amounts. Invalid rows are skipped and counted (returned as `skipped`) instead of silently dropped; one bad row no longer rejects the whole file.
- Per-item Ops access control now also covers knowledge base and process entries (wired into the viewer modal), not just secrets.
- `revealSecret` no longer silently returns the stale plaintext column when a row is marked encrypted but has no ciphertext; it surfaces the corruption instead.
- `upsertAreaLead` rejects a null/empty area code (Postgres treats NULLs as distinct in unique constraints, which had allowed duplicate area-lead rows).

### Changed
- Landing page rebuilt in the `/resources` editorial aesthetic: scoped dark theme (IBM Plex Mono + Libre Baskerville, lime accent, faint grid), a server component (~150 lines, down from a 539-line client monolith), and split into `components/landing/*`. Added a single-row resource showcase of six square tiles with the project SVG logos.

### Fixed
- Knowledge base search no longer crashes the Ops page. `filteredLeads` referenced a non-existent `member_name` column; the resulting `undefined.toLowerCase()` threw on every keystroke because the filter memos recompute on shared search state across tabs. All Ops filter predicates are now null-safe.

### Added
- `docs/PERMISSIONS_DESIGN.md`: design for customizable permissions, per-item Ops ACLs, and area-lead roles (next focused pass; security-sensitive RLS work, intentionally not bundled with UI changes).

### Added (continued)
- **Customize hub** at `/customize` (admin/board): a dedicated home for per-space customization with a section rail (Roles, Membership tiers, Areas, Invite codes, Onboarding), split into one focused module per panel. Replaces the overloaded Settings tab strip.
- **Roles editor**: rename and recolor the five built-in roles, and create/edit/delete custom org-structure roles. Renamed roles now display (sidebar user card; helper `lib/role-labels.ts`).
- **Invite share links**: copy a one-click `/signup?invite=CODE` link in addition to the bare code; the signup page prefills the code and preselects join mode from `?invite=`.

### Changed
- Brand mark reverted to the terminal `>_` glyph (`components/brand-mark.tsx`) across the landing nav/footer, onboarding header, and favicon. `AtlasLogo` remains only on the resources project page.
- Settings slimmed to Space, Integrations, and Webhooks. Roles, Tiers, Areas, Invites, and Onboarding moved to `/customize`.

### Added (continued)
- **Configurable member onboarding**: a new member who joins via invite code is walked through an admin-defined sequence of steps at `/onboarding` before reaching the app. Built-in step types: welcome, code of conduct (required acknowledgement), profile, dues/payment nudge. Admins can add custom content steps with sanitized markdown/HTML, reorder, enable/disable, and mark steps required from Settings -> Onboarding. Founders skip the member flow (their onboarding is space configuration). Existing members were backfilled as completed so nobody is trapped. Server-side enforcement of required steps. New tables: `space_onboarding_steps`; new columns `space_members.onboarding_completed_at` and `onboarding_progress`.
- `SafeMarkdown` component (react-markdown + remark-gfm + rehype-raw + rehype-sanitize) for rendering admin-authored markdown/HTML without XSS.
- `docs/UX_AND_PERSONAS.md`: persona model and the UX audit that drove onboarding.
- `bio` added to the self-service profile schema.
- **Forum** at `/forum`: top-level discussion threads with categories, pinning, locking. Author or admin/board can edit; admin can delete.
- **Polymorphic comment threads** on proposals, incidents, and policies. New `comments` table keyed on `(entity_type, entity_id)`. Renders markdown.
- **User-creatable chat channels**: inline "+ New channel" form in `/comms` (name, description, type). RLS now allows any member to create; default channels stay protected.
- **Custom membership tiers with prices**: new `space_tiers` table per space. Settings -> Tiers tab to list, create, edit (including inline price edit), archive, and delete custom tiers. Built-in `plus`/`basic`/`associate` tiers seed on space creation and on existing spaces via backfill. `space_members.tier_id` FK backfilled from the legacy enum.
- **Customizable role labels and custom org roles**: `space_role_labels` (rename/recolor built-ins per space) and `space_custom_roles` (non-privileged extra labels) with member m2m. Server actions wired; UI surface pending in a follow-up.
- **Multi-code invites**: `space_invites` with per-code expiry, max-use cap, and enable/disable. Legacy `spaces.invite_code` backfilled as a permanent enabled invite. Settings -> Invites tab to manage. `joinSpace` honors any valid invite and increments `uses_count`.
- **Knowledge base markdown rendering**: clicking a KB entry opens a modal that renders `content` as markdown via react-markdown + remark-gfm.
- **AtlasLogo as the brand mark**: replaces the terminal icon on the landing nav and footer; `public/logo.svg` is the favicon.
- Live site link in `README.md`: <https://hackerspace.sh>.

### Changed
- **Secrets vault is now encrypted at rest**: AES-256-GCM with a per-secret IV using a `SECRETS_ENCRYPTION_KEY` env var. The /ops list endpoint no longer sends plaintext or ciphertext to the client. A new `revealSecret(id)` server action is the only path to plaintext and writes a `secret.revealed` row to `activity_log`. Existing legacy plaintext rows continue to work.

### Added (continued)
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
