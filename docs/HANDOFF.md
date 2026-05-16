# Handoff Log

Append-only. Newest entries on top. Keep each entry to one screen.

---

## 2026-05-15 (pass 17) — UX polish (Tiers 1-3) + production incident-RLS report

Branch: `main`. `origin/main` = `1340b4c` (incident hotfix, DEPLOYED). 5 local commits ahead (UX polish + docs), unpushed. Safety branch `ux-polish-wip` = old stack tip.

### Production incident-filing RLS report (resolved as far as possible blind)

User screenshot: a basic active member filing an incident at `/incidents/new` (anonymous checked) got `new row violates row-level security policy for table "incidents"`. Pre-existing in production, not from this session.

- Not reproducible from source: `fileIncident` sets `reporter_id=NULL` when anonymous and `space_id=member.space_id`; `getAuthMember` resolves by `user_id=auth.uid()`; the 016/017 `incidents_insert` policy allows exactly this. So it is a production deploy/data divergence.
- Three candidate root causes: (1) `auth.uid()` NULL inside the DB request (SSR session not reaching PostgREST); (2) deployed `incidents_insert` policy differs from 016/017; (3) acting `space_members.user_id` != JWT sub on production (data drift).
- **DEPLOYED** as a minimal hotfix off `origin/main` (commit `1340b4c`, GitHub Actions run 25953569904 success, 1m0s; deploy.sh ran the idempotent migration runner so `025` applied): `scripts/025` re-asserts the hardened `incidents_insert` verbatim (access-neutral; fixes cause #2 only); `fileIncident` maps an RLS rejection to an actionable message and logs detail server-side. `scripts/schema.sql` already matched (no change).
- **Still needs user verification:** retry filing an incident on prod. If it still fails, cause #2 is excluded; run the SQL below to confirm #1 vs #3.

### UX polish (Tiers 1-3; local only, NOT deployed)

- Full UI/UX audit done (5 partitioned agents, code-level; no live browser). User chose: implement Tiers 1-3, pause before 4-5; sidebar nav stays as-is (no role-filtering); comments get one-level nesting + edit (Tier 5, deferred).
- Local commits (build+test green 271/271 each): (1) `3360f54` accessible sidebar/drawer + distinct Ops icon + skip link + BrandMark; (2) `92ba6fb` shared `PageTitle`/`SectionTitle` across 21 files; (3) `f885ac7` shared `Empty` across ~18 empty states (projects gains one); (4) `1db9434` shared accessible `confirm()` (ConfirmProvider/useConfirm) replacing all 13 `window.confirm`; (5) `075b274` S6 unlayered `:focus-visible` ring + S5 >=44px tap targets at named hotspots + S8 28 form-field id/htmlFor + search aria-labels + S7 claim/complete/delete/link handlers now toast `result.error`. Plus preexisting `fa71d9a` (HANDOFF doc, not this session's) and doc commits `64d7d62`/`ea49e21`.
- **Tier 1 remaining = S3 only:** convert hand-rolled modals to the existing Radix `components/ui/dialog.tsx` (focus trap/ESC/aria for free). Targets: `ops/ops-client.tsx` (4: KbModal, AddSecretModal, AreaLeadModal, KB-view), `members/tasks/projects/payments/contacts-client.tsx` (1 add/edit modal each), `settings/settings-client.tsx` (integration-credentials modal ~569-660). Each is a `fixed inset-0` div with local open-state; swap to `<Dialog open onOpenChange>` + `DialogContent`, keep the form/handlers. Do modal-by-modal with a gate per group. **Tier 2** (founder first-run guided dashboard when space empty; onboarding Skills controlled value + required-ack hint) and **Tier 3** (secrets copy + auto re-hide + clear-on-unmount; permissions matrix read-only notice + per-checkbox aria-label; OpsAclEditor `aria-pressed`/check/toast) not started; Tier 3 is presentational-only inside the RLS guardrail. None of the UX commits are pushed; deploy decision pending. `ux-polish-wip` branch backs up the pre-restructure stack and can be deleted once trust is established.

### Pending decision / next step

Run these on the production DB (service role) to disambiguate the incident report if it persists:

```sql
SELECT polname, pg_get_expr(polwithcheck, polrelid) AS with_check
FROM pg_policy WHERE polrelid = 'public.incidents'::regclass AND polcmd = 'a';
SELECT id, space_id, user_id, status, role FROM public.space_members WHERE user_id = '<auth_uid>';
SELECT public.get_user_space_ids('<auth_uid>'::uuid);
```

If query 1 already shows the 016/017 expression and query 2 shows a matching `user_id` with the space present, 025 will NOT fix it (cause #1 or #3); investigate the SSR Supabase client / membership data instead.

---

## 2026-05-15 — SESSION CLOSE: state of the app

One-screen status for the next session. Detailed history in the pass entries below.

### Live

- Production: `https://hackerspace.sh`, single self-hosted DigitalOcean Droplet (Supabase + Next.js behind Caddy). Push to `main` -> GitHub Actions runs `/opt/hackerspace-ops/deploy.sh` (idempotent migrations via `public._migrations_applied`, build, restart). Latest deployed commit `4c9b551`. Migrations applied through `024`.
- Branch `main`, clean. `pnpm test` 271/271. `pnpm build` clean.

### Shipped & solid

- Core: members, tasks/chores, projects, payments, ops (KB/processes/secrets/area-leads), comms, dashboard.
- Governance: proposals+votes, incidents, policies, forum + polymorphic comments.
- Per-space customization hub (`/customize`): roles + labels, **permissions matrix**, tiers (priced), areas, area-lead roles (vacant/assign), multi-code invites, onboarding builder.
- Configurable member onboarding (`/onboarding`).
- Security: AES-256-GCM secrets at rest with server-only reveal; additive Ops ACLs (`ops_acl`) + `user_has_permission`/`user_effective_roles`; self-escalation trigger hardened (incl. `tier_id`, `onboarding_completed_at`); cross-tenant in-code scoping; crypto invite codes; sanitized markdown/HTML.
- Landing rebuilt in the editorial `/resources` aesthetic; terminal brand mark; resource showcase.
- Docs current (DATABASE_SCHEMA / DB_SCHEMA_MAP / API_REFERENCE / CHANGELOG / UX_AND_PERSONAS / PERMISSIONS_DESIGN). `types/database.ts` in sync.

### Deliberate non-changes (not bugs)

- `next.config.mjs` keeps `typescript.ignoreBuildErrors: true` for pre-existing legacy `app/` TS noise. New code is type-clean; `tsc` is NOT a usable gate today (use build + tests + manual).
- `/ops`, `/import` `return null` for unauthorized are unreachable behind the `(app)` layout gate.

### Next focus (planned, not started)

Deep UI/UX audit + polish. `docs/UX_AND_PERSONAS.md` has the persona model and the prior audit's deferred items: sidebar icon collision (Ops & Settings both `Settings2`), ~17 inconsistent empty states (no shared `Empty` component), heading-hierarchy primitives, in-app getting-started/help, role-filtered sidebar for non-privileged members. Newer surfaces (Customize hub, Permissions matrix, Onboarding flow, Forum, Ops ACL editor, Area leads) have not had a polish pass. Eliminating the legacy `app/` TS debt so `ignoreBuildErrors` can be removed is a separate worthwhile initiative.

---

## 2026-05-15 (pass 16) — Full-app audit + security hardening

Branch: `main`. Migration: 024 (plus 023 from pass 15 not yet deployed).

### Audit

Five parallel read-only audits (security/RLS, server actions/validation, routes/data, schema/types/migrations, plus a security-smell sweep). Verified before acting — two agent "blockers" were false alarms (ops_acl/space_role_permissions/member_custom_roles DELETE policies DO exist in schema.sql §15; m2m needs no UPDATE).

### Fixed this pass (security)

- **Self-escalation closed (BLOCKER).** Migration 024 + schema.sql §16: `prevent_member_self_role_change` now also blocks a non-privileged member changing their own `tier_id` (self tier upgrade) and `onboarding_completed_at` (skip required code-of-conduct). `finishOnboarding`/`skipOnboarding` now set `onboarding_completed_at` via the service client AFTER their server-side required-steps check, so the legitimate path still works.
- **Cross-tenant write scoping.** Added `.eq('space_id', member.space_id)` to `updateForumThread`, `deleteForumThread`, `editComment`, `deleteComment`, `deleteChannel`, `renameChannel` (was RLS-only; now defence-in-depth).
- **Invite codes.** `auth-actions.generateInviteCode` moved off `Math.random()` to `crypto.getRandomValues` and widened to 8 chars (was ~21 bits, enumerable under the join rate limit).
- **SafeMarkdown hardened.** Dropped `iframe` from allowed tags (no unsandboxed embed/token-theft frame) and the global `style` attribute (no full-viewport UI-redress). Markdown + safe basic HTML still render.
- **`/settings` server gate.** Now `redirect('/dashboard')` for non-admins BEFORE fetching space/integration config (was client-hidden only).
- **`app/(app)/layout.tsx`** marked `export const dynamic = 'force-dynamic'` (auth/onboarding gate must never be cached).
- **Bounded queries.** `loadComments` `.limit(500)`, tasks page `.limit(2000)`.

### Pass 16b follow-up (same day)

- **Import validation done.** `importMembersSchema` / `importPaymentsCsvSchema` added; both actions validate per row (one bad row no longer rejects the file), lowercase emails, normalize dates via `flexibleDateTime()`, enforce platform/tier enums and positive finite amounts, and return a `skipped` count instead of silently dropping rows.
- **KB/process per-item ACL wired.** `OpsAclEditor` renders in the KB/process viewer modal (admin/board); entity type derived from the `process` tag. Per-item Ops ACLs now cover secrets + KB + processes.
- `/ops` and `/import` denial paths left as-is: unreachable behind the `(app)` layout gate, or already a clear denial with no data leak.

### Pass 16c — backlog cleared (same day)

- **`types/database.ts` synced.** Added the 8 missing tables (forum_threads, comments, space_tiers, space_invites, space_onboarding_steps, space_role_labels, space_custom_roles, space_member_custom_roles), the `comment_entity_type` enum (both type union and Constants array), and the missing columns: `space_members.tier_id/onboarding_completed_at/onboarding_progress`, `secrets.encrypted_value/encryption_version`, `knowledge_base.render_markdown`.
- **Email normalized everywhere.** New `emailField()` helper (trim + lowercase) applied to signIn/signUp/addMember/updateMember/createContact and the import path. Prevents case-variant duplicate members/contacts.
- **Members-row "Make area lead".** A per-row picker in the members directory (admin/board) assigns a member to any area-lead role via `assignAreaLead`; same capability also in Customize -> Area leads.
- **Docs refreshed.** `DATABASE_SCHEMA.md` (header + migrations 014-024 summary), `DB_SCHEMA_MAP.md` (table quick-map + helpers), `docs/API_REFERENCE.md` (all server actions added in migrations 016-024). All re-dated 2026-05-15 with `scripts/schema.sql` named as source of truth.

Backlog is now empty. Remaining known non-issues: `/ops` + `/import` `return null` are unreachable behind the `(app)` layout gate; `next.config.mjs` keeps `ignoreBuildErrors` (pre-existing legacy app/ TS noise) — the new code is type-clean.

### Verification

- `pnpm build` clean; `pnpm test` 271/271. Migrations 023 + 024 idempotent; apply via deploy.sh's tracked runner on next deploy.

## 2026-05-15 (pass 15) — Permissions, Ops ACLs, area-lead roles

Branch: `main`. Migration: 023 (applies on next deploy).

### Pre-work audit (background agent)

No regressions from recent passes; routing now clean (the duplicate `app/page.tsx` was the only structural anti-pattern and it is gone). Verbatim current RLS captured. `types/database.ts` is stale for 8 prior-pass tables but masked by `ignoreBuildErrors` (type debt, not a runtime bug). Two latent Ops bugs found and fixed this pass.

### What shipped

Security-sensitive subsystem, built ADDITIVE so a space with no permission/ACL rows behaves exactly as before.

- **Migration `scripts/023_permissions.sql`** (folded into `schema.sql` section 15):
  - `space_role_permissions` (space_id, subject, permission) and `ops_acl` (space_id, entity_type in secret|kb|process|area_lead, entity_id, role). Full RLS; writes admin/board.
  - `user_effective_roles(uid,sid)` SECURITY DEFINER: built-in role + custom-role slugs + `area_lead:<area_leads.id>` for areas the member leads.
  - `user_has_permission(uid,sid,perm)` SECURITY DEFINER: admin implicit-all, else a grant via an effective role.
  - `secrets`/`knowledge_base` SELECT rewritten as `EXACT existing rule OR ops_acl match`. Zero behavior change with no ACL rows.
  - Seed trigger + backfill of sensible default `space_role_permissions` (board/treasurer/member/associate; admin never stored).
- **Area-lead roles reuse the existing `area_leads` table** (decision: do not duplicate the concept). A row is a role; `lead_id IS NULL` => Vacant; assigning sets `lead_id`; the member then holds `area_lead:<id>` via `user_effective_roles`.
- `lib/permissions-catalog.ts` (fixed code list + per-role defaults + guardrails), Zod schemas, `lib/actions/permissions.ts` (setRolePermissions, setOpsAcl, createAreaLeadRole, assign/unassign/deleteAreaLeadRole).
- UI: Customize gains **Permissions** (role x permission matrix; admin shown as implicit-all/locked) and **Area leads** (create role, Vacant state, member-picker assign/unassign) panels — new modular files under `customize/panels/`. Reusable `components/ops/ops-acl-editor.tsx` wired into the Secrets list ("Access" toggle, multi-role) via `ops/page.tsx` plumbing (custom roles + area-lead sentinels as options).
- Latent bug fixes: `revealSecret` now errors on a corrupt encrypted-but-no-ciphertext row instead of silently returning the stale plaintext column; `upsertAreaLead` rejects null/empty `area_code` (Postgres treats NULLs as distinct, which allowed duplicate rows).
- `types/database.ts`: added `space_role_permissions` and `ops_acl`. Catalog unit tests (5) added; 271 tests pass.

### Deferred (tracked, honest)

- KB/process per-item ACL: infra (RLS, setOpsAcl with kb/process, OpsAclEditor) is complete; only the ops-client KB-modal wiring is not done yet (the Secrets path, the explicit ask, is wired). Mechanical follow-up.
- "Make area lead" directly from the members directory row: assignment is fully available in Customize -> Area leads; the members-list shortcut is deferred.
- Broad permission-based gating of every server action / RLS rewrite app-wide is intentionally NOT done; this pass keeps existing role checks and only OR-widens via ACLs. `user_has_permission` exists for incremental adoption.
- `types/database.ts` still stale for the other 8 prior tables (loose casts; build green).

### Verification

- `pnpm build` clean; `pnpm test` 271/271. Migration 023 is idempotent and applies via deploy.sh's tracked runner.

## 2026-05-15 (pass 14) — Landing redesign + KB search fix

Branch: `main`.

### What shipped

- **Landing rebuilt in the resources editorial aesthetic.** New scoped `app/(landing)/landing.css` mirrors the `/resources` palette (`#0c0c0c` / lime `#d4ff00` / `#252525` borders), IBM Plex Mono + Libre Baskerville (loaded in `(landing)/layout.tsx`, which now wraps `.landing-root` + grid overlay). `app/(landing)/page.tsx` went from a 539-line `'use client'` monolith to a ~150-line server component. The animated `Mini*` previews and inline `Ico*` set were removed (they clashed with the editorial look). Modules extracted for separation of concerns: `components/landing/icons.tsx`, `components/landing/resource-showcase.tsx`. `BrandMark` now accepts `style`.
- **Resource showcase**: a single row of six square tiles at the foot of the landing, each with the real project SVG logo (`AtlasLogo`, `CubeIcon`, `TraceIcon`, `SpaceIcon`, `GridIcon`, `KeyIcon`), linking to /atlas, /space-after-dark, /proposal-duel, /zine, the external learner, /governance. Responsive 6 -> 3 -> 2 columns.
- **KB search crash fixed** (`app/(app)/ops/ops-client.tsx`). Root cause: `filteredLeads` referenced `l.member_name`, a column that does not exist (it is `lead_handle`), so `undefined.toLowerCase()` threw. Because `search` is shared state and all four filter memos recompute on every keystroke regardless of the active tab, typing in the KB box crashed the whole page. All four predicates are now null-safe via a shared `has()` helper; `filteredSecrets` also no longer assumes a non-null `title`.

### Verification

- `pnpm build` green (`/` route present), `pnpm test` 266/266.
- No migration this pass.

### Next pass (designed, not yet built): permissions + Ops ACLs + area-lead roles

User asked for: customizable permissions; per-secret and per-Ops-item multi-role access; area-lead roles that show "vacant" until a member is assigned (from a dedicated UI or by clicking a member in the directory) and that grant permissions wherever that area-lead role is selected. This is a security-sensitive subsystem (RLS rewrites on `secrets` and `knowledge_base`) and is deliberately NOT bundled with the landing redesign. Design is captured in `docs/PERMISSIONS_DESIGN.md`.

---

## 2026-05-15 (pass 13) — Customize hub, roles editor, logo revert

Branch: `main`.

### Goal

Three asks: (1) build the custom-roles editor (label rename/recolor + create/edit/delete custom roles) that pass 11 left as data-layer-only; (2) move all the per-space customization (Roles, Tiers, Areas, Invites, Onboarding) out of the overloaded Settings tab strip into a dedicated `/customize` hub with its own nav, leaving Settings for space identity / visibility / integrations / webhooks; (3) revert the brand mark from `AtlasLogo` (the globe) back to the original terminal `>_` glyph and give the favicon a matching terminal mark.

### Decisions

- IA: a single sidebar entry "Customize" (admin/board) -> `/customize` hub with a left section rail (Roles, Tiers, Areas, Invites, Onboarding). Keeps the sidebar lean (audit finding: 16+ items already) while giving customization a discoverable home distinct from operational Settings. Settings slimmed to Space, Visibility, Integrations, Webhooks.
- Logo: restore `IcoTerminal` for nav/footer/onboarding header; replace `public/logo.svg` with a terminal `>_` glyph for the favicon.

### What shipped

- **Brand mark reverted.** New `components/brand-mark.tsx` (a terminal `>_` glyph, currentColor). Swapped into the landing nav + footer and the onboarding header. `public/logo.svg` rewritten as the matching lime `>_` favicon. The dead local `IcoTerminal` in the landing page was removed. `AtlasLogo` stays only on the `(resources)` page (it is that project's own art).
- **`/customize` hub** (`app/(app)/customize/`): server `page.tsx` gates admin/board and fetches everything; thin `customize-client.tsx` shell with a left section rail; one file per panel under `panels/` (`roles-panel`, `tiers-panel`, `areas-panel`, `invites-panel`, `onboarding-panel`, plus `card.tsx` and `types.ts`). Smart separation: the shell is ~75 lines, each panel self-contained.
- **Roles editor (new).** RolesPanel renames/recolors the five built-in roles via `upsertRoleLabel`, and full CRUD on custom roles. The pass-11 actions were write-only; this also adds the read path: `lib/role-labels.ts` (`getRoleLabelMap`, `roleDisplayName`, defaults) is now consumed in `(app)/layout.tsx` so the sidebar user card shows the renamed role.
- **Settings slimmed.** Removed the Roles/Tiers/Invites/Onboarding tabs and the Areas block from `settings-client.tsx` (down ~700 lines) and the matching fetches from `settings/page.tsx`. Settings now owns only Space, Integrations, Webhooks. Dead props/state/types removed.
- **Sidebar.** Added a "Customize" admin/board NavLink (`SlidersHorizontal`) above Settings.
- **Invite share links.** `InvitesPanel` has Copy code and Copy link; the link is `/signup?invite=CODE`. `app/signup/page.tsx` reads `?invite=` on mount, prefills the code, and preselects join mode.

### Deferred (tracked)

- `types/database.ts` is out of sync (missing space_tiers/space_invites/space_onboarding_steps/space_role_labels/space_custom_roles/space_member_custom_roles/forum_threads/comments and the two onboarding columns on space_members). Queries use loose casts so the build is green; this is type-hygiene debt, not a runtime bug.
- Renamed-role display only reaches the sidebar so far. Members table/edit-select and badges still show the raw enum. The helper exists; wiring the remaining surfaces is a small follow-up.
- `settings-client.tsx` is still ~700 lines (space form + visibility + integrations + webhooks + integration modal). Worth splitting next, same pattern as the customize panels.
- Custom-role assignment to members has actions (`assignCustomRole`/`unassignCustomRole`) but no UI yet.

### Verification

- `pnpm test` 266/266. `pnpm build` green; `/customize`, `/onboarding`, slimmed `/settings` all in the route table.
- Migration: none this pass (UI/IA only; pass-11/12 migrations already in prod).

---

## 2026-05-15 (pass 12) — Configurable member onboarding + UX research

Branch: `main`.

### Context carried in

Pass 11's feature batch (forum, comments, tiers, invites, secrets encryption) deployed to production after one landmine: the `.gitignore` rule `secrets/` also matched `lib/secrets/`, so the first deploy failed on `Module not found: '@/lib/secrets/crypto'`. Fixed by anchoring the rule to `/secrets/` (commit `96a1fb9`); redeploy succeeded. Migration 021 is applied in prod (`_migrations_applied` has 8 rows). `SECRETS_ENCRYPTION_KEY` is set in `/opt/hackerspace-ops/.env.production` on the Droplet.

### What this pass does

UX research + persona work, a deep UI/UX audit, and the configurable member-onboarding feature.

### What shipped

- Migration `scripts/022_onboarding.sql` (folded into `schema.sql` Section 14): `space_onboarding_steps` (step_key, step_type in welcome|code_of_conduct|profile|payment|content, title, body, config jsonb, is_enabled, is_required, is_system, sort_order; unique per space+key). `space_members.onboarding_completed_at` and `onboarding_progress jsonb`. Trigger seeds 4 default steps per space; backfill seeds existing spaces and marks all existing members complete (so the new gate does not trap them). RLS: members read, admin/board write, admin delete non-system.
- `lib/actions/onboarding.ts`: admin CRUD (`createOnboardingStep`/`updateOnboardingStep`/`deleteOnboardingStep`), member progress (`markOnboardingStepDone`, `finishOnboarding` which server-side-enforces required steps, `skipOnboarding` which only works when nothing is required). Validations added; `bio` added to `updateMyProfileSchema`.
- `/onboarding` route (top-level, outside the `(app)` group so no redirect loop). `OnboardingFlow` client stepper: progress bar, step counter, back, per-type rendering (welcome/coc/content via `SafeMarkdown`, profile form -> `updateMyProfile`, payment nudge with optional link + "Remind me later"). Gate added in `app/(app)/layout.tsx`: redirect to `/onboarding` when `onboarding_completed_at` is null. `createSpace` now sets `onboarding_completed_at` for the founder.
- `components/safe-markdown.tsx`: rehype-raw + rehype-sanitize. Added `rehype-raw` and `rehype-sanitize` deps.
- Settings -> Onboarding admin tab: reorder (sort number), edit title/body/payment link, toggle enabled/required, add custom content step, delete non-system steps.
- `docs/UX_AND_PERSONAS.md`: 4 personas (founder, new member, operator, casual) and prioritized UX findings. Onboarding was finding #1; findings 2-6 (sidebar icon collision, inconsistent empty states, heading hierarchy, getting-started affordance, role-filtered nav) deferred.

### Open items / deferred

- UX findings 2-6 in `docs/UX_AND_PERSONAS.md` (icon collision, empty-state component, page-title primitives, admin checklist, role-filtered sidebar).
- Custom role labels / custom roles still have no Settings UI (data layer from pass 11 exists).
- `importMembers` / `importPaymentsCsv` still lack Zod schemas (pass-10 audit item).

### Verification

- `pnpm test` 266/266. `pnpm build` green, `/onboarding` in the route table.
- Migration 022 applies via `deploy.sh`'s idempotent runner on next deploy.

---

## 2026-05-14 (pass 11) — Forum, comments, secrets encryption, custom tiers/invites, logo

Branch: `main`. Pushed.

### What I did

Major feature expansion + security fix surfaced by audit.

Schema migration `scripts/021_forum_tiers_roles_invites_secrets.sql`, folded into `scripts/schema.sql` Section 13:

- `forum_threads` (title, body, category, pinned, locked, comment_count, last_comment_at). Full RLS.
- `comments` polymorphic over (`forum_thread` | `proposal` | `incident` | `policy`) with `parent_id` for nesting. Trigger maintains `forum_threads.comment_count` and `last_comment_at`.
- `space_tiers` per-space (slug, name, description, monthly_price_cents, billing_cadence, is_system, sort_order). Backfills `plus`/`basic`/`associate` for every existing space and seeds them on `INSERT spaces` via trigger. `space_members.tier_id` FK added and backfilled from the legacy enum.
- `space_role_labels` (rename + recolor built-in roles per space). `space_custom_roles` (non-privileged extra labels). `space_member_custom_roles` m2m.
- `space_invites` with `code`, `label`, `expires_at`, `max_uses`, `uses_count`, `is_enabled`. Legacy `spaces.invite_code` backfilled as a permanent enabled invite.
- `secrets.encrypted_value bytea` + `encryption_version smallint`. Secrets RLS tightened.
- `knowledge_base.render_markdown` boolean (default true).
- `comms_channels` INSERT policy: any member of the space can create. UPDATE/DELETE: admin/board OR creator (default channels protected).

Server actions:

- `lib/actions/forum.ts`: `createForumThread`, `updateForumThread` (pin/lock moderator-gated), `deleteForumThread`, `addComment`, `editComment`, `deleteComment`.
- `lib/actions/comms.ts`: `createChannel`, `renameChannel`, `deleteChannel`.
- `lib/actions/tiers.ts`: `createTier`, `updateTier`, `deleteTier`.
- `lib/actions/roles.ts`: `upsertRoleLabel`, `createCustomRole`, `updateCustomRole`, `deleteCustomRole`, `assignCustomRole`, `unassignCustomRole`.
- `lib/actions/invites.ts`: `createInvite`, `updateInvite`, `deleteInvite`.
- `lib/actions/secrets.ts`: rewritten to use AES-256-GCM at rest. New `revealSecret(id)` returns plaintext only via server action and logs `secret.revealed` to `activity_log`. New `updateSecret`. List endpoint in `/ops/page.tsx` no longer selects `value` or `encrypted_value` — fixes the screenshot bug where ciphertext was already in the page bundle before "Reveal".
- `lib/secrets/crypto.ts`: AES-256-GCM helpers. Reads `SECRETS_ENCRYPTION_KEY` env (64 hex chars). Falls back to plaintext storage if the env var isn't set.

UI:

- `/forum` (index with pinned/locked badges, last-activity sort), `/forum/new`, `/forum/[id]`.
- `components/comments/CommentThread` + `loadComments` helper. Embedded on `/proposals/[id]`, `/incidents/[id]`, `/policies/[slug]`.
- `/comms` sidebar: inline "+ New channel" form (name + description + type).
- `/ops` Secrets tab: Reveal now calls the `revealSecret` action and respects encryption.
- `/ops` KB: row click opens a modal that renders `entry.content` as markdown via react-markdown + remark-gfm.
- `/settings`: new **Tiers** tab (list/create/edit/archive/delete custom tiers, inline price edit). New **Invites** tab (list/create/disable/delete; copy code).
- Landing page nav + footer now use `AtlasLogo` instead of `IcoTerminal`. `public/logo.svg` is the favicon (referenced by `app/layout.tsx` metadata).
- Sidebar gets a `Forum` link below `Comms`.

Auth flow: `joinSpace` honors codes from `space_invites` first (enforces enabled/expired/max-uses), falls back to legacy `spaces.invite_code`, and increments `uses_count` on success.

Env: `SECRETS_ENCRYPTION_KEY` added to `.env.example` and to `secrets/base.env` locally (gitignored).

Validations: added `updateSecretSchema`, `createForumThreadSchema`, `updateForumThreadSchema`, `createCommentSchema`, `updateCommentSchema`, `createTierSchema`, `updateTierSchema`, `upsertRoleLabelSchema`, `createCustomRoleSchema`, `updateCustomRoleSchema`, `createInviteSchema`, `updateInviteSchema`, `createChannelSchema`.

### Open items (deferred for follow-up)

- Custom role labels and custom roles UI in Settings. Data layer + RLS + server actions all in place; UI surface not yet added. Schema rows can be created via PostgREST or psql today.
- `importMembers` and `importPaymentsCsv` lack Zod schemas (audit-flagged). Logic still filters on type, but should adopt schemas.
- Add `SECRETS_ENCRYPTION_KEY` to the droplet's `.env.production` before the next deploy. Without it, secrets fall back to legacy plaintext storage and the screenshot bug returns. (Update done locally; deploy env update pending.)
- Migration 021 must be applied on production. The deploy script runs it idempotently; first deploy after this commit will write `_migrations_applied` row.

### Verification

- `pnpm test` -> 266/266 pass.
- `pnpm build` -> green, all new routes in the route table (`/forum`, `/forum/new`, `/forum/[id]`).

---

## 2026-05-14 (pass 10) — Production deploy + open-source release prep

Branch: `main`. Pushed (`8ad1ca4`).

Self-hosted production deploy completed on a single DigitalOcean Droplet at `https://hackerspace.sh`. Supabase (db/auth/rest/realtime/kong/meta/studio) runs in Docker with the Postgres data directory on a persistent block volume at `/mnt/data/postgres`. Caddy 2 terminates TLS with automatic Let's Encrypt for the apex, www, supabase, and studio hostnames. Studio is gated by HTTP basic auth (bcrypt). Daily `pg_dumpall` cron writes to `/mnt/data/backups` with 14-day retention. GitHub Actions auto-deploys every push to `main` over SSH via `/opt/hackerspace-ops/deploy.sh` which applies pending migrations idempotently (via `public._migrations_applied`), rebuilds, and restarts the systemd service. Resend SMTP is wired into GoTrue.

Open-source release scaffolding shipped: `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `docs/WEBHOOKS.md`, refreshed `README.md` and `docs/DEPLOYMENT.md`. All v0/Vercel references removed from app code; `@vercel/analytics` dependency dropped. GitHub icon link to the public repo in the landing nav + footer.

Audit fixes in the same commit:

- Webhook signing secret now has show/hide + copy in `/settings`; the broken external `docs.hackerspace.sh/webhooks` link replaced with `docs/WEBHOOKS.md`.
- `updateSpaceSettings` parameter type now includes `mission_statement` (was silently dropped).
- `/members` enforces `member_directory_visibility` for non-admin viewers.
- Mobile responsiveness pass: Projects Kanban, Members + Payments tables (column hiding on narrow), Proposal tally + voting buttons.

---

## 2026-05-14 (pass 9) — Datetime fix + configurable areas

Branch: `main`. Author: Claude (no commits made).

### What I did

Two user-reported issues from running the local app:

1. **"Invalid datetime" error when creating a task with a due_date.** HTML `<input type="date">` sends `"2026-05-22"` (date-only) but `z.string().datetime()` requires full RFC 3339. Eight other schemas had the same latent bug (`createProjectSchema.due_date`, `addMemberSchema.joined_at`, `logCashPaymentSchema.transaction_date`, both proposal voting timestamps, `createPolicySchema.effective_at`, `supersedePolicySchema.effective_at`, `meetingMinutesSchema.meeting_date`).
2. **Areas were hardcoded constants** in `tasks-client.tsx` (9 strings) and `projects-client.tsx` (9 different strings). Not configurable per-space. No defaults seeded for new spaces.

### Fix 1: shared `flexibleDateTime` preprocessor

`lib/validations.ts` exports `flexibleDateTime()`. A `z.preprocess` that maps `""`/`null`/`undefined` → `null`, passes through full RFC 3339 unchanged, normalises `YYYY-MM-DD` and `YYYY-MM-DDTHH:MM` through `new Date(v).toISOString()`, and leaves unparseable input for Zod to reject. Wired into all nine date fields. The original bug screenshot is gone: `"2026-05-22"` validates and inserts as `"2026-05-22T00:00:00.000Z"`. Added 7 new tests.

### Fix 2: `space_areas` table + Settings UI

Migration `scripts/020_areas.sql`:

- `space_areas` table: `(id, space_id, code, name, icon, sort_order, is_archived)`. UNIQUE per `(space_id, code)` and `(space_id, name)`.
- Sort index `(space_id, sort_order, name)`.
- RLS: members read, admin/board write, admin delete.
- `seed_default_areas()` trigger fires after spaces INSERT, seeding ten defaults: 3D Printing, Electronics, Woodshop, Laser, Metal Shop, Facilities, Software, Kitchen, Admin, General. Codes are stable slugs; names are display labels.
- Backfill populates every existing space that has no areas. Idempotent.
- Folded into `scripts/schema.sql` as Section 12.

Library surface:

- `lib/types.ts`: `SpaceArea` type.
- `lib/validations.ts`: `createAreaSchema`, `updateAreaSchema` (slug regex, length caps).
- `lib/actions/areas.ts`: `createArea`, `updateArea`, `deleteArea`. Use `requireMemberWithRole(ADMIN_ROLES)`. Re-exported via the barrel.

UI wiring:

- `app/(app)/tasks/page.tsx` and `app/(app)/projects/page.tsx` fetch `space_areas` in parallel and pass `areas: string[]` to the client.
- `tasks-client.tsx` and `projects-client.tsx` accept the new prop; old hardcoded arrays renamed `DEFAULT_AREAS` as a fallback.
- `app/(app)/settings/page.tsx` fetches the full area list and passes to `SettingsClient`.
- `settings-client.tsx`: new **Areas** card on the Space tab. Lists every area with inline-editable name + sort_order, archive/restore toggle, admin-only delete with confirm prompt. "Add area" form takes code + display name.

### Verification (live local stack)

- Migration applied to the running Postgres. 20 area rows across 2 spaces (Demo Hackerspace + the user's HeatSync Labs space created earlier through the UI), 10 each.
- Test user fetched `space_areas` via REST with their JWT; got the 10 defaults sorted by `sort_order`. RLS clean, no cross-tenant leak.
- **266 tests across 8 files** (was 259; +7 for flexibleDateTime).
- `pnpm build` clean, 31 routes.
- Dev server still running, hot-reloaded the changes.

### Files changed

```
Added:
  scripts/020_areas.sql
  lib/actions/areas.ts

Edited:
  lib/validations.ts                              (flexibleDateTime + area schemas)
  lib/types.ts                                    (SpaceArea)
  lib/actions/index.ts                            (export areas)
  scripts/schema.sql                              (Section 12)
  scripts/README.md                               (020 listed)
  app/(app)/tasks/page.tsx                        (fetch + pass areas)
  app/(app)/tasks/tasks-client.tsx                (accept areas prop)
  app/(app)/projects/page.tsx                     (fetch + pass areas)
  app/(app)/projects/projects-client.tsx          (accept areas prop)
  app/(app)/settings/page.tsx                     (fetch areas)
  app/(app)/settings/settings-client.tsx          (Areas management card)
  __tests__/validations.test.ts                   (7 new tests)
  types/database.ts                               (regenerated; includes space_areas)
  docs/HANDOFF.md                                 (this entry)
```

In the browser: `/tasks` → New Task → due_date `2026-05-22` saves cleanly. `/settings` → Space tab → scroll to Areas → add a custom area; it appears in the Tasks and Projects dropdowns on next render.

---

## 2026-05-14 (pass 8) — Local stack verified end-to-end, seed + LOCAL_DEV docs

Branch: `main`. Author: Claude (no commits made).

### What I did

Brought the system from "passes tests + builds" to "runs against a real Supabase stack on this machine, end-to-end."

1. Installed Supabase CLI via `brew install supabase/tap/supabase`. Started a local stack (`supabase start`) — Postgres, GoTrue, PostgREST, Realtime, Storage, Studio, Mailpit all up in Docker.
2. Applied `scripts/schema.sql` from scratch against the empty local DB. **18 tables created**.
3. Wrote `scripts/seed.sql` and applied it: 1 demo space, 5 offline members across all roles, 1 active code-of-conduct policy v1, 3 tasks, 1 project, 1 KB entry, 3 proposals (open / draft / decided) with 7 votes already cast, 1 open incident, 8 activity-log rows.
4. **Migration 019** (`scripts/019_proposal_expiry.sql`): `public.expire_proposals()` flips open proposals past their deadline to `decided` (if quorum met) or `expired`. Schedules itself hourly via `pg_cron` if the extension is enabled. Folded into `schema.sql` as Section 11.
5. Wrote `docs/LOCAL_DEV.md`: 8-step quickstart, wipe + re-seed recipe, troubleshooting section.
6. Regenerated `types/database.ts` from the live local DB. 1696 lines, 18 tables, 1 view, 3 RPC functions.
7. Wrote `.env.local` with the local Supabase URL and keys.
8. Started `pnpm dev`. Health endpoint returns 200, public routes return 200, `/dashboard` correctly 307s to `/login`.

### Verification done with real data

- Anon-key RLS gate confirmed (empty array on no-session).
- Service-role bypass confirmed.
- Created `tester@demo.local` via Auth Admin API, signed in via `/auth/v1/token`, got a real ES256 JWT, queried proposals + channels + policies — all RLS-scoped, all returning seeded data.
- **Privilege-escalation guard (migration 015)**: simulated a plain-member self-promotion via JWT-claimed authenticated role. Postgres rejected with the exact `Members cannot change their own role, tier, status, approval, card access, or space.` message.
- `expire_proposals()` runs cleanly, returns 0.
- HTML smoke: `/login` title correct, `/signup` contains expected copy.
- **259 tests across 8 files passing**.

### Files changed

```
Added:
  supabase/config.toml                        (from supabase init)
  scripts/019_proposal_expiry.sql
  scripts/seed.sql
  docs/LOCAL_DEV.md
  .env.local                                  (gitignored)

Edited:
  scripts/schema.sql                          (Section 11)
  types/database.ts                           (regenerated)
```

---

## 2026-05-14 (pass 7) — Tier 2/3 UI closure + Markdown + proxy rename

Branch: `main`
Author: Claude (no commits made).

### What I did

Finishing the user-facing surface for the schema work passes 5 and 6 added.

1. **Renamed `middleware.ts` → `proxy.ts`** for Next.js 16. Renamed the exported `middleware` function to `proxy`. The deprecation warning that the build had been emitting since pass 4 is now gone.
2. **Markdown rendering**: installed `react-markdown` + `remark-gfm`. Created `components/markdown.tsx` (`MarkdownBody`) with safe defaults — HTML escaped, no `rehypeRaw`, every link gets `rel="noopener noreferrer"` and `target="_blank"`. Wired it into the three governance detail pages so proposal bodies, incident bodies, incident dispositions, incident updates, and policy formal/plain text now render headings, lists, links, code, blockquotes, tables, strikethrough.
3. **`/profile` route** (Tier 3.1 + 3.2 UI closure):
   - Server page reads the caller's `space_members` row.
   - `ProfileForm` (client) lets a member edit display_name, handle, phone, skills, interests, willing_to. Uses a tiny custom `ChipInput` component for tag-style multi-value fields with `Enter`/`,` to commit and `Backspace` to delete.
   - `AffiliationsForm` (client) lets the member disclose COI affiliations. Submit stamps `coi_last_disclosed_at` via `discloseAffiliations`. Surfaces an orange callout for privileged-role members who haven't disclosed yet.
   - The `willing_to` field ships with suggestion chips: `board_candidate`, `treasurer_candidate`, `host_volunteer`, `area_lead_candidate`, `event_organizer`, `safety_committee`, `docs_steward`. Members can also free-form.
4. **`/recruitment` route** (Tier 3 succession view):
   - Board / admin only (server-side redirect for others).
   - Queries `space_members` for the current space; groups by each `willing_to` tag; renders one card per tag with the willing members listed underneath.
   - For privileged-role members (admin / board / treasurer) the card shows a "COI on file" or "no COI" badge based on `coi_last_disclosed_at`.
   - A separate "Skills declared (no role opt-in)" section catches members who declared skills without willing_to.
5. **Settings extensions** (Tier 2.1 + Tier 2.2 + mission statement):
   - Added `mission_statement` field to `updateSpaceSettingsSchema` (max 5000 chars, nullable).
   - The Space tab on `/settings` now has a Mission Statement textarea inside the existing space-settings form.
   - A new Visibility card on the Space tab exposes two dropdowns: `financial_visibility` (3 options) and `member_directory_visibility` (4 options). Saves via the existing `updateSpaceVisibility` action from pass 6.
6. **Mission statement display in the app shell**: when `space.mission_statement` is set, the app layout renders it in a small italic footer on every protected page — the "stated-mission visibility on every page" principle from `docs/GOVERNANCE_FEATURES.md` section 1.
7. **Dashboard widget**: above the main grid, two side-by-side cards.
   - **Open proposals awaiting your vote**: queries open proposals, joins against the caller's `proposal_votes` to filter out ones they've already voted on, shows up to 5 with the voting-window close timestamp and a live quorum percentage.
   - **Incidents needing response** (admin/board only): shows `received` and `under_review` incidents, sorted newest first, with a red "respond by" date if the SLA has elapsed.
   - The whole section only renders if at least one of the two has content.
8. **Sidebar**: added "My profile" (`UserCircle` icon) and admin-gated "Recruitment" (`UserSearch` icon) under the People group.
9. **4 new tests** in `__tests__/governance.test.ts` for the mission_statement extension to `updateSpaceSettingsSchema`. Total now **259 across 8 files**.

### Verification

- `pnpm vitest run` → **259 tests pass across 8 files**.
- `pnpm build` → success. Build emits **31 routes** (added `/profile`, `/recruitment`).
- **The middleware-deprecation warning is gone**. Only remaining build warning is the stray lockfile at `/Users/obsidian/Projects/package-lock.json`, which is outside the repo and harmless on DO.

### Open items, priority order

1. **Apply pending migrations** on production (015, 017, 018) if not already done. Fresh deploys get them all via `scripts/schema.sql`.
2. **Regenerate `types/database.ts`** with the Supabase CLI to clear the ~217 TS errors that `typescript.ignoreBuildErrors` masks. Once clean, remove `ignoreBuildErrors` so future drift surfaces in CI.
3. **Configure OAuth providers** in Supabase if you want the GitHub / Google buttons to work.
4. **Auto-expire open proposals**: when `voting_closes_at < now()`, status should auto-flip from `open` to `expired`. Currently manual via the admin's "Mark decided" button. A cron-triggered server action would close this.
5. **Mark KB entry as meeting minutes**: schema (column added in 018) and validation schema in place, but no UI control yet.
6. **Notifications on incident status change**: activity_log row written but no in-app comms message or email triggered. Add when notification infra is ready.
7. **Hosting calendar, sponsor / partner registry, community surveys**: Tier 4, deferred indefinitely until adoption signals demand.
8. **Secrets encryption at rest**: `secrets.value` and `integrations.config` still plain text. Address before storing real production credentials.

### Files changed this pass

```
Added:
  proxy.ts                                              (replaces middleware.ts)
  components/markdown.tsx
  app/(app)/profile/page.tsx
  app/(app)/profile/profile-form.tsx
  app/(app)/profile/affiliations-form.tsx
  app/(app)/profile/chip-input.tsx
  app/(app)/recruitment/page.tsx

Removed:
  middleware.ts                                         (renamed to proxy.ts)

Edited:
  app/(app)/layout.tsx                                  (mission statement footer)
  app/(app)/dashboard/page.tsx                          (governance widget)
  app/(app)/settings/settings-client.tsx                (mission statement + visibility section)
  app/(app)/proposals/[id]/page.tsx                     (MarkdownBody)
  app/(app)/incidents/[id]/page.tsx                     (MarkdownBody, ×3)
  app/(app)/policies/[slug]/page.tsx                    (MarkdownBody, ×2)
  components/app-sidebar.tsx                            (Profile, Recruitment links)
  lib/validations.ts                                    (mission_statement on updateSpaceSettingsSchema)
  __tests__/governance.test.ts                          (4 new tests)
  package.json                                          (react-markdown, remark-gfm)
  docs/HANDOFF.md                                       (this entry)
```

### How to verify locally

```bash
pnpm install                          # picks up react-markdown + remark-gfm
pnpm vitest run                       # 259 tests, 8 files
pnpm build                            # 31 routes, no middleware deprecation warning
```

In the browser:
- Visit `/profile`, edit skills / willing_to (chip input), save.
- Visit `/recruitment` as admin/board — see members grouped by willing_to.
- Visit `/settings`, scroll to "Visibility", change financial_visibility to `treasurer_only`, save, then visit `/financials` as a plain member — should be blocked. Switch back to `all_members_visible` — visible again.
- Set a mission statement on `/settings`. It appears as a footer on every protected page.
- Open a proposal, edit body to include `# heading\n\n- list\n- items\n\n[link](https://example.com)`. Renders rich.

---

## 2026-05-14 (pass 6) — Audit fixes + Tier 2/3 partial-ship

Branch: `main`
Author: Claude (no commits made).

### Audit findings

Read my pass-5 work hard. Four real defects, plus several lower-severity items I documented but didn't change.

**Critical (fixed in migration 017):**
1. `proposal_votes.votes_insert` accepted a vote where `member_id` was a `space_members` row from space A but the proposal was in space B, because the policy never joined them. Fixed: insert WITH CHECK now requires `m.space_id = p.space_id` for the joined member.
2. `votes_update` had the same bug. Same fix.
3. `incidents.incidents_insert` let the reporter set `reporter_id` to any `space_members.id` they owned — across spaces. Fixed: WITH CHECK requires the row's `space_id` match the incident's.
4. `incident_updates.incident_updates_insert` did not validate `author_id` at all. Fixed: WITH CHECK requires the author is the calling user and in the incident's space.

Plus: added partial unique index `policies_one_active_per_slug ON policies (space_id, slug) WHERE status = 'active'` so two admins concurrently activating different drafts cannot leave two `active` rows.

**Lower-severity (documented, deferred):**
- `requireMember().single()` makes multi-space membership effectively impossible. The app design has always assumed one membership per user.
- `appealIncident` does insert-then-update without a transaction; mid-flight failure leaves an orphaned proposal. Acceptable risk.
- `supersedePolicy` race between two admins computing `version + 1` simultaneously is caught by the existing `UNIQUE (space_id, slug, version)`.
- Reporter can post `visibility='board_only'` on their own incident_update via raw API and then can't read it. Self-inflicted.
- `/proposals` and `/incidents` lists don't paginate. Defer.
- Incident detail never shows the reporter's name to admin/board. Future ergonomic improvement.
- Dashboard doesn't surface open proposals or pending incidents.

### Built in this pass (audit fixes + Tier 2/3 schema + one Tier 2 UI)

1. **Migration 017** `scripts/017_governance_rls_hardening.sql`: the four RLS fixes + the partial unique index. Mirrored into `scripts/schema.sql`.
2. **Migration 018** `scripts/018_member_state_and_visibility.sql`:
   - `space_members` gains `skills`, `interests`, `willing_to`, `affiliations` (all `text[]`) and `coi_last_disclosed_at`. GIN indexes on `skills` and `willing_to`.
   - `spaces` gains `financial_visibility` and `member_directory_visibility` enums.
   - `knowledge_base` gains `is_meeting_minutes` and `meeting_date` (partial index).
   - `schedule_card_review` trigger inserts a 180-day task whenever `has_card_access` flips on.
   - `inactive_members` view: members in good standing with no `activity_log` entry in 180 days.
3. **New server actions**:
   - `members.ts → updateMyProfile({...})`: member self-edit of display_name, handle, phone, skills, interests, willing_to. The privilege-escalation trigger from migration 015 keeps role/tier/status off-limits.
   - `members.ts → discloseAffiliations({ affiliations })`: stamps `coi_last_disclosed_at` and logs to activity_log.
   - `settings.ts → updateSpaceVisibility({...})`: admin-only.
4. **Validation schemas**: `updateMyProfileSchema`, `discloseAffiliationsSchema`, `updateSpaceVisibilitySchema`, `meetingMinutesSchema`, plus exported tuples (`financialVisibilities`, `directoryVisibilities`).
5. **13 new tests** in `__tests__/governance.test.ts`. Total now **255 across 8 files**.
6. **`/financials` route**: server-component aggregations from `payments` (this month, this year, lifetime, linked vs unlinked, by platform with sparkline-style bars, last 12 months). Gated by `space.financial_visibility` against caller's role.
7. **Sidebar**: added "Financials" under People with the `LineChart` icon.

### Verification

- `pnpm vitest run` → **255 tests pass across 8 files**.
- `pnpm build` → success. **29 routes emit** (added `/financials`).
- `pnpm exec tsc --noEmit` → same Supabase generic-drift count as before. No new error categories.

### Deployment steps for this pass

Run on every existing database, in order:

```sql
\i scripts/017_governance_rls_hardening.sql
\i scripts/018_member_state_and_visibility.sql
```

Then restart PostgREST (`docker compose exec rest restart` on self-hosted; managed Supabase auto-refreshes).

Fresh deploys get both via `scripts/schema.sql` (sections 9.8 and 10). No additional config needed; new columns ship with sensible defaults.

### Open items, priority order

1. **Apply 017 on production immediately** if any chance of multi-space membership (admin client could have set it up).
2. **Apply 018** for the Tier 2/3 columns and the card-review trigger.
3. **Profile / COI / settings-visibility UI**: server actions are in place, no UI yet. A `/profile` route + extending Settings would close Tier 3.1, 3.2 and the financial-visibility toggle.
4. **Recruitment view**: query `space_members` by `willing_to` for board-only succession planning.
5. **Mark KB entry as meeting minutes from UI**: schema ready, no UI control.
6. Earlier-pass items still open: regenerate `types/database.ts`, run migration 015 if not already, rename `middleware.ts` → `proxy.ts` for Next.js 16.

### Files changed this pass

```
Added (schema):
  scripts/017_governance_rls_hardening.sql
  scripts/018_member_state_and_visibility.sql

Added (UI):
  app/(app)/financials/page.tsx

Edited:
  scripts/schema.sql               (sections 9.8 + 10)
  scripts/README.md                (017, 018 listed)
  lib/types.ts                     (FinancialVisibility + DirectoryVisibility)
  lib/validations.ts               (4 new schemas + tuples)
  lib/actions/members.ts           (updateMyProfile, discloseAffiliations)
  lib/actions/settings.ts          (updateSpaceVisibility)
  components/app-sidebar.tsx       (Financials nav link)
  __tests__/governance.test.ts     (13 new tests)
  docs/GOVERNANCE_FEATURES.md      (Tier 2 + 3 marked partial-shipped)
  docs/HANDOFF.md                  (this entry)
```

---

## 2026-05-14 (pass 5) — Tier 1 governance kernel shipped

Branch: `main`
Author: Claude (no commits made).

### What I did

Built the full Tier 1 governance kernel from `docs/GOVERNANCE_FEATURES.md`. Three new tightly integrated modules: proposals, incidents, policies. Schema + server actions + validations + tests + UI + sidebar nav.

1. **Schema**: `scripts/016_governance_kernel.sql` (and mirrored into `scripts/schema.sql` as Section 9). 5 new tables (`proposals`, `proposal_votes`, `incidents`, `incident_updates`, `policies`), 8 new enums, 6 new columns on `spaces` for governance defaults (quorum percent/floor, voting window, incident SLA, mission statement). Triggers: `compute_proposal_quorum`, `refresh_proposal_tally`, `compute_incident_sla`, `touch_updated_at`. Full RLS: any member proposes / files / reads; admin+board transition status; votes are immutable post-window; incidents readable only to reporter + admin/board. Idempotent re-run safe (`DROP POLICY IF EXISTS`, `CREATE OR REPLACE`, `EXCEPTION WHEN duplicate_object`).
2. **Types** in `lib/types.ts`: hand-typed `Proposal`, `ProposalVote`, `Incident`, `IncidentUpdateRow`, `Policy` and all 8 governance enums. `types/database.ts` should be regenerated via Supabase CLI to fold these in.
3. **Validations** in `lib/validations.ts`: 11 new Zod schemas (`createProposalSchema`, `castVoteSchema`, `decideProposalSchema`, `withdrawProposalSchema`, `openProposalSchema`, `fileIncidentSchema`, `updateIncidentStatusSchema`, `addIncidentUpdateSchema`, `appealIncidentSchema`, `createPolicySchema`, `supersedePolicySchema`, `updatePolicyStatusSchema`). Tested before being wired into actions (test-driven).
4. **Server actions**: `lib/actions/proposals.ts`, `lib/actions/incidents.ts`, `lib/actions/policies.ts`. Use the existing `requireMember` / `requireMemberWithRole` / `parseInput` / `logActivity` helpers. Re-exported via the barrel in `lib/actions/index.ts`. Notable: `fileIncident` generates an opaque `reporter_token` when anonymous; `appealIncident` atomically spawns a draft `membership_vote` proposal and flips the incident to `appealed`; `supersedePolicy` inserts a new version with `prior_version_id` set rather than mutating the prior row; `updatePolicyStatus(... , 'active')` atomically supersedes any prior active version with the same slug.
5. **Tests**: `__tests__/governance.test.ts` adds 40 tests covering every new Zod schema (valid input, invalid enum values, required field enforcement, recusal-requires-reason cross-field validation, slug character set, etc). The cross-cutting "governance contract surface" suite enforces that the enum tuples we export match the DB enums in workflow order.
6. **UI**: server-component-driven, minimal client islands.
   - `/proposals`: open / draft / archive sections with live tally and quorum hints.
   - `/proposals/[id]`: title + body + status, tally panel with quorum progress, vote form (yes/no/abstain/recused-with-required-reason), management buttons (open / withdraw / decide) gated by role, vote list with comments and recusal reasons.
   - `/proposals/new`: form with type, threshold, "open immediately" checkbox.
   - `/incidents`: open / decided / closed sections. Members see only their own; admin/board sees all (RLS enforced).
   - `/incidents/[id]`: title + body + disposition + update thread, status transition form (admin/board), post-update form (everyone with access), one-click "request membership appeal" for reporter on dismissed incidents.
   - `/incidents/new`: title, body, category, severity, optional subjects multi-select, anonymous checkbox with honest disclaimer; on anonymous submit, surfaces the opaque tracking token to the reporter once.
   - `/policies`: one row per slug showing the active (or latest) version.
   - `/policies/[slug]`: plain-language + formal text + version history, with "activate" / "supersede" / "deprecate" buttons for admins.
   - `/policies/new`: slug + title + section ref + plain + formal text. Admin-only route.
7. **Sidebar**: new "Governance" section with three links (Proposals, Incidents, Policies). Lucide icons: `Vote`, `ShieldAlert`, `ScrollText`.
8. **Docs updated**:
   - `docs/GOVERNANCE_FEATURES.md`: Tier 1 marked SHIPPED with implementation pointers.
   - `scripts/README.md`: migration 016 listed.
   - This handoff entry.

### Verification

- `pnpm vitest run` → **242 tests pass across 8 files** (was 202 / 7). The 40 new tests are in `__tests__/governance.test.ts`.
- `pnpm build` → success. **9 new routes emit cleanly** (`/proposals`, `/proposals/[id]`, `/proposals/new`, `/incidents`, `/incidents/[id]`, `/incidents/new`, `/policies`, `/policies/[slug]`, `/policies/new`). 28 routes total.
- `pnpm exec tsc --noEmit` → 217 errors (was 157). All 60 new errors are the same Supabase generic-drift pattern (`Property 'X' does not exist on type 'never'`) that the pre-existing 157 are. Runtime is unaffected. Regenerating `types/database.ts` with the Supabase CLI clears them all.

### Open items, priority order

1. **Apply `scripts/016_governance_kernel.sql`** to any existing production database. Fresh deploys get it via `scripts/schema.sql` automatically.
2. **Regenerate `types/database.ts`** with `supabase gen types typescript --project-id <ref>`. Clears the 60 + 157 = 217 TS errors. Then remove `typescript.ignoreBuildErrors` from `next.config.mjs`.
3. **Pass 4 priority 1 still applies**: run `scripts/015_prevent_member_self_role_change.sql` before external users sign in.
4. **Auto-expiry of open proposals**: when `voting_closes_at < now()`, the status should flip from `open` to `expired` (or `decided` if board acts). Currently manual. A cron-triggered server action or DB job can do this.
5. **Markdown rendering**: proposals' body is currently rendered as `<pre>` whitespace-preserved text. Pulling in `react-markdown` would give links, lists, and the `[policy:slug#section]` citation syntax from the roadmap doc. Defer until adoption is real.
6. **No notifications on incident status change**. The activity_log row is inserted but no in-app comms message or email is sent. Add later when notification infra is ready.
7. **Rename `middleware.ts` → `proxy.ts`** for Next.js 16 (still works, deprecation warning only).

### Decisions pending

- Whether to back-port Tier 2 features (skill/interest fields, COI disclosure, mid-tenure card review trigger, financial dashboard visibility settings) in the next pass.
- Whether to add markdown rendering with citation hover-cards now or wait.
- Whether to add a worker / cron to auto-flip expired proposals.

### Files changed this pass

```
Added (schema):
  scripts/016_governance_kernel.sql

Added (lib):
  lib/actions/proposals.ts
  lib/actions/incidents.ts
  lib/actions/policies.ts

Added (tests):
  __tests__/governance.test.ts

Added (UI):
  app/(app)/proposals/page.tsx
  app/(app)/proposals/proposal-badges.tsx
  app/(app)/proposals/new/page.tsx
  app/(app)/proposals/new/new-proposal-form.tsx
  app/(app)/proposals/[id]/page.tsx
  app/(app)/proposals/[id]/proposal-actions.tsx
  app/(app)/incidents/page.tsx
  app/(app)/incidents/new/page.tsx
  app/(app)/incidents/new/incident-form.tsx
  app/(app)/incidents/[id]/page.tsx
  app/(app)/incidents/[id]/incident-actions.tsx
  app/(app)/policies/page.tsx
  app/(app)/policies/[slug]/page.tsx
  app/(app)/policies/[slug]/policy-actions.tsx
  app/(app)/policies/new/page.tsx
  app/(app)/policies/new/new-policy-form.tsx

Edited:
  scripts/schema.sql                  (added Section 9: governance kernel)
  scripts/README.md                   (listed migration 016)
  lib/types.ts                        (governance entity types + enum unions)
  lib/validations.ts                  (11 new Zod schemas + enum exports)
  lib/actions/index.ts                (re-export the three new modules)
  components/app-sidebar.tsx          (Governance section with 3 links)
  docs/GOVERNANCE_FEATURES.md         (Tier 1 marked SHIPPED)
  docs/HANDOFF.md                     (this entry)
```

### Deployment steps for this pass

On any existing database:

```sql
-- In Supabase SQL editor or psql:
\i scripts/016_governance_kernel.sql
```

For a fresh deploy, the canonical `scripts/schema.sql` already includes it (Section 9). No app-level config changes needed; the new `spaces` columns ship with sensible defaults (`default_quorum_percent=10`, `default_quorum_floor=1`, `default_voting_window_hours=216` (9 days), `default_threshold='simple_majority'`, `incident_sla_hours=72`).

After applying, restart PostgREST (`docker compose restart rest` on self-hosted) so the schema cache refreshes.

---

## 2026-05-14 (pass 4) — Deploy readiness + self-hosted DO guide

Branch: `main`
Author: Claude (no commits made).

### What I did

1. **Verified deploy readiness** end to end:
   - `pnpm vitest run`: 202 tests pass across 7 files.
   - `pnpm build`: success. 19 routes emitted (including `/api/health`, `/api/paypal/sync`, `/auth/callback`, `(landing) /`, all `(app)/*` routes).
   - `pnpm exec tsc --noEmit`: 157 errors, all pre-existing supabase-js generic drift, all masked by `typescript.ignoreBuildErrors: true` in `next.config.mjs`. No new errors introduced.
2. **Fixed one self-inflicted test bug**: `__tests__/auth-helpers.test.ts` was written in pass 3 using the old `r.error` access pattern, which does not narrow now that `Result<T>` is a tagged union (`ok: true | false`). Rewrote each test to gate on `if (r.ok)` / `if (!r.ok)` before reading `data` or `error`.
3. **Surfaced two non-blocking build warnings** that the user should know about:
   - Next.js 16 deprecates the `middleware` file convention in favour of `proxy`. Build still works with `middleware.ts`; rename to `proxy.ts` whenever convenient.
   - Next.js detected a stray `/Users/obsidian/Projects/package-lock.json` outside the repo (workspace root inference). Local-only nuisance, does not affect CI or DO builds.
4. **Wrote `docs/DEPLOY_DO_SELFHOSTED.md`**: complete end-to-end guide for running the entire stack on one DigitalOcean Droplet with self-hosted open-source Supabase. 16 sections, ~700 lines, copy-pasteable commands throughout. Covers:
   - Architecture and cost (~$48/mo for 8 GB Droplet).
   - Droplet provisioning, hardening, Docker/Nginx/Certbot install.
   - DNS records for `yourdomain.com`, `supabase.yourdomain.com`, `studio.yourdomain.com`.
   - Self-hosting Supabase: cloning `supabase/supabase`, generating `JWT_SECRET` / `ANON_KEY` / `SERVICE_ROLE_KEY` via a Node one-liner, full `.env` template, port-remap override (Studio defaults to 3000 and collides with the Next.js app; doc rebinds it to 3001 and forces all internal ports to `127.0.0.1` to keep them off the public internet).
   - Applying `scripts/schema.sql`, `014_*.sql`, `015_*.sql` via `docker compose exec db psql`.
   - Building the app image with `NEXT_PUBLIC_*` build args (otherwise the client bundle ships with `undefined` for them — common gotcha).
   - Nginx server blocks for app, Supabase API, and basic-auth-gated Studio.
   - Let's Encrypt SSL covering all four hostnames.
   - Post-deploy verification including a regression test for migration 015's privilege-escalation guard.
   - Daily `pg_dump` backups with 14-day local rotation and an off-site path to DO Spaces.
   - Operations: app upgrades, incremental schema migrations (with `docker compose restart rest` to refresh PostgREST's schema cache), Supabase version upgrades.
   - Hardening checklist (14 items) and a troubleshooting section covering the eight problems people actually hit.
5. **Linked the new doc** from `README.md` (deployment table + body section) and from the top of `docs/DEPLOYMENT.md`. Made it explicit that `DEPLOYMENT.md` covers managed-Supabase paths and `DEPLOY_DO_SELFHOSTED.md` covers full self-hosting.

### Deployment quick reference (so the next session does not have to re-read everything)

| Path | When to use | Guide |
|------|-------------|-------|
| Vercel + managed Supabase | Fastest path, no infra to manage | `docs/DEPLOYMENT.md` section 4 |
| DO App Platform + managed Supabase | Want DO but not infra | `docs/DEPLOYMENT.md` section 5, spec at `.do/app.yaml` |
| DO Droplet + managed Supabase | Container-only on your VPS, Supabase Cloud for DB | `docs/DEPLOYMENT.md` section 6 |
| DO Droplet + self-hosted Supabase | Full data ownership, single Droplet | `docs/DEPLOY_DO_SELFHOSTED.md` |

Migrations to run on every fresh deploy, in order:
1. `scripts/schema.sql` (canonical, idempotent)
2. `scripts/014_member_user_id_nullable.sql`
3. `scripts/015_prevent_member_self_role_change.sql` (security; do not skip)

### Open items, priority order

1. **Run migration 015 on any live database** before external users sign in. Without it, any authenticated member can `UPDATE space_members SET role = 'admin'` on their own row via direct PostgREST.
2. **Rename `middleware.ts` to `proxy.ts`** to clear the Next.js 16 deprecation. Single-file rename; the export and matcher contract is unchanged.
3. **Regenerate `types/database.ts`** via `supabase gen types typescript --project-id <ref>` (managed) or against the self-hosted Postgres. Clears the 157 TS errors. Then drop `typescript.ignoreBuildErrors: true` from `next.config.mjs` so future type drift surfaces in CI.
4. **Wire OAuth providers** in Supabase dashboard (GitHub, Google). The client code already calls `supabase.auth.signInWithOAuth`; only the provider configuration is missing.
5. **Encrypt `secrets.value` and `integrations.config`** before storing real production credentials.
6. **Stale docs**: `DB_SCHEMA_MAP.md` and `docs/ARCHITECTURE.md` still claim 4 default channels. Schema creates 3 (`general`, `announcements`, `ops`).
7. **`signUp` trigger metadata mismatch** in `scripts/schema.sql` (`handle_space_signup` reads `space_id` but the app never passes it). Benign; trigger short-circuits. Either remove the trigger or rewire it.

### Decisions pending from the user

- Whether to rename `middleware.ts` → `proxy.ts` now or wait for a future Next.js major version that removes the alias.
- Whether to regenerate `types/database.ts` against managed Supabase (`supabase gen types` requires the project ref) or wait until self-hosting is up and run it against that.
- Whether to commit the pass 1–4 changes as one large commit, four sequenced commits matching the pass boundaries, or branch-and-PR per concern.

### How to verify locally

```bash
pnpm install
pnpm vitest run                                # 202 tests, 7 files
pnpm build                                     # success in ~3s; warnings about middleware/lockfile are non-blocking
pnpm exec tsc --noEmit 2>&1 | grep -v never | wc -l   # remaining non-Supabase errors should be 0
```

### Files changed this pass

```
Added:
  docs/DEPLOY_DO_SELFHOSTED.md

Edited:
  __tests__/auth-helpers.test.ts
  README.md
  docs/DEPLOYMENT.md
  docs/HANDOFF.md
```

No application code, no schema, no UI, no business rules were changed in pass 4. The pass added a major deployment guide and confirmed the work from passes 1–3 produces a clean build and a green test suite.

---

## 2026-05-14 (pass 3) — Architecture refactor + real tests

Branch: `main`
Author: Claude (no commits made).

### What I did

1. **Split `lib/actions.ts` (914 lines, 29 functions) into 10 domain files** under `lib/actions/`. Each file owns one entity:
   - `tasks.ts`, `projects.ts`, `members.ts`, `contacts.ts`, `payments.ts`, `knowledge-base.ts`, `secrets.ts`, `area-leads.ts`, `settings.ts`, `imports.ts`
   - `lib/actions/index.ts` re-exports everything via `export * from './foo'`
   - Every client import `from '@/lib/actions'` still resolves correctly.
2. **Created `lib/permissions.ts`**: role constants (`ROLES`, `ADMIN_ROLES`, `TREASURER_ROLES`, `ACTIVE_STATUSES`), `Role` type alias, `hasRole(role, allowed)` helper. Removes magic-string role chains.
3. **Created `lib/auth-helpers.ts`**: `getAuthMember`, `requireMember`, `requireMemberWithRole`, `parseInput`, `logActivity`. Result types use the canonical `ok: boolean` discriminator so TypeScript narrows on `if (!r.ok)` reliably.
4. **Wired validation into every server action** that has a schema (was previously only `createTask` and `claimTask`). 18 more actions now reject bad input at the boundary instead of hoping the database rejects it.
5. **Expanded `lib/types.ts`** with re-exports for `Role`, `Member`, `MemberSummary`, `Result`, `MemberResult`, `ActionResult`, and the role/permission constants. One-stop import for typed work.
6. **Deleted dead code**: `app/auth/login/page.tsx` (duplicate login linking to nowhere), `components/app-shell.tsx` (unused, hardcoded badge counts).
7. **Wrote real tests**: 76 new tests across four files exercise real project code instead of inline assertions.
   - `__tests__/validations.test.ts`: 37 tests verifying every Zod schema accepts real DB enums and rejects legacy ones.
   - `__tests__/permissions.test.ts`: 10 tests for role constants and `hasRole`.
   - `__tests__/security.test.ts`: 25 tests for `sanitize*`, `escapeHtml`, `checkRateLimit`, `isValidUuid`.
   - `__tests__/auth-helpers.test.ts`: 4 tests for `parseInput`.
   - Full suite: **202 tests, 7 files, all passing**.
8. **Fixed vitest config**:
   - `vitest.setup.ts` had inline JSX in a `.ts` file (esbuild refuses). Replaced with `React.createElement`.
   - `vitest.config.ts` was picking up Playwright e2e specs. Added `include: ['__tests__/**/*.{test,spec}.{ts,tsx}']` and `exclude: ['e2e/**']`.
9. **Added `scripts/README.md`** documenting the migration convention (canonical `schema.sql` + numbered incremental files, idempotency rules, security baseline, verification queries).

### Open items, priority order

1. **TypeScript drift between `@supabase/supabase-js` generics and our `Database` type**: 38 errors in `lib/actions/*` of the form `'X' is not assignable to parameter of type 'never'`. These existed in the original `lib/actions.ts` too (the build masks them via `next.config.mjs: typescript.ignoreBuildErrors: true`). Fix is to regenerate `types/database.ts` with the latest supabase CLI so the generated `Database` shape matches what `@supabase/ssr` expects.
2. **103 app/ TypeScript errors** in client components (`comms-client.tsx`, `members-client.tsx`, etc). Pre-existing v0 codegen output; same root cause as item 1. Untouched in this pass to avoid UI regressions.
3. **`getCurrentMember` was removed** from `lib/actions.ts` when I split it; no caller referenced it. If anything starts to need it, define a server action in `lib/actions/index.ts` or use `getAuthMember` from `lib/auth-helpers.ts`.
4. **Pass 2 priority 1 (run `scripts/015_*.sql` on production) is still outstanding** until the user runs it.
5. **`signUp` trigger metadata mismatch** remains documented but unfixed.
6. **Stale docs**: `DB_SCHEMA_MAP.md` and `docs/ARCHITECTURE.md` say 4 default channels. Schema creates 3.

### Decisions pending

- Whether to regenerate `types/database.ts` via the Supabase CLI to clear the remaining 141 TS errors.
- Whether to also run `next.config.mjs` without `typescript.ignoreBuildErrors: true` once types are clean.
- Whether to add CI to run `pnpm vitest` and `pnpm exec tsc --noEmit` on every push.

### Files changed this pass

```
Added:
  lib/permissions.ts
  lib/auth-helpers.ts
  lib/actions/tasks.ts
  lib/actions/projects.ts
  lib/actions/members.ts
  lib/actions/contacts.ts
  lib/actions/payments.ts
  lib/actions/knowledge-base.ts
  lib/actions/secrets.ts
  lib/actions/area-leads.ts
  lib/actions/settings.ts
  lib/actions/imports.ts
  lib/actions/index.ts
  __tests__/validations.test.ts
  __tests__/permissions.test.ts
  __tests__/security.test.ts
  __tests__/auth-helpers.test.ts
  scripts/README.md

Edited:
  lib/types.ts
  vitest.config.ts
  vitest.setup.ts

Removed:
  lib/actions.ts            (replaced by lib/actions/ directory)
  app/auth/login/page.tsx   (dead duplicate)
  components/app-shell.tsx  (dead, unused)
```

### How to verify locally

```bash
pnpm install
pnpm vitest run
# expect: 202 tests passing across 7 files
```

---

## 2026-05-13 (pass 2) — Application repairs

Branch: `main`
Author: Claude (no commits made).

### What I did

1. **Fixed dashboard "Quick Chores" bug** (`app/(app)/dashboard/page.tsx:49`). The filter was `.neq('status','done')` but `completeTask()` writes `'completed'`. Completed tasks were leaking into the open list. Replaced with a positive filter on the open statuses.
2. **Fixed signup copy**: said default channels were "general, announcements, random". Schema creates "general, announcements, ops". Aligned.
3. **Fixed `lib/validations.ts` enum drift**: nine schemas had values that did not match the database. Now aligned: task type and recurrence, project status, member role, contact type, KB visibility, cash payment shape, settings, area lead.
4. **Wired validation into high-risk server actions**: `createProject`, `updateProjectStatus`, `addMember`, `logCashPayment`, `linkPaymentToMember`. Other actions still pass raw `formData`; documented in `docs/AUDIT.md` section 4.4.
5. **Patched privilege escalation in `space_members`**: added a `BEFORE UPDATE` trigger (`prevent_member_self_role_change`) that rejects self-updates of `role`, `tier`, `status`, `approved`, `has_card_access`, `space_id` unless the user is already admin/board/treasurer in that space. Applied to `schema.sql`. Shipped as incremental migration `scripts/015_prevent_member_self_role_change.sql` for existing databases. Run this on any production database immediately.
6. **Removed duplicate auth functions** in `lib/actions.ts` (`signIn`, `signOut`, `getUser`). Canonical versions live in `lib/auth-actions.ts`. Verified no caller imports them from `actions.ts`.
7. **Deleted dead scripts**: `fix-actions.js`, `fix-sidebar.js`, `fix-sidebar.mjs`, `patch-dashboard.mjs`. All had hardcoded `/vercel/share/v0-project` paths.
8. **Synced `types/database.ts`** for `space_members.user_id` to `string | null` matching the schema fix from pass 1.

### Open items, priority order

1. **Run `scripts/015_prevent_member_self_role_change.sql` on production** before any external user can authenticate. Until then, any member can self-promote to admin via direct PostgREST.
2. **`app/auth/login/page.tsx`** is a dead duplicate login page linking to non-existent `/auth/onboarding`. Delete the directory.
3. **`components/app-shell.tsx`** is dead (no importer). Delete.
4. **Wire validation into remaining actions** listed in `docs/AUDIT.md` 4.4 (updateMember, contacts, KB, secrets, area lead, settings, integrations, imports).
5. **Secrets at rest**: still plain text.
6. **`signUp` trigger metadata mismatch** is benign (trigger short-circuits) but should be removed or re-aligned. See `docs/AUDIT.md` 4.5.
7. **Stale docs**: `DB_SCHEMA_MAP.md` and `docs/ARCHITECTURE.md` still say 4 default channels. Schema creates 3.

### Decisions pending

- Whether to wire validation into the remaining actions in the next session.
- Whether to delete `app/auth/login/` and `components/app-shell.tsx` now.
- Whether to regenerate `types/database.ts` properly via `supabase gen types` instead of the manual edit applied here.

### How to verify the security fix

```sql
-- Connect to your Supabase project's SQL editor as a regular user (NOT service role):
-- The following should now fail with "Members cannot change their own role..."
UPDATE public.space_members SET role = 'admin' WHERE user_id = auth.uid();
```

### Files changed this pass

```
Edited:
  app/(app)/dashboard/page.tsx
  app/signup/page.tsx
  lib/validations.ts
  lib/actions.ts
  scripts/schema.sql
  types/database.ts
  docs/AUDIT.md
  docs/HANDOFF.md

Added:
  scripts/015_prevent_member_self_role_change.sql

Removed:
  scripts/fix-actions.js
  scripts/fix-sidebar.js
  scripts/fix-sidebar.mjs
  scripts/patch-dashboard.mjs
```

---

## 2026-05-13 (pass 1) — Deep audit + fresh-deploy hardening

Branch: `main`
Author: Claude (per CLAUDE.md, no commits made this session).

### What I did

1. Wrote `CLAUDE.md` at the repo root. It is the standing brief: no Claude attribution in commits, no emojis, no em dashes, no AI tells, test-driven where practical, always document, handoff after long sessions, smart separation of concerns.
2. Audited every source file. Findings in `docs/AUDIT.md`.
3. Fixed three idempotency / fresh-deploy issues in `scripts/schema.sql`:
   - `space_members.user_id` is now nullable (offline members work).
   - Realtime `ALTER PUBLICATION` wrapped in `DO ... EXCEPTION` blocks.
   - All RLS policies preceded by `DROP POLICY IF EXISTS`.
4. Added `scripts/014_member_user_id_nullable.sql` for upgrading existing databases.
5. Added every missing deployment artifact: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.do/app.yaml`, `.env.example`, `app/api/health/route.ts`.
6. Updated `middleware.ts` to let `/api/health` through without auth.
7. Updated `docs/DEPLOYMENT.md` to reference bundled artifacts instead of asking the user to write their own.

### What I did not touch

- Application logic (`lib/actions.ts`, `lib/auth-actions.ts`, all `*-client.tsx`).
- UI components.
- Tests.
- Validation schemas (they are wrong in places, see audit section 4.1, but fixing them is a behavior change).

### Open items, in priority order

1. **Privilege escalation on `space_members.role`** (audit 4.11). A self-update via the `members_update` RLS policy lets a member rewrite their own row, including `role`. Fix before production.
2. **Validation schema enum mismatches** (audit 4.1). Six schemas in `lib/validations.ts` reject valid database values. Wire schemas into actions and align the enums.
3. **Dead code**: four `scripts/fix-*.{js,mjs}` files with hardcoded `/vercel/share` paths, and `components/app-shell.tsx` which no page imports. Delete on next cleanup.
4. **Duplicate auth functions**: `lib/actions.ts` lines 30 to 47 redeclare `signIn`, `signOut`, `getUser` that already live in `lib/auth-actions.ts`. Consolidate.
5. **Secrets at rest**: `secrets.value` and `integrations.config` are plain text. Encrypt before production.
6. **UI-only features**: OAuth buttons, CSV import processor, webhook endpoint, payment platform syncs (except PayPal), email notifications. See audit 4.7.
7. **`package.json` name is `"my-project"`**. Cosmetic.
8. **Older docs reference 4 default chat channels**; schema creates 3 (`general`, `announcements`, `ops`). `DB_SCHEMA_MAP.md` and `docs/ARCHITECTURE.md` are stale on this point.

### Decisions pending from the user

- Whether to delete dead scripts now (low risk) or in a separate change.
- Whether to apply `scripts/014_member_user_id_nullable.sql` against the live database (production may already have user_id nullable per `DB_SCHEMA_MAP.md`, this migration is idempotent).
- Whether to wire validation schemas into existing server actions in the next session.

### How to verify the fresh-deploy fixes locally

```bash
# 1. Spin up a fresh Supabase project at supabase.com
# 2. In Supabase SQL Editor, paste scripts/schema.sql and run it. Should report no errors.
# 3. Re-run scripts/schema.sql. Should still report no errors (idempotent).
# 4. Copy .env.example to .env.local, fill in Supabase URL + anon + service role.
pnpm install
pnpm dev
# 5. Visit http://localhost:3000, sign up, create a space, confirm /dashboard renders.
# 6. curl http://localhost:3000/api/health  -> {"status":"ok"}
```

### How to verify the Docker build

```bash
# Requires .env.local populated.
docker compose build
docker compose up -d
curl http://localhost:3000/api/health
docker compose logs -f app
```

### Files changed this session

```
Edited:
  middleware.ts
  scripts/schema.sql
  docs/DEPLOYMENT.md

Added:
  CLAUDE.md
  Dockerfile
  .dockerignore
  docker-compose.yml
  .do/app.yaml
  .env.example
  app/api/health/route.ts
  scripts/014_member_user_id_nullable.sql
  docs/AUDIT.md
  docs/HANDOFF.md
```

No git commits were made. The working tree carries all changes; the user decides what to commit and when.
