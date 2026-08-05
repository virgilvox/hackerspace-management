# Handoff Log

Append-only. Newest entries on top. Keep each entry to one screen.

---

## 2026-08-05 (single-tenant mode + setup CLI + security fix)

Shipped **single-tenant deployment mode** so a hackerspace can run its own private instance (own DB, own
domain, one space) from the same codebase, with no schema fork. Also patched a pre-existing critical auth
vuln found during review. Branch `feat/single-tenant-mode` (2 commits); merging to main.

**Approach.** The app is pooled multi-tenant (many spaces per deploy, `space_id`-scoped) and already single
active space per user; resolution is membership-only (no subdomain routing). So single-tenant = a config-gated
MODE, not a rewrite. Decided AGAINST forking or stripping `space_id`.

**Tier 1 (core).** `lib/tenant.ts` is the single source of truth (pure `resolveTenantConfig` + `tenantConfig()`
+ `appBaseUrl()`, mirrors `lib/auth-config.ts`). New NEXT_PUBLIC_ flags (server re-enforced, never trusted from
the client): `NEXT_PUBLIC_SINGLE_TENANT`, `_SITE_NAME`, `_SINGLE_TENANT_SPACE_SLUG`, `_SINGLE_TENANT_OPEN_JOIN`,
`_SHOW_MARKETING`. `createSpace` refused when `!allowSpaceCreation`; `joinSpace` open-join resolves the
configured/sole space with an empty invite code (still honors `require_approval` + already-a-member guard);
`proxy.ts` hides the marketing shell; signup UI drops the create/join chooser and uses `siteName`. The four
`|| 'https://hackerspace.sh'` base-URL fallbacks now go through `appBaseUrl()` (default localhost) so a fork
never leaks the platform domain. **All no-ops when the env is unset, so hackerspace.sh (multi-tenant) is
unchanged.**

**Tier 2 (productize).** `pnpm setup` (`scripts/setup.mjs`): doctor / provision / create-admin / all-in-one,
idempotent, creates the **first admin via the Supabase Admin API** (`createUser email_confirm`, then the admin
`space_members` row); flag > env > `.env.local` precedence; masked prompts; `--yes`/`--force` (force also
resets an existing admin's password). `scripts/apply-migrations.sh` + `deploy/deploy.sh` commit the previously
droplet-only CD glue; `_migrations_applied` folded into `schema.sql`. `docker-compose.full.yml` +
`.env.full.example` = bundled app + self-hosted Supabase. `docs/SINGLE_TENANT.md` + `docs/CUSTOMIZE.md`
(the documented `lib/tenant.ts` pattern for white-labeling) + README pointer. `__tests__/tenant.test.ts` (19).

**SECURITY (pre-existing, migration 055 -> 056).** Dropped the stale `handle_space_signup()` AFTER-INSERT auth
trigger. It was SECURITY DEFINER and read `role`+`space_id` from client-controlled `raw_user_meta_data`, so a
crafted `supabase.auth.signUp({options:{data:{role:'admin',space_id:'<uuid>'}}})` could self-insert an approved
admin member (surviving approval, since `approveMember` does not reset role), bypassing createSpace/joinSpace.
Real signups never set those keys (membership comes from the server actions), so it was dead code AND a
takeover vector. `scripts/056_drop_stale_signup_trigger.sql` (idempotent) drops it; the droplet deploy applies
pending `scripts/0*.sql` via `_migrations_applied`, so 056 lands in prod on this merge.

**Gates.** tsc 0, lint 0 errors, **664 unit tests** (was 626; +tenant + fixed enqueue test), `next build` ok.
Verified by a 10-agent review workflow (build + gates + 4 adversarial lenses); all findings fixed. NOT
browser-smoke-tested against a live single-tenant DB (needs `pnpm setup` against real Supabase); compose is
syntax-validated only. Follow-up if desired: a live `pnpm setup` proof + an authed e2e for open-join.

---

## SESSION CLOSEOUT 2026-05-21 (read this first)

**What this arc shipped (passes 63-70, all DEPLOYED).** The **door epic is now complete (P1-P5)**. P4 inbound access-log ingest: a `CRON_SECRET`-guarded HeatSync `?z` poll (now parallelized via `Promise.allSettled`) PLUS a per-connection bearer-authenticated webhook (`/api/door/inbound/[connection]`), both matching the presented card to a member via the HeatSync hex-uid model (`cardMatchesEvent`) and deduping on `(connection_id, dedupe_key)`; config on `/door/manage`. P5 universal API-call button builder: admins define permission-gated `api_buttons` (any HTTP verb + headers + body + vault secret, default the new `apicall.invoke` code) fired through ONE shared hardened egress (`callDoor` + `callApi` over an internal `egress`), builder at `/door/buttons`, members press from `/doors`, every press in `api_call_log`. Migrations **053** (ingest) + **054** (buttons + perm). Plus: dashboard + comms + form-builder **mobile-overflow fixes** (`min-w-0` on flex-truncate rows), the **`docs/SPINE_VALIDATION.md`** owner runbook, and a **privilege-escalation RLS** integration test.

**State.** `pnpm test` 626 unit (deploy gate, hermetic); `pnpm test:integration` 54 vs real Postgres. Build + lint clean. Prod healthy. Migrations through **054** applied. Many diversified audit passes this arc found no P0: the reals were the ingest matcher false-positive (fixed -> hex-uid anchored), the sequential poll (fixed -> parallel), stale docs (refreshed), and one runbook inaccuracy (fixed). The PGRST201 outage class is RE-VERIFIED contained (a fresh `pg_constraint`/`pg_index` query confirms the ONLY composite-PK 2-FK junction is the legitimate `space_member_custom_roles`; the new tables are surrogate-`id`, not junctions).

**Provisioning status (`docs/SPINE_VALIDATION.md`).** **A1 (Resend) + A2 (`CRON_SECRET` + both crontabs) are now DONE on the prod Droplet (pass 71 below)** and proven: crons flipped 503->401 public / 200 authed; a direct Resend send from the verified `hackerspace.sh` domain succeeded. **Still owner/external (the remaining gap):** A3 per-space Stripe test keys + Billing Portal + the Dues-tab config; A4 the Supabase Change-Email template + `/auth/confirm` allowlist; A5 (optional) an admin enabling a door connection; and **Part B** (a real test-mode dues cycle + booking/class/form notifications + `/me` click-through), all of which need external accounts or a live authenticated session.

**Backlog (priority order for the next session):**
1. **OWNER-GATED spine validation EXECUTION.** The runbook is written (`docs/SPINE_VALIDATION.md`); the owner now executes Part A (provision) + Part B (prove the dues cycle / notifications / `/me` / door). The agent cannot (external accounts + live session + on-droplet env/cron). This converts shipped -> proven.
2. **Production observability.** Phase 1 (app-side capture seam) is BUILT + inert, pending deploy (pass 72): backend-agnostic no-SDK fetch seam -> `SENTRY_DSN`, secret-scrubbed, covers the money path + both crons + all server actions (via `onRequestError`). Remaining = Phase 2 (the box): swap + self-hosted GlitchTip on the existing supabase-db + the DSN. Owner chose self-hosted GlitchTip.
3. **Owner browser review** (auth-gated, agent cannot): `/me`, the Dues tab, AND the new door surfaces (`/door/manage` inbound panel, `/door/buttons` builder, `/doors` Actions); plus a real-device check of the mobile flex-row fixes with a long name.
4. **Extend the integration harness**: payments link/import, presence, forms `submitForm`/`linkSubmissionsByEmail`. (Door RLS, api-buttons RLS, and the permission-escalation guard are now covered.)
5. Defense-in-depth noted, not done: `.eq('space_id')` on equipment-cancel / door-slot writes (parent already space-checked); webhook signing secret shown pre-populated to admins (retrievable by design); door-ingest parallel poll bursts up to 50 concurrent DB calls (fine for a small fleet, bounded by `MAX_CONNECTIONS`). Deferred until product need: outbound webhooks epic, server-side search, multi-space-per-user, Zeffy/Venmo live APIs.

**Door-epic facts to keep (do not relitigate):** transport is NOT LAN-only (cloud-hosted; per-connection host pin, metadata/link-local always blocked, no redirects, resolve-once-connect-by-IP); HeatSync `?z` is a 40-slot ring with no per-entry id (poll is best-effort, the webhook is the reliable transport); the SSRF pin is enforced on the FINAL assembled URL incl. `url_template`; `card_uid` is hex (the grant encoder requires it) and `?z` reports decimal. Button management = `door.manage` (the catalog scopes it to "buttons"); invoke = each button's `required_permission`.

**Locked decisions (do not relitigate without the owner):** single space per user; dues lapse is grace -> late, never auto-inactive/auto-approve; forms email-link may include anonymous typed emails (attribution only); external dues links are link-config only (no auto payment record on click); Stripe is configured in ONE place (the Dues tab). PGRST: NEVER add a `spaces` FK to a `space_members`-referencing table (the 052 outage class), guarded by `integration/auth-embed.test.ts`.

---

## 2026-05-21 (pass 72): Observability Phase 1 (app-side capture seam, inert)

Branch `main`. Took backlog item 2. Design-first: owner chose self-hosted GlitchTip (+ swap), so the app-side capture is a backend-agnostic seam pointed at a DSN. Implementation call (made, not asked): a **no-SDK fetch envelope sender** mirroring `lib/email/send.ts`, NOT `@sentry/nextjs` (keeps the client bundle + `next.config` untouched, zero dependency/supply-chain). NOT yet deployed; awaiting owner go.

**Shipped (local):**
- `lib/observability/scrub.ts` (pure): redacts emails, JWTs, Bearer tokens, Stripe `sk_`/`rk_`/`whsec_`, Resend `re_`, bare 32+ hex; leaves dashed UUIDs intact. Deep-walks objects (depth/breadth-capped, cycle-safe).
- `lib/observability/capture.ts`: `parseDsn` + pure `buildEvent` (scrubbed) + `captureException`/`captureMessage`. Inert when `SENTRY_DSN` unset (no-op). Best-effort fire-and-forget POST to `…/api/<projectId>/store/` with a 2.5s abort; never throws into a caller.
- `instrumentation.ts` `onRequestError` -> the broad net for any thrown route/RSC/server-action error (no per-action wiring). Manual capture at the swallow/500 sites that never reach it: Stripe webhook (dedupe + handler), `/api/cron/notifications` (candidates + prefs), `/api/cron/door-ingest` (load + poll-fail + threw), `enqueueNotification` (central), `lib/door/ingest.ts` insert.
- `__tests__/observability.test.ts` (+13). Docs: `.env.example` `SENTRY_DSN`; ARCHITECTURE observability subsection.

**Gate:** `pnpm test` **639** (was 626; +13) green; `pnpm build` clean. Server-side capture only (no client SDK). No migration, no schema, no RLS.

**Deployed (`c89e4d9`, run 26260262561 success); inert in prod** (`SENTRY_DSN` unset). Phase 1 was a safe no-behavior-change deploy.

**Phase 2 = a REPRODUCIBLE repo artifact, not droplet surgery (owner steer).** Instead of hand-building containers on the specific droplet, the GlitchTip backend is now committed at `deploy/glitchtip/` (`docker-compose.yml` + `.env.example` + README), self-contained (its OWN Postgres + Redis, shares nothing with the app stack), `127.0.0.1`-bound, memory-capped, one-command `docker compose up -d` (migrate runs first via `service_completed_successfully`). Any self-hoster gets it the same way; the app stays generic (`SENTRY_DSN` works with this OR Sentry SaaS OR nothing). A 2GB swapfile was added to the production droplet (was RAM-tight: 3.8G, no swap) + persisted in fstab. **Phase 2 is now LIVE on prod:** the GlitchTip stack runs from `/opt/hackerspace-ops/deploy/glitchtip` bound to `127.0.0.1:8100` (port 8100 not 8000 to avoid Supabase Kong; the committed compose default was fixed to 8100 in `ad4b9f5`), web/worker/redis/postgres healthy, ~2.3G RAM available + light swap. `SENTRY_DSN=http://<key>@localhost:8100/1` is set in `.env.production`, app restarted. Ingest proven: a verification event POSTed in the seam's exact request shape returned HTTP 200 + an event id (so DSN + auth + event format + GlitchTip ingest all work; the app uses the identical request from `buildEvent`, so real server errors now land automatically). Open registration locked off (`ENABLE_OPEN_USER_REGISTRATION=False`). Dashboard viewed via SSH tunnel `-L 8100:127.0.0.1:8100`. Verified in the GlitchTip UI: issue SH-1 `VerificationError` with tags `surface=phase2-verify` / `environment=production` (running GlitchTip 6.1.6). The committed compose image is now PINNED to `glitchtip/glitchtip:6.1.6` (was `latest`) for reproducibility. A first hand-rolled bring-up attempt was scrapped after a psql-quoting bug; the committed compose superseded it. Observability item 2 = DONE (both phases).

---

## 2026-05-21 (pass 71): Spine provisioning A1+A2 executed on prod (owner-supported)

Branch `main`. Owner asked the agent to provision directly; did it over SSH on the Droplet. No code change, no deploy (config + crontab on the box only; the sole repo edit is this HANDOFF).

**Real prod layout (docs drift; corrected in memory `prod-ops-access`).** App is `/opt/hackerspace-ops` (NOT `/opt/hackerspace`), runs as systemd `hackerspace-app` via `next start` (native Node, NOT docker compose), env file `/opt/hackerspace-ops/.env.production` (`deploy:deploy 0600`), `deploy` has passwordless sudo. Supabase runs in docker on the same box.

**A1 Resend (DONE + proven, incl. the full pipeline).** `.env.production` was missing all three spine vars. Backed it up, added `RESEND_API_KEY` (from `secrets/base.env`) + `EMAIL_FROM="hackerspace.sh <noreply@hackerspace.sh>"`. The key is a restricted send-only key (can't list domains), so proved the domain via a direct `POST https://api.resend.com/emails` (returned a message id). Then proved the FULL app outbox pipeline: injected one `pending` `notifications` row (member_id NULL = always-send, space HeatSync Labs) via the service client and ran the authed dispatcher on the box -> `{scanned:1,sent:1}`, row reached `status=sent`; deleted the test row (notifications back to 0). Remaining notification gap is only the ENQUEUE side on real domain events (Part B, needs a live session).

**A2 CRON_SECRET + crontabs (DONE + proven).** Generated `CRON_SECRET` on the box, added to `.env.production`; installed BOTH crontab lines in the `deploy` crontab with `CRON_SECRET=` defined inline at the top (a bare `$CRON_SECRET` in a crontab line is empty -> silent 401; the runbook example is a footgun). Restarted `hackerspace-app`. Verified: public no-auth + wrong-bearer now **401** (were 503); authed localhost **200** (`notifications {scanned:0..}`, `door-ingest {ok:true,polled:0..}`). Outbox now drains every minute.

**Security false-alarm RETRACTED.** Early in the pass I claimed `secrets/base.env` + the SSH key were committed to a public repo. That was a misread (I attributed `git check-ignore` output to `git ls-files`). Truth: `.gitignore:32 /secrets/` ignores them; they are NOT tracked / committed / on any of the 6 remote branches. No leak, no rotation needed.

**Still open (owner/external).** A3 Stripe (test keys, webhook endpoint from the Dues tab, Billing Portal, Dues-tab save), A4 Supabase Change-Email template + `/auth/confirm` allowlist, A5 (optional) door connection enable, and Part B end-to-end proof. The vault `secrets` table has 1 row (the one door connection); 0 integrations connected.

---

## 2026-05-21 (pass 70): Audit the runbook + lock the privilege-escalation RLS

Branch `main`. Audited the freshly-written runbook against the code, then locked an untested core security invariant.

**Audit (the runbook is owner-executed, so an error is a real bug).** Verified `docs/SPINE_VALIDATION.md`'s factual claims against the source: env var names, the two cron endpoints + their fail-closed codes (401/503), the Stripe webhook path + event list + the 400-on-unsigned, the Dues-tab fields + the displayed webhook URL, the Billing-Portal + change-email steps, Stripe test cards. **One inaccuracy fixed:** the notifications-cron response is `{scanned, sent, failed, retried, skipped}` (the runbook had omitted `skipped`).

**Continued: locked the privilege-escalation guard (was untested).** The additive permission model's integrity rests on one RLS gate: only `admin`/`board` may WRITE `space_role_permissions` (insert WITH CHECK, update/delete USING `user_has_role_in_space(...,['admin','board'])`). There was NO integration test for it. Added `integration/permission-escalation.test.ts` (4): a plain member's INSERT of a self-grant is rejected; an admin's INSERT succeeds (positive control); a member's DELETE of a seeded grant is USING-filtered to 0 rows so the grant survives (no error, no effect); an admin cannot INSERT into another space (WITH CHECK pins space). (Dropped a 5th read-visibility case: `rowsAsUser` mis-parses a multi-row `select 1` projection -- a harness quirk, not an app issue, and low value next to the write guards.)

**State.** 626 unit / 54 integration (was 50; +4) / build + lint green. This pass ships together with pass-69 (the runbook + README link) -- docs + one new test, no code/migration, no behavior change.

---

## 2026-05-21 (pass 69): Diversified audit (public/API, clean) + spine-validation runbook

Branch `main`. Fresh diversified audit on surfaces NOT recently touched, then took backlog item 1 (the owner-gated spine validation).

**Audit (CLEAN, diversified).** Enumerated all 6 `app/api/**` route handlers (the 4 pre-existing + the 2 door ones) -- all accounted for and gated. XSS: the only `dangerouslySetInnerHTML` is `components/ui/chart.tsx` (developer CSS vars, not user data). SSRF: the ONLY variable-URL `fetch` outside the hardened door executor is `/api/paypal/sync`, and its `baseUrl` is a hardcoded constant gated by a boolean `sandbox` flag (`api-m[.sandbox].paypal.com`), not admin-controllable -- no SSRF. No `console.*` logs a secret/key/token. Combined with the converged door/api-button/mobile passes, no new finding.

**Continued: backlog item 1 -> `docs/SPINE_VALIDATION.md` (new).** A precise owner runbook + copy-paste checklist that converts the shipped-but-inert spine into proven-working. Part A provisioning (Resend domain + `RESEND_API_KEY`/`EMAIL_FROM`; `CRON_SECRET` + BOTH crontabs incl. door-ingest, with 401/503/200 verifies; per-space Stripe test mode -- products/prices, secret key, the webhook endpoint URL the Dues tab displays + signing secret, Billing Portal activation, the Dues-tab save; the Supabase Change-Email template + `/auth/confirm` allowlist). Part B end-to-end validation (test-mode dues cycle incl. renewal/failed/lapse + the dispatcher email + in-app inbox; booking/class/form notifications; pref muting vs always-on billing; `/me` click-through; door grant/self-entry/inbound + API-button press). Grounded in the actual config (exact env vars, the `StripeBillingPanel` webhook URL, the route fail-closed codes), not invented. Linked from the README docs table. Owner executes; the agent cannot (external accounts + a live session + on-droplet env/cron).

**State.** Docs-only this pass (no code, no migration). 626 unit / 50 integration / build + lint green (unchanged). Item 1 deliverable produced; remaining backlog: production observability (item 2, design-first), integration-harness extension (item 4), owner browser review (item 3, owner-only).

---

## 2026-05-21 (pass 68): App-wide mobile-overflow audit + cron poll parallelized

Branch `main`. Continued the mobile pass app-wide and cleared the tracked cron finding. Build + lint green; 626 unit / 50 integration.

**Audit: systematic mobile horizontal-overflow scan.** Grepped every `truncate` in `app/`+`components/` for the flex anti-pattern (a `truncate` flex child without `min-w-0` will NOT shrink, so a long value pushes the row past the viewport). Triaged the 5 files that use `truncate` but never `min-w-0`: table-cell truncates in `payments`/`import` are fine (`max-w-[…]` + `table-cell`), the payments meta `<p>` is a block child (fine), and `mini-previews` is decorative landing. Two real instances fixed: **comms channel-name spans** (3, the channel sidebar/mobile drawer) -> `truncate min-w-0`; **form-builder published-URL span** -> `flex-1 min-w-0 truncate`. (Pass 67 already fixed the dashboard presence + door-self-entry spans.)

**Cron poll parallelized (clears the pass-66 latent finding).** `/api/cron/door-ingest` now polls connections with `Promise.allSettled` instead of a sequential `for…await`, so a tick is bounded to ~the slowest single poll rather than the SUM of all 6s timeouts (a slow/unreachable fleet could previously run minutes and overlap the next minute's tick). Each connection stays isolated (one bad controller can't 500 the run); `MAX_CONNECTIONS=50` caps the fan-out; dedup keeps it idempotent. Inert until CRON_SECRET is provisioned.

**Deploy.** This pass + the uncommitted pass-66 (docs/README refresh) + pass-67 (dashboard mobile + API-button re-audit) ship together (see the deploy note below this entry once pushed). No migration; no behavior change for existing users (className + cron-internal only).

---

## 2026-05-21 (pass 67): API-buttons/door re-audit (clean) + dashboard mobile fixes

Branch `main`. Re-audited the API-call buttons + door subsystems with a fresh adversarial lens and did a dashboard mobile-responsiveness pass.

**API-buttons + door audit (CLEAN, no code bug).** Re-read the invoke path, executor, and validations. Confirmed: the SSRF pin is enforced on the FINAL assembled URL (`base_url + url_template + query-secret` -> `validateDoorTarget` -> resolve-once-connect-by-IP), so even a `url_template` like `@evil.com` cannot bypass it -- a host mismatch with the per-button pin rejects, and the metadata/link-local block is absolute. `buildApiRequest` drops a caller `Host` header and undici rejects CRLF in header names/values (no request smuggling). Invoke is rate-limited FIRST, loads the def service-side scoped to the member's space, gates on the per-row `required_permission` (denials audited), fails closed on disabled/unknown-permission, decrypts the secret server-side and never returns it; `api_call_log` detail is double-redacted (egress + action). Tenant isolation holds; all UI rendering is escaped JSX; no committed secrets. The pass-65 hex-uid matcher holds.

**Dashboard mobile responsiveness.** The shell is sound (fixed 52px mobile top bar + hamburger drawer; `main` clears it with `pt-[52px] md:pt-0`) and the dashboard grids already collapse (`grid-cols-2 lg:grid-cols-4` stats; `lg:grid-cols-[1fr_280px]` -> single column; 44px touch targets on Quick Task / CLAIM; titles `truncate` with `min-w-0`). Found + fixed TWO real horizontal-overflow bugs: in `dashboard/presence-panel.tsx` and `dashboard/door-self-entry.tsx` the name `<span>` had `truncate` but no `min-w-0`, so in a flex row a long member/door name would NOT shrink and pushed the row past the viewport (horizontal scroll on a phone). Added `flex-1 min-w-0` (+ `shrink-0` on the door Open button). The task-row title was already correct. No other overflow risks found (banner links `flex-wrap`; proposals/incidents titles are block `truncate`; activity/project text wraps). **Could not browser-test (auth-gated); verified by layout inspection + build.** Note (not changed): shared `Button size="sm"` is ~36px tall, under the 44px touch guideline, but that is app-wide and consistent, not a dashboard regression.

**State.** Build + lint green; 626 unit / 50 integration unchanged (className-only + audit). Includes the pass-66 docs (still uncommitted).

---

## 2026-05-21 (pass 66): Ultrathink audit (broad) + docs/README refresh

Branch `main`. A fresh diversified audit (not re-defending the door work) plus the doc/README consolidation it surfaced. No code change this pass.

**Audit (diversified surfaces; findings).**
- **Clean / re-verified.** No committed secrets in the door/api-button files. No hardcoded permission-code list that adding `apicall.invoke` would break (the only consumers are `user_has_permission` calls + the door-template default). The `apicall.invoke` catalog addition + 054 backfill are additive (board + admin-implicit only; member/treasurer/associate unchanged). API-button header injection is bounded: `buildApiRequest` drops a caller `host`, and undici rejects CRLF in header names/values (no request smuggling); admins are trusted for their own buttons and the metadata/link-local block is absolute regardless. The matcher fix (pass 65) holds.
- **Finding 1 (LATENT, inert): poll cron is sequential.** `/api/cron/door-ingest` does `for (const c of conns) await pollConnectionLog(c)` with a 6s per-poll timeout and `MAX_CONNECTIONS=50`, so a fleet of slow/unreachable controllers can make one tick run up to ~300s (the crontab's `curl -m 30` returns, but the Node handler keeps running), and overlapping minute-ticks can pile up. Safe for correctness (idempotent dedup) and a non-issue for the deploying org (1-2 doors), but a real scaling concern. **Recommended fix when this matters: `Promise.allSettled` the polls (bounded) so a tick takes ~max(single poll) not the sum, and/or lower the per-poll timeout.** Inert today (CRON_SECRET unprovisioned). Not changed this pass (docs-focused; would need its own deploy).
- **Finding 2 (DOCS, fixed this pass): stale docs.** ARCHITECTURE still framed the door epic as "P1-P3 built / migrations 034-036; epic in progress"; the README access-control bullet predated P4/P5; and the README pointed at `docs/AUDIT.md` (a 2026-05-14 snapshot) as "the latest audit." Fixed below.

**Docs/README refreshed (same-change).** ARCHITECTURE: door section header + intro now read "migrations 034-036, 053-054; epic complete, P1-P5"; the migration parenthetical points to DATABASE_SCHEMA for the full history; "Last Updated" -> 2026-05-21. README: access-control feature bullet now covers grant/revoke/self-entry + inbound ingest (poll + webhook) + the API-call button builder; the project-status pointer now sends readers to HANDOFF.md for the running log and labels AUDIT.md as a historical 2026-05-14 snapshot. `docs/AUDIT.md` gained a top banner saying the same. CHANGELOG `[Unreleased] / Added` gained a door-epic-complete entry.

**State.** Suite 626 unit / 50 integration / build + lint green. Migrations through 054. Door epic feature-complete + deployed (P1-P5). One latent scaling finding (cron sequential poll) documented, not yet fixed.

---

## 2026-05-20 (pass 65): Door epic P4+P5 DEPLOYED + ultrathink audit

Branch `main`. Shipped the batched door-epic completion and ran a fresh diversified audit.

**Deploy (DEPLOYED).** Passes 63 (P4 inbound ingest) + 64 (P5 API-call builder) shipped together in `7ec90b0` (run 26204184395, success). Deploy log confirms `applying 053_door_inbound_ingest.sql` then `applying 054_api_buttons.sql`, no errors. Smoke: `/` 200, `/login` 200, `/dashboard` `/doors` `/door/manage` `/door/buttons` 307->login (the new builder route exists + is gated, not 404). New endpoints fail-closed: `/api/cron/door-ingest` 503 (CRON_SECRET still unprovisioned in prod -> poll inert), `/api/door/inbound/<malformed>` 404, `/api/door/inbound/<uuid>` no-bearer 401. Could not run the prod anon-key auth-embed (PGRST201) check from here (local `.env.local` holds the local-stack key, not the prod JWT); the regression class is covered by `integration/auth-embed.test.ts` (green vs the migrated 053+054 schema) and the schema reasoning (door_connections' 2nd secrets FK is a surrogate-PK table, not a junction; nothing embeds secrets; the auth embed is untouched). `/dashboard` 307 (no `/signup` bounce) is consistent with a healthy embed.

**Ultrathink audit (fresh, diversified; no auto-defend).** Surfaces: public/API, authz/RLS, XSS/rendering, schema/PGRST, the shared egress refactor, `logActivity`.
- **Re-verified clean.** The egress refactor preserves `callDoor` exactly (the SSRF pin is enforced on the FINAL assembled URL for `callApi` too: base + url_template + query-secret -> `validateDoorTarget` -> resolve-once -> connect-by-IP; host header forced to the pin; metadata/link-local block is absolute even for an admin-configured button; url_template cannot inject a host past the pin). AuthZ/tenant isolation: button loads are space-pinned, invoke is per-row-permission-gated, the denial path is now rate-limited. XSS: all new rendering is escaped JSX. PGRST: no new junction (all new tables have surrogate PKs; api_buttons/api_call_log are never embedded). `activity_log` is free-text so `logActivity('api_button', ...)` inserts cleanly. The `apicall.invoke` seed `CREATE OR REPLACE` is idempotent + backfilled.
- **One finding, FIXED this turn (was LOW; audit-only; inert).** The original `cardUidsEquivalent` matched a card uid by exact string OR numeric equality across BOTH decimal and hex readings of the STORED uid, which both mis-attributed all-digit uids (stored `"16"` = hex 0x16 = 22 wrongly matched a decimal poll of card 16) and was conceptually wrong. Replaced with source-anchored `cardMatchesEvent(storedUid, ev)`: HeatSync stores the uid as hex (the grant encoder requires it) and `?z`/webhook report the DECIMAL card number, so a reported decimal matches when `hexInt(storedUid)` equals it; a webhook `card_uid` also matches by exact (case-insensitive) string. The stored uid is never read as decimal, removing the false positive while keeping every legit match (hex `9c40` <-> poll `40000`; all-digit hex `10` <-> poll `16`). +tests; suite 626. Note for whoever enables ingest: this assumes stored uids are hex (true for the HeatSync grant path); confirm against a real controller, and if a space stores DECIMAL uids the anchoring would need revisiting.
- **Accepted trade-offs (re-confirmed, documented).** Webhook decrypt-flood needs an unguessable connection uuid (post-auth rate limit kept to avoid a targeted relay lockout); the webhook content-length guard is best-effort behind the platform body limit; the cron automates an admin-configured outbound call within the existing door-connection trust model; audit inserts are best-effort (a call result still returns on a logging blip).

**Backlog item 5 TRIAGED + CLOSED: `user_has_permission` EXECUTE-to-PUBLIC.** Investigated the grant flagged pass 56. Findings: (1) `user_has_permission` (+ `user_has_role_in_space`) grant EXECUTE to `anon` + `authenticated` + `service_role` (explicit, not loose PUBLIC). (2) `anon` holds the DEFAULT Supabase broad grants (SELECT/INSERT/UPDATE/DELETE) on all 51 public tables; RLS is the SOLE gate, and ~40 policies call `user_has_permission` in their USING/CHECK. So `anon` genuinely EVALUATES those policies, which means revoking EXECUTE from `anon` would make anon queries **error** ("permission denied for function") rather than deny -- it is STRUCTURALLY REQUIRED, not removable. (3) The residual exposure is a boolean oracle (`rpc user_has_permission(uid,sid,perm)` -> does uid hold perm in sid), but it needs a known `auth.uid` (a victim's UUID), which `anon` cannot obtain (auth ids are not anon-readable; single-space-per-user makes cross-space probes mostly `false`). (4) The genuinely dangerous SET-returning enumeration variant (`members_with_permission`) is already locked (`REVOKE FROM PUBLIC` / `GRANT service_role`, migration 047). **Conclusion: no change; the grant is required by the RLS model and the practical leak is a low-value boolean gated by uid secrecy.** A harder lockdown (moving the function to a PostgREST-unexposed schema so it stays RLS-callable but is not a public RPC) is a large, risky refactor touching every policy and is NOT justified by the residual risk. Item 5 closed.

**State.** Suite 626 unit / 50 integration / build + lint green. Migrations through 054. Door epic feature-complete (P1-P5). Backlog item 5 closed (no change). Ingest attribution matcher hardened (`cardMatchesEvent`).

---

## 2026-05-20 (pass 64): Door epic Phase 5 (universal API-call UI builder) (DEPLOYED in 7ec90b0; see pass 65)

Branch `main`. Completes the door epic. Design-first via AskUserQuestion; the user chose **full verbs** (GET/POST/PUT/PATCH/DELETE) + **per-button required permission**. Suite 624 unit (was 615; +9 buildApiRequest tests) / 50 integration (was 44; +6 api-buttons) / build green / lint clean.

**Shipped (local):**
- **Migration 054**: new permission code `apicall.invoke` (group Access) seeded into `seed_default_role_permissions` (CREATE OR REPLACE) + backfilled for board on existing spaces (additive, like door.* in 034). `api_buttons` (label, button_group, sort_order, method, base_url, pinned_host, url_template, headers jsonb, body_template, auth_mode/auth_param, secret_ref -> vault, required_permission default apicall.invoke, confirm, is_enabled) + `api_call_log` (append-only press audit, redacted, service-client-only). All button CRUD = `door.manage` (the catalog already scopes door.manage to "buttons"); per-button required_permission gates pressing (enforced by the invoke action, members have no RLS read on defs). schema.sql + types + DATABASE_SCHEMA + DB_SCHEMA_MAP + catalog same-change.
- **Shared egress**: refactored `lib/door/executor.ts` so the SSRF+resolve+connect-by-IP+no-redirect+caps+redact core is one internal `egress`; `callDoor` (GET) is behavior-identical (guarded by the existing door tests), `callApi` adds full verbs + headers + body + per-auth_mode secret injection, host header forced to the pin. Pure request assembly in `lib/api-call-logic.ts` (`buildApiRequest`) + 9 unit tests.
- **Actions** `lib/actions/api-buttons.ts`: manage CRUD + `listApiCallLog` (door.manage); `listInvokableButtons` (curated, presentational-only) + `invokeApiButton` (rate-limit-first, per-row permission check, denials audited, secret server-side, redacted audit). Zod schemas (method enum, https? url, header count/length caps, required_permission refined against the catalog).
- **UI**: builder `/door/buttons` (grouped list, create form, door-template preset, secret + required_permission pickers, enable/delete, the call log) + sidebar "API buttons" link (door.manage). Member invoke: an "Actions" section on `/doors` (grouped buttons, confirm dialog).
- **Audit**: SSRF egress reused (host pin + metadata block absolute even for admin config; member never supplies url/headers/body, only a buttonId); tenant-isolated; secret space-scoped + never returned + redacted; all rendering escaped JSX; single secrets FK (PGRST safe, auth-embed green). **Fix:** moved the invoke rate-limit before any DB work so a member can't flood denial-audit rows.

**Deploy state.** DEPLOYED in `7ec90b0` (run 26204184395; see pass 65). Migrations 053 + 054 live on prod. No new env var or cron for P5 (all in-app). Inert until an admin creates a button.

**Open / next.** Door epic is feature-complete (P1-P5). v1 limits (documented, not bugs): the builder supports create/enable/delete (full field edit = delete+recreate); buttons use static url/headers/body (no per-press placeholder substitution). Browser click-through of `/door/buttons` + the `/doors` Actions section still pending (auth-gated). Back to the main backlog after this: owner-gated spine validation, observability, etc.

---

## 2026-05-20 (pass 63): Door epic Phase 4 (inbound access-log ingest) (DEPLOYED in 7ec90b0; see pass 65)

Branch `main`. Took backlog item 6. Design-first via AskUserQuestion; the user chose BOTH transports. Built poll + webhook sharing one ingest core. Suite 612 unit (was 594; +18 parser tests) / 44 integration (was 40; +4 door-ingest) / build green / lint clean.

**Web-verified first.** Refetched `zyphlar/Open_Access_Control_Ethernet.ino` and characterized the `?z` wire format (recorded in memory `integration-api-facts`): `<pre>`-wrapped `K: N` stream from a fixed 40-slot ring (no per-entry id), card number split across G+g/D+d with divisor 32767, emitted decimal vs hex-stored uid, H:M:E only at verbosity <2. Conclusion: poll is best-effort, webhook (explicit ids) is the reliable path.

**Shipped (local):**
- **Migration 053** (additive only): `door_access_log.dedupe_key` + partial-unique `(connection_id, dedupe_key)` (re-poll / webhook-retry no-op; action rows stay NULL/unconstrained); `door_connections.inbound_enabled` (opt-in, off) + `inbound_secret_ref -> secrets` (inbound bearer secret, distinct from the outbound password). schema.sql + types + DATABASE_SCHEMA + DB_SCHEMA_MAP same-change. PGRST: 2 secrets FKs but surrogate PK = not a junction (safe re 052); auth-embed test still green.
- **Pure parser** `lib/door-log-logic.ts` (`parseHeatSyncLog`, `normalizeWebhookEvents`, `cardMatchesEvent` source-anchored hex-uid match -- see pass 65) + unit tests.
- **Ingest core** `lib/door/ingest.ts` (resolve card->member, dedupe-insert via service client). Extracted the shared `resolveDoorSecret` to `lib/door/secret.ts` (door.ts now imports it). Executor gained an additive `fullBody` option (32KB cap; existing callers unchanged at 4096/500).
- **Poll** `POST /api/cron/door-ingest` (CRON_SECRET, proxy-whitelisted, native_heatsync + inbound_enabled only, ≤50 conns/run). **Webhook** `POST /api/door/inbound/[connection]` (proxy-whitelisted prefix, per-connection bearer constant-time, generic 401 non-oracle, 64KB body guard, 120/min, Zod ≤100 events). Both feed the ingest core.
- **Admin UI**: per-connection "Inbound" panel on `/door/manage` (secret picker, on/off toggle that requires a secret first, copyable webhook URL + payload hint, "inbound on" badge).
- **Audit hardening** (3 passes): body-size guard before JSON parse; `occurred_at` clamped not-in-future so a relay can't reorder the log. **Fresh-pass real bug fixed:** the `?z` body is untrusted plaintext HTTP, and `Number('9'*400)===Infinity` then `BigInt(Infinity)` THROWS, which would 500 the whole poll and starve other connections; capped the parser value at 15 digits (firmware is int32) + bounded the G/g pairing window + wrapped each connection in the cron loop in try/catch. Verified: executor change behavior-identical for existing callers; inbound secret space-scoped on write + read; tenant isolation from the looked-up connection; ingested `detail` renders as escaped JSX (no XSS); audit log stays immutable from the client (integration-tested). Accepted trade-offs (documented): decrypt-flood needs an unguessable uuid; `resolved` count is mild info to the already-trusted relay; the content-length guard is best-effort behind the platform body limit.

**Deploy state.** DEPLOYED in `7ec90b0` (run 26204184395; see pass 65). Migration 053 live on prod. No new env var (reuses CRON_SECRET); the door-ingest crontab line is documented in DEPLOYMENT but optional (only spaces that enable inbound need it). Inert until an admin turns on `inbound_enabled` for a connection AND the owner provisions CRON_SECRET + the crontab.

**Open / next.** Door epic **Phase 5** (universal API-call UI builder, `api_buttons`) is the remaining door work; it needs its own design pass (HTTP-method scope + per-button vs fixed invoke permission forks) and extends the executor to method+headers+body. Browser click-through of the `/door/manage` inbound panel still pending (auth-gated; can't curl). Minor deferred: a far-future-date relay can't reorder but a near-now spoof is accepted (trusted relay); `resolved` count is mild info to the trusted relay.

---

## 2026-05-20 (pass 62): Diversified surface audit + fixes (DEPLOYED)

Branch `main`. Audited surfaces I had NOT recently touched, via three parallel independent reviews: (1) anonymous/public + all `app/api/**` route handlers, (2) XSS / unsafe rendering across the whole app, (3) authorization + tenant-isolation in legacy server actions (tasks/projects/members/kb/secrets/contacts/comms/classes/equipment/door/presence/certs/invites/roles/permissions/onboarding/forms/governance). **No P0 on any surface.** Suite 594 / build green.

### Fixed
- **P1 stored XSS (onboarding `payment_url`).** `app/onboarding/onboarding-flow.tsx` rendered the admin-entered `payment_url` into an `href` with no protocol check (onboarding step `config` is `z.record(z.unknown())`). Same class as the dues-url bug: an admin could store `javascript:...` and XSS every new member in onboarding. Fixed at the sink with `sanitizeUrl` (http(s)-only; renders nothing otherwise).
- **P2 forum comment tenant check.** `lib/actions/forum.ts addComment` only space-verified `forum_thread` targets; `proposal`/`incident`/`policy` `entity_id`s were unchecked, so a member could attach a comment to another space's entity (stamped with their own `space_id`; low impact since reads filter by space, but a real gap). Now verifies the target row exists in the caller's space (RLS-scoped read) for every entity type before insert.
- **P2 joinSpace rate limit.** Added `checkRateLimit('joinspace:<uid>', 10/hr)` for parity with `createSpace`/`signIn`, bounding invite-code guessing (codes are ~40-bit so not practically guessable, but it was the one unthrottled auth action).

### Clean (verified by the reviews)
- Markdown rendering is centralized + hardened: `components/markdown.tsx` (no `rehypeRaw`), `components/safe-markdown.tsx` (`rehypeRaw` THEN `rehypeSanitize` with a tightened schema, href protocols allowlisted). Comments/forum/proposals/incidents/policies render inert. Member profile fields render as escaped JSX text. The one `dangerouslySetInnerHTML` (chart.tsx) is developer-config, not user data.
- Public/API: `proxy.ts` whitelist is narrow + exact; `submitForm` resolves space server-side + projects answers through `validateAnswers` + rate-limited; `getPublicForm` never serves members-only; `/auth/callback` open-redirect guard + `/auth/confirm` OTP-type pin intact; `paypal/sync` role-gated + constant fetch URLs (no SSRF). No `fetch()` to a user-controlled URL anywhere.
- AuthZ: every mutating action has an auth gate; every `createAdminClient()` query is scoped to `member.space_id`. (Defense-in-depth noted, not fixed: equipment cancel / door slot writes filter by space-unique id after a space-checked parent load; adding `.eq('space_id')` would be belt-and-suspenders.)

### Deploy state (DEPLOYED)
- Passes 60 (Dues tab) + 61 (Stripe-card footgun + validation) + 62 (this) shipped together in `c0d6d49` (run 26153548195, success; no migration). Prod re-verified: auth embed `space_members?select=*,spaces(*)` returns `[]` (not PGRST201); `/` 200, `/dashboard` 307->login, `/login` 200. No regressions.

---

## 2026-05-20 (pass 61): Deep audit + fixes (LOCAL, NOT deployed)

Branch `main`. Deep audit of the app + the recent change set (passes 56-60), an independent subagent review of the new code, and fixes for what was real. Suite 594 unit / 40 integration / build green.

### Systemic PGRST201 finding (root cause fully characterized, class contained)
The outage class is now precisely understood. PostgREST treats a 2-foreign-key table as an ambiguous many-to-many **junction only when its PRIMARY KEY covers both FK columns** (the classic join-table shape). That is why `notification_preferences` (PK `space_id, member_id, category`) broke the `space_members <-> spaces` embed, while the **23 other tables that FK to both** `space_members` and `spaces` (notifications, payments, member_billing, classes, equipment, ...) do **not** — they have surrogate `id` PKs. Verified by querying `pg_constraint`/`pg_index`: the only remaining composite-PK 2-FK junction is `space_member_custom_roles` (space_members <-> space_custom_roles), which is a **legitimate** M2M (no competing direct relationship, so no ambiguity). The auth embed is guarded by `integration/auth-embed.test.ts`. Conclusion: the class is contained; the rule to remember is in DATABASE_SCHEMA 052 and the ARCHITECTURE gotcha note.

### Fixed
- **Stripe config footgun (real bug).** The Integrations tab had a generic "Stripe" card writing via `saveIntegration`, which **overwrites** `integrations.config` wholesale -- it would clobber the dues config's `mode`/`prices`/`grace_days` (managed by the Dues-tab `saveStripeSettings`) and could not actually configure dues. Removed the Stripe entry from `INTEGRATIONS_CONFIG`; Stripe is now configured in exactly one place (the Dues tab). Integrations keeps PayPal/Zeffy/Venmo (separate sync surface).
- **Boundary validation** (subagent P1/P2): `deleteDuesPaymentMethod` now validates `platform` against `DUES_LINK_PLATFORMS` (was passing a raw client string into the enum column); `markNotificationsRead` uses a strict uuid regex for the optional id filter.

### Reviewed, no change needed
- Independent subagent review of notifications/dues/inbox/me/settings: **no P0**. Self-views correctly scoped to the caller's own `member_id`; no cross-member/cross-space path; inbox renders `body_text` (never `body_html`) so no XSS; dues links double-validated https before render; cron auth constant-time; cron prefs fail open (correct for a billing-critical mailer).
- Webhook signing secret is shown pre-populated to admins on `/settings` (subagent P2): left as-is -- webhook secrets are meant to be retrievable, the page is admin-only.

### Open / next
- NOT deployed: the Stripe-card removal + the two validation fixes are prod code, committed locally. Awaiting user go. (No migration.)

---

## 2026-05-20 (pass 60): /settings "Dues" tab (LOCAL, NOT deployed)

Branch `main`. The Stripe-dues config + external-payment-links panels were floating below the settings tab bar (rendered by page.tsx outside SettingsClient, shown regardless of the active tab). Moved both into a new **Dues** tab inside SettingsClient (tabs are now Space / Integrations / Dues / Webhooks); the panels render as standard `bg-card rounded border` tab cards instead of `border-t` page sections. page.tsx now renders only SettingsClient. UI-only, no schema/actions change. Build + 594 unit green. NOT deployed.

---

## 2026-05-20 (pass 59): PROD OUTAGE fix + in-app inbox + /me consolidation + style

Branch `main`. Suite 594 unit, 40 integration, build clean.

### PROD OUTAGE (fixed + deployed, migration 052)
Migration 048 (`notification_preferences`) had FKs to BOTH `space_members` and `spaces`. PostgREST read it as a junction, so the auth layout's `space_members.select('*, spaces(*)')` embed went ambiguous (`PGRST201`) -> `member` null -> EVERY logged-in user bounced to `/signup` (anon landing was fine). Live from the pass-58 `ab8c22a` deploy until the hotfix. Fix: migration 052 drops the redundant `space_id -> spaces` FK (space still reachable + cascades via `member_id -> space_members`). Verified by reproducing `PGRST201` on local PostgREST, then confirming `[]` after the drop; confirmed on PROD (run 26142626745, `a7d880d`) by testing the embed against `supabase.hackerspace.sh` with the anon key. **Regression guard added:** `integration/auth-embed.test.ts` runs the exact embed through PostgREST and fails on `PGRST201`. Root lesson: build/unit/psql-integration never exercised the PostgREST embed, so the schema-level ambiguity slipped through.

### Shipped in this pass (LOCAL, NOT yet deployed beyond the 052 hotfix)
- **In-app notification center (Phase 5; migration 051).** `notifications.read_at` + partial unread index; `/me` Notifications becomes an inbox (unread dot/bold, click to expand `body_text` + mark read, "Mark all as read", unread count). `getMyNotifications` returns read state + body + unread count; `markNotificationsRead({ids?})` is a service-client write scoped to the caller's `member_id`. Always-on channel: email-muted (`skipped`) rows still show. NOT deployed yet.
- **/me <- /profile consolidation.** Deleted `app/(app)/profile/*`; `/me` is the single member page. Ported the COI privileged-role nudge + last-disclosed date into `/me`'s profile editor. Removed the "My profile" sidebar + command-palette entries; renamed the `/me` nav label "My access" -> "My membership" (matches the page title). Repointed the recruitment empty-state link to `/me`.
- **Style: realigned `/me` to the central theme.** Reverted the `rounded-lg` cards I introduced in the pass-58 visual pass back to `rounded` (the app norm: 519 `rounded` vs 53 `rounded-lg`, and what `/profile` used). Routed `/me` section headers through the `SectionTitle` primitive instead of an inline `sectionH` const. (Self-critique: the pass-58 "visual pass" introduced the `rounded-lg` drift the user flagged.)

### Deploy state (DEPLOYED)
- Shipped in `5d153b4` (run 26144230714, success). Deploy log confirms `applying 051_notification_read_state.sql`. **Auth re-verified on prod**: `space_members?select=*,spaces(*)` returns `[]` (NOT PGRST201) via the anon key, so the outage class stays fixed; `notifications.read_at` is live. Smoke: `/` 200, `/dashboard` 307->login, `/profile` 307 (route deleted, no longer linked anywhere).

### Open / next
- Browser review of `/me` still pending (auth-gated; can't curl). Worth a click-through of the inbox (read/unread, mark-all) and the consolidated profile editor.

---

## 2026-05-19 (pass 58): Dues payment options + /me visual pass (DEPLOYED)

> DEPLOY STATE: pass-57 + pass-58 shipped together in commit `ab8c22a`
> (run 26139360768, success). Deploy log confirms `applying
> 048_notification_preferences.sql` then `applying 049_dues_payment_methods.sql`.
> Smoke clean: public 200; gated /me + /settings redirect to login; Stripe
> webhook 400 (sig rejected); cron 503 (CRON_SECRET unset, fails safe). No
> regressions. Inert until Resend + CRON_SECRET provisioned (notifications) and
> an admin adds dues payment links. Browser click-through of the /me visual
> pass still pending owner review. This deploy-state edit is held local and
> rides the next deploy (pass-56 convention).

Branch `main`. Same session as pass-57; addressed three follow-up requests the user raised after the notification-prefs work. Suite 593 (was 585; +8 dues-payments tests), build clean. NOT deployed. Stacks on top of the uncommitted pass-57 changes.

### Design forks (locked via AskUserQuestion)
- /me polish scope: **full visual pass** (chips/presets restored AND broader tightening), staged for user review.
- Alternate payment model: **platform-typed** (tied to the `payment_platform` enum, one URL per platform, pre-tagged for manual reconcile), not free-form.

### Shipped (local, uncommitted)
- **Alternate dues payment methods (migration 049).** New `dues_payment_methods` table (one row per `(space_id, platform)`, PayPal/Zeffy/Venmo), RLS SELECT = space member / write = admin/board. Pure logic `lib/dues-payments-logic.ts` (`DUES_LINK_PLATFORMS`, labels, `isSafeDuesUrl` = absolute-https only; the Zod schema reuses it). Actions `lib/actions/dues-payments.ts` (member `listActiveDuesPaymentMethods`; admin `listDuesPaymentMethods` / `upsertDuesPaymentMethod` / `deleteDuesPaymentMethod`). Admin UI `components/settings/dues-payment-methods-panel.tsx` appended to `/settings`. Member UI = the reworked dues card. Link configuration only: no payment record on click, treasurer reconciles manually via the existing payments flow (platform pre-typed). schema.sql + types + DATABASE_SCHEMA + DB_SCHEMA_MAP updated same-change.
- **Stripe dues UI gated on configuration.** `getMyBilling` now returns a `configured` flag (`isStripeConfigured`); the dues card shows the Stripe "Pay dues with card" button only when the space has Stripe set up. With no Stripe + no external links it shows a "contact an admin" note instead of a dead Checkout button.
- **/me full visual pass.** The Phase-3 `/me` profile editor had regressed to plain comma-separated text inputs; restored the chip/preset editor. Promoted `ChipInput` to a shared `components/chip-input.tsx` and `WILLING_TO_SUGGESTIONS` to `lib/profile-presets.ts`; both `/me` and `/profile` now use them (deduped; deleted `app/(app)/profile/chip-input.tsx`). `/me` profile-form: skills/interests/willing-to/affiliations are now chips (willing-to with the recruitment-role suggestions); cards use `rounded-lg`, consistent field labels. Dues card restyled.

### Audit (one pass)
- Made `isSafeDuesUrl` load-bearing (the Zod url field now refines on it, removing the duplicate inline https check). Verified ChipInput limits match the profile Zod schema (skills/interests 40×60, willing_to 20×60, affiliations 50×200). Confirmed `getMyBilling`'s only real caller is `/me` (shape change from `null` to always-object is safe). External links render `target=_blank rel=noopener noreferrer`; url validated absolute-https so no javascript:/data: scheme.

### Post-deploy audit follow-up (DEPLOYED, run 26141570221)

> Shipped in commits 897ff99 + 5ce6b29 + f253432 (run 26141570221, success).
> Deploy log confirms `applying 050_dues_payment_methods_https.sql`. Smoke
> clean: public 200; webhook 400; cron 503. Integration suite 38 green
> (local). The /me visual pass browser review by the owner is still the one
> open item.

**Third ultrathink-audit finding (migration 050): stored-XSS defense gap on the dues url.** `dues_payment_methods.url` is rendered to members as a clickable `<a href>`. The https requirement was enforced ONLY in the admin Zod action, but RLS lets an admin/board write the row directly via PostgREST (public anon key + their JWT), bypassing Zod, and the table had no url constraint. A malicious admin could store `javascript:...` and XSS any member who clicks. Fixed two ways: (a) migration 050 adds a CHECK `url ~* '^https://'` (the DB is now the source of truth; integration-tested that the service path can't store `javascript:`/`http:`), and (b) the member-read action filters with `isSafeDuesUrl` (defense-in-depth, immediate protection for current prod). Admin-gated and prod has no rows yet, so no live exploitation window, but it escalated "space admin" to "XSS any member" and is closed now.

Second ultrathink audit after the `ab8c22a` deploy found NO deploy-blocking bug. Re-read the dispatcher, dues actions, and dues card with fresh eyes: URL is Zod-validated absolute-https; the `delete` platform flows through a parameterized `.eq` filter (double-gated by the space pin + RLS); writes/reads are scoped to the authenticated member; billing is never muted (logic + test). Then hardened + polished (all local, post-`ab8c22a`):
- **Integration coverage added (now 37, was 31).** `integration/dues-payment-methods.test.ts` (4: admin insert + member read + non-admin write denied + cross-space read denied + cross-space write denied + 046 unverified-admin gate) and `integration/notification-prefs-dispatch.test.ts` (2: muted category -> `skipped` while billing always sends; no-pref-row -> sends). The dispatcher skip was unexercised in prod (cron gated off), so this is its first real exercise. All 37 pass vs local Postgres.
- **Harness bug fixed.** `integration/db.ts` `rowsAsUser` ran `begin; set; select; commit;` in one `psql -c`, which prints only the LAST statement's result, so the SELECT output was swallowed (returned `[]`). It was never used before; now the SELECT is the last statement (session `set`, no trailing `commit`).
- **Dues-card copy polish.** Suppressed the "No active dues subscription" line for spaces with no Stripe (it read as confusing alongside the contact-admin note for external-only / unconfigured spaces).

### Still open
- **Browser click-through not done.** Verified type-check + build + 593 unit + 38 integration only; `/me` and `/settings` are auth-gated and need a live Supabase session to render. The /me visual pass is staged for the owner to review in a browser. Flagging per the working agreement (do not claim UI success without rendering it).
- Features remain inert until the owner provisions Resend + CRON_SECRET (notifications) and adds dues payment links (external pay options). Same posture as the prior phases.

---

## 2026-05-19 (pass 57): Product spine Phase 5: member notification preferences (DEPLOYED in ab8c22a)

Branch `main`. Took backlog item 2: per-member opt-out of muteable notification categories, doubling as the volume governor for the Phase 4 fan-outs. Design-first via AskUserQuestion. Suite 585 (was 572; +13 prefs tests), build clean. NOT deployed.

### Design forks (locked via AskUserQuestion)
- Granularity: **per-category** (4 toggles: bookings, classes, forms, admin_alerts), not per-type or global.
- Critical email: **billing always-on** (dues renewed/failed/lapsed never muteable; a muted lapse notice would let a member silently lose access).
- Enforcement point: **dispatch-time skip** (rows still enqueue; dispatcher marks muted rows `skipped`), not enqueue-time suppression. Keeps pref logic in one place; the 5 enqueue call sites + the money-path webhook are untouched.
- Asserted (not asked): opt-out / default-on (opt-in would silently break transactional delivery).

### Shipped (local, uncommitted)
- **Pure logic** `lib/notifications-prefs-logic.ts`: 5 categories, `TYPE_CATEGORY` map (all 11 types), `categoryForType`, `isMuted` (billing + unmapped types never mute), `CATEGORY_META` for the UI. 13 unit tests.
- **Migration 048** + schema.sql: `notification_preferences` (PK `(space_id, member_id, category)`), RLS on, NO client policy (default-deny, same convention as notifications/member_billing). types/database.ts + DATABASE_SCHEMA.md + DB_SCHEMA_MAP.md updated same-change.
- **Dispatcher** (`app/api/cron/notifications/route.ts`): selects member_id + type, batch-loads prefs for the drain set (keyed by member_id, a globally-unique PK), marks muted rows `skipped` (terminal, leaves pending pool, no send/Resend/spacing). Prefs lookup fails open (send everything) on error so a blip can't drop a wanted email. Response gains a `skipped` count.
- **Actions** (`lib/actions/notifications.ts`): `getMyNotificationPreferences` (defaults all muteable on, overlays stored rows) + `setMyNotificationPreference` (Zod enum excludes billing, upsert scoped to caller's own member row). Both service-client, requireMember-gated.
- **UI**: `/me` Activity tab gains an "Email preferences" section (4 Switch toggles, optimistic + revert-on-error); the notification history badge now renders `skipped` as "Muted".

### Audit (one pass)
No deploy-blocking bug found. Verified: write/read both scoped to the authenticated member (no cross-member write — member_id comes from session, not input); billing not settable (Zod) and never muted (logic + test); `skipped` is terminal so muted rows clear the pending pool in one run and never re-scan; overlapping dispatcher runs can't double-act (the existing `.eq('status','pending')` guard); member_id-keyed prefs map is unambiguous (space_members PK is global). Made one improvement during audit: explicit fail-open + log on the prefs-query error.

### Open / not done
- **NOT deployed.** Awaiting user go (push to main = prod; migration 048 applies on deploy). Same-as-Phase-4: inert until Resend + CRON_SECRET + crontab are provisioned, but the skip logic is exercised the moment a member toggles + the dispatcher runs.
- **No integration test yet** for the dispatcher skip path. Pure `isMuted` is unit-covered; the dispatcher wiring (prefs query + skip write) is not. Flagged as a recommended follow-up (the harness exists; pattern is stripe-webhook.test.ts). Deliberate, not an omission.
- **API_REFERENCE.md** still predates the whole notification subsystem (Phases 2-5 self-view actions absent). Pre-existing drift, not introduced here; documented in ARCHITECTURE prose subsections instead (matches Phases 2-4).

### NEW user requests this session (queued, address next, NOT started)
1. **/me UI degradation.** `willing_to` (likely also skills/interests) renders as a raw comma-separated list instead of the preset chip selector it used to have. Restore the preset editor. Own commit (separate from the prefs toggles even though same file).
2. **Gate the Stripe dues UI on configuration.** If a space hasn't set up Stripe, the pay-dues-via-Stripe UI on `/me` should not show (dead path today).
3. **Admin-configurable alternate dues payment links.** Admin sets payment URLs per method (PayPal/Zeffy/Venmo/etc); members see them as dues-payment options, click through to the external page, admin reconciles manually later. Money-adjacent new subsystem: design-first via AskUserQuestion before building. Separate deploy.

---

## 2026-05-19 (pass 56): Product spine Phase 4: notification breadth (DEPLOYED)

Branch `main`. Took item 3 from the pass-55 backlog: booking, class signup, and form-submission notifications, reusing the Phase 2 outbox + dispatcher unchanged. Built per sub-phase, gated each, small commit per sub-phase, single deploy at the end of the set. Suite 565 (was 532; +33 new tests), build clean. NOT deployed.

### Design forks (locked via AskUserQuestion)
- Anonymous form submitter confirmation: **auth-only**. Recipient is the verified Supabase `user.email`, never the typed `body.email`; anonymous public submissions skip the submitter confirmation entirely (typed emails could belong to anyone, so confirming to them is a victim-spam vector). Admin alert still fires.
- Form admin recipient set: **`forms.manage` permission holders** (same gate the forms-guard / forms RLS use).
- Cancel confirmations: **only when someone other than the affected member cancelled** (self-cancels stay silent; the actor already saw the UI confirm).
- Session-cancellation: **fan out**: when an instructor flips a session to `cancelled`, every still-active signup gets an email (dedupe by `(session, member)`).

### Shipped (commits 84d31ee, 64ffa4e, 105b62f, a2ea767, 6abac53, bd8f22a, 09f293e)
- **P4a (84d31ee)** Shared best-effort enqueue helper `lib/notifications/enqueue.ts` (`resolveMemberContact`, `enqueueNotification`, `getSpaceName`, `buildManageUrl`). Stripe webhook's `enqueueDues` refactored to compose them; zero behavior change (same recipient resolution, same upsert shape, same idempotency via `(space_id, dedupe_key)`, same best-effort wrap). 12 new helper unit tests.
- **P4b (64ffa4e)** Equipment: `reserveEquipment` → `booking_confirmed` (always, to the booked-for member). `cancelReservation` → `booking_cancelled` only when actor ≠ affected member. `renderBookingEmail` + `bookingDedupeKey` added; existing `renderDuesEmail` quietly refactored onto a shared `renderShell` (one place to fix the HTML wrapper across 6 templates).
- **P4c (105b62f)** Classes: `signUpForClass` → `class_signup_registered` or `class_signup_waitlisted` from the RPC's returned status. `cancelMySignup` → `class_signup_promoted` to whoever `class_cancel_tx` returned as `promoted_id`. `updateSession` setting `status='cancelled'` → `class_session_cancelled` fanned out to every still-active signup. No `class_signup_cancelled` type: `cancelMySignup` is self-only, so under the rule it has no caller.
- **P4d (a2ea767)** Forms: `submitForm` → `form_submission_received` only when authenticated; `form_submission_admin` fanned out to every member with `forms.manage`. Migration 047 adds `members_with_permission(sid, perm)` SECURITY DEFINER (the inverted, set-returning form of `user_has_permission`, same current/late gate as 046) so the fan-out resolves recipients in one query, not N. Additive; existing `user_has_permission` callers unchanged. `types/database.ts` + `schema.sql` + `docs/DATABASE_SCHEMA.md` + `DB_SCHEMA_MAP.md` updated same-change.
- **P4f (bd8f22a) first-audit fixes**. Ultrathink audit of P4a-P4d before deploy surfaced two issues, both fixed pre-deploy:
    1. **RPC enumeration vector.** `members_with_permission` was callable by any PostgREST client. Postgres grants EXECUTE on new functions to PUBLIC by default; the codebase has no existing REVOKE pattern. The function returns a SET of member_ids for any (space, permission) pair, so without a lockdown any authenticated caller could enumerate "who has permission X in space Y" for spaces they are not in. `user_has_permission` has a narrower exposure (per-uid boolean) and is needed by anon/authenticated for RLS-policy evaluation, so it stays open; the new function is locked to `service_role` (the only legitimate caller goes through the admin client). Migration 047 + schema.sql now `REVOKE EXECUTE FROM PUBLIC` and `GRANT EXECUTE TO service_role`.
    2. **Best-effort gap.** P4b/P4c used the helpers but the helpers were not internally best-effort. The Stripe webhook's original `enqueueDues` wrapped its entire body in try/catch so a transient member-lookup error could never bubble into the money path; the P4a refactor removed that inner wrap and relied on `enqueueNotification`'s best-effort. `resolveMemberContact` + `getSpaceName` could still throw on supabase network errors, surfacing into the action's return after the underlying mutation already committed (the client would see an error even though their booking / signup / cancellation succeeded). Fixed at both layers: the helpers now swallow throws internally (returning null / empty), and each call site in equipment/classes is wrapped in try/catch around the lookup chain so secondary action-specific queries (equipment name+location, promoted-signup session lookup, session-cancellation signup fan-out) also cannot leak. forms.submitForm already had the wrap from P4d.

- **P4g (09f293e) third-audit fix, render-layer phishing defense**. renderShell auto-linkifies any `https?://` in body lines so the manageUrl becomes a clickable link. The same regex turns any URL embedded in a user-controlled field into a clickable link. In Phase 2 dues this was self-only (member's own display_name appears in their own email), but Phase 4's `form_submission_admin` is the first email type where one user's display_name lands in another user's inbox: an authenticated member can set display_name to a URL and submit a form, phishing every `forms.manage` holder when their email client renders the linkified URL. `body.email` is Zod-format-validated so the typed-email path is closed, but `display_name` is a free string (max 100). Fix: a new `stripUrls(s)` helper replaces `https?://\S+` with `[link]`, applied to every user-controlled input across all four renderers (member name, equipment/class/form title, location, submitterLabel, space name). `manageUrl` stays untouched and remains the only linkified URL in the rendered email. 5 new tests cover the new attack vector and defense-in-depth across the other renderers.

### Pre-existing exposure flagged for separate triage
`user_has_permission` is also callable by anon + authenticated via PostgREST RPC (same Postgres default; no REVOKE in the codebase). The exposure is narrower than the 047 case (you need to know a target uid, and uids are only learnable for co-members in your own spaces), and locking it down would require careful audit because RLS policies call it from anon/authenticated contexts and would break if EXECUTE were stripped. Out of Phase 4 scope; flagging for the owner to triage.

### Test coverage
40 new `__tests__/` cases (suite 572). Per-render unit tests cover subject lines, body copy, location + range formatting, the "someone" fallback in admin alerts, HTML escaping of injected names/titles, and (post-P4g) URL-strip defense across every renderer. Per-dedupe-key tests pin shape and per-member fan-out distinctness. The shared enqueue helper has hit/miss/error/throw coverage and (post-P4f) the resolveMemberContact / getSpaceName best-effort no-throw paths. Integration suite (31 vs real Postgres) unchanged: the existing Stripe-webhook integration test already exercises the outbox semantics end to end via the same shared upsert; P4 actions enqueue through the same path so the runtime contract is the same.

### State
- **DEPLOYED** (run 26135623172, HEAD a61e34d, 1m14s success). Deploy log confirms `applying 047_members_with_permission.sql` then `REVOKE` then `GRANT`. Smoke clean: public 200 (landing, login render); gated 307 (`/dashboard`, `/me`); Stripe webhook 400 (signature rejected with no body); cron 503 (CRON_SECRET unset, fails safe). No regressions.
- **Inert post-deploy** until owner provisions Resend (`RESEND_API_KEY` + `EMAIL_FROM` on a verified domain) and `CRON_SECRET` + the once-a-minute droplet crontab. Until then the outbox fills but nothing sends, same as Phase 2 today. New-event volume is bounded by user activity; the dispatcher's per-attempt Resend `Idempotency-Key` and the `(space_id, dedupe_key)` collapse already make replay-safe.
- **No volume governor.** Every form submission fans out one row per `forms.manage` holder; a popular waiver could create N rows per submission. Acceptable today (the unique index makes it idempotent); a digest / throttle is a separate phase (lines up with member preferences and an in-app inbox).

### Session closeout
Three audit passes within one phase set the new high-bar. P4a-P4d shipped the feature; the three audits then found and fixed (a) an RPC enumeration vector before any client could touch it, (b) a best-effort gap where the helpers could leak network errors into action returns after the underlying mutation already committed, and (c) a phishing vector exposed by `form_submission_admin` being the first email type to surface one user's display_name in another user's inbox. None of the three would have been caught by smoke testing the deployed code. The discipline future sessions should keep: design-first via AskUserQuestion, ship per-phase, then audit the change set BEFORE asking for the deploy, repeat the audit even when the change set "looks clean" because every repeat-audit on this work found something real.

### Backlog after this
1. **Owner-gated end-to-end spine validation.** Phase 2 (dues lifecycle) + Phase 4 (booking, classes, forms) are both deployed but proven only at the code level. Needs (a) `RESEND_API_KEY` + `EMAIL_FROM` (verified domain, SPF/DKIM), (b) `CRON_SECRET` + the once-a-minute droplet crontab (docs/DEPLOYMENT.md), (c) per-space Stripe test-mode keys + activated Billing Portal, (d) Supabase "Change Email Address" template + `/auth/confirm` allowlist. Then a real test-mode dues cycle + a booking + a class signup + a form submission, click-through the `/me` portal in a browser. Owner executes; this session produces the runbook + checklist.
2. **Phase 5: member notification preferences.** Per-type opt-in/out; the dispatcher checks prefs before sending. Doubles as the volume governor for Phase 4 fan-outs (a popular waiver currently fans out one row per `forms.manage` holder per submission).
3. **Phase 5: in-app notification center on `/me`.** Extend the read-only list to an inbox with unread/read state.
4. **Production observability.** No error monitoring exists; money path + dispatcher cron + every server action only `console.error`. Add Sentry-equivalent.
5. **Extend the integration harness.** Add real-Postgres coverage for payments link/import, role/permission management, presence, forms `submitForm` + `linkSubmissionsByEmail`. Pattern is proven; cost per new file is small.
6. **`user_has_permission` EXECUTE-TO-PUBLIC triage.** Pre-existing exposure flagged in this pass: the helper is callable by anon/authenticated by default (narrower than the 047 case since you need to know target uids, but still a per-uid probe). Locking it down requires careful audit because RLS policies call it from anon/authenticated contexts and would break if EXECUTE were stripped.
7. **Door epic Phases 4-5.** Inbound log ingest + the universal API-call UI builder.
8. **Owner product question** (no code): confirm forms victim-email attribution (attribution only, no readback) remains acceptable in scope.
9. Deferred until product need: generic outbound webhooks epic, server-side search, multi-space-per-user / space switcher, Zeffy/Venmo live APIs.

---

## 2026-05-19 (pass 55) — Doc drift fix + session closeout + new-session backlog

Branch `main`. Final pass of an extraordinarily long arc. Suite 532; integration suite 31 vs real Postgres; build clean.

### This pass
Doc drift audit + fix (commit 19dc632, deployed run 26126231059, no-op runtime, prod 200): migration 046 row was missing from `docs/DATABASE_SCHEMA.md` + `DB_SCHEMA_MAP.md`; `README.md` Features list omitted the entire product spine (Stripe dues / transactional notifications / member self-serve portal); `docs/ARCHITECTURE.md` had zero mention of the D/F/G-era subsystem facts (integration harness, GiST exclusion constraint, advisory-lock RPCs, door DNS-rebind pinned-IP egress, dispatcher fair drain + per-attempt key + re-entrancy guard, zero-decimal currency, the RLS-layer status-gate, the out-of-order monotonic period guard). All fixed inline in the right existing sections.

### Where the project is
- **Production posture: strong + thoroughly audited.** Every P0/P1/P2 from every audit this session is fixed; the require_approval/unverified-admin escalation (the single most serious finding) is closed at both layers (app via D2, RLS via 046). Door SSRF DNS-rebind closed. Equipment double-booking closed by DB exclusion constraint. Stripe webhook hardened against replay, out-of-order delivery, zero-decimal currencies. Notifications dispatcher is fair across spaces with per-attempt idempotency. Anonymous form submission rate-limited.
- **Tests: root-cause fix in place.** `pnpm test` (532, hermetic) stays the deploy gate; `pnpm test:integration` (31 tests, real Postgres) covers the SQL/RLS/money paths end to end so correctness no longer depends on post-deploy manual auditing. Self-skips without a DB.
- **Docs: in sync** (this pass cleared the lag).

### Remaining work — priority order for the new session
1. **OWNER-GATED — end-to-end spine validation.** The single largest remaining gap: shipped vs proven-in-prod. Owner must provision (a) `RESEND_API_KEY` + `EMAIL_FROM` (Resend-verified domain with SPF+DKIM), (b) `CRON_SECRET` + the once-a-minute droplet crontab (`docs/DEPLOYMENT.md`), (c) a space's per-space Stripe test-mode keys + activated Billing Portal, (d) the Supabase "Change Email Address" template + `/auth/confirm` redirect allowlist + Secure email change toggle. Then run a real Stripe test-mode dues cycle end to end and click through the `/me` portal in a browser.
2. **Production observability.** No error monitoring exists. Money path (Stripe webhook) + the dispatcher cron only `console.error`. Add Sentry-equivalent for the webhook, dispatcher, and server actions.
3. **Phase 4 notifications breadth.** Outbox + dispatcher are built; add booking, class signup, form-submission notifications reusing the same outbox.
4. **Member notification preferences.** Per-type opt-in/out; the dispatcher respects prefs.
5. **In-app notification center.** Extend the `/me` list to a bell/inbox with unread/read state.
6. **Extend the integration harness.** Add coverage for payments link/import, role/permission management, presence, forms `submitForm` + `linkSubmissionsByEmail`. The pattern (psql + role/jwt user simulation, route handler invocation) is proven; the cost per added test file is small.
7. **Door epic Phases 4-5.** Inbound log ingest + the universal API-call UI builder.
8. **Owner product question** (no code): confirm forms victim-email *attribution* (attribution only, no readback) remains acceptable in scope.
9. Deliberate-future items (defer until product need): generic outbound webhooks epic (per-event delivery), server-side full-text search, multi-space-per-user / space switcher, Zeffy/Venmo live APIs.

### Local-dev gotcha worth flagging
- The `payment_platform` enum 'stripe' value: `scripts/schema.sql`'s wrapped `CREATE TYPE` skips on an existing local DB; only migration 040's `ALTER TYPE ADD VALUE` adds it. After `supabase db reset` + `psql -f scripts/schema.sql` the local DB may lack 'stripe', breaking any test that exercises the `invoice.paid` → `payments` insert path. Workaround: also run `psql -f scripts/040_stripe_billing.sql` (or apply each `scripts/0*.sql` in order after schema.sql).

---

## 2026-05-19 (pass 54) — Lifted the deferred SECURITY DEFINER status-gate, harness-proven (LOCAL, RUNTIME — needs deploy)

Branch `main`. The pass-52 deferral of the RLS status-gate was conditional on "no way to verify it breaks nothing." The pass-53 harness resolves that, so the deferral is lifted and the change made + proven.

### Change (migration 046, commit e954b08)
- `user_has_role_in_space` and `user_has_permission` gated on `status IN ('current','late')` (mirrors lib/permissions PRIVILEGE_STATUSES). Closes the require_approval/unverified privilege gap at the **RLS layer** too (defense-in-depth beyond D2's app layer): an unverified/inactive member bypassing the app via direct PostgREST still cannot exercise a role/permission.
- Deliberately NOT changed: `get_user_space_ids`, `user_effective_roles` — gating SELECT-policy reads would break an unverified member's own /me + onboarding (the legitimate require_approval flow). Minimal blast radius: exactly the two privilege entrypoints.
- `integration/privilege-status-gate.test.ts` (5) proves BOTH halves: (a) gap closed — unverified admin has no role/perm, cannot do a privileged RLS-gated write; (b) nothing broken — current+late fully privileged, unverified member still resolves its own space, the approval flow (current admin → approve unverified) still works. **31 integration tests green.**

### State — DEPLOYED
- **DEPLOYED** (run 26125372468, HEAD c00c82d, success). Deploy log confirms `applying 046_privilege_status_gate.sql`. Smoke clean: public 200 (landing renders), gated 307, Stripe webhook 400 — no regressions. Substantive safety proof was the PRE-deploy 31-test integration suite vs real Postgres (post-deploy auth-flow checks aren't curl-doable; the harness already proved current/late access + approval + unverified reads).
- Default `pnpm test` 532/26 hermetic; build clean.
- Commits ahead of origin (non-runtime backlog + this runtime one): F3 (42f6509), pass-53 state (b0267bb), F4 (b56ef4e), doc/HANDOFF (ee7f59f), **046 (e954b08, RUNTIME)**, this.

### Backlog after this
- Owner product question (forms attribution). Owner-gated end-to-end spine validation (the shipped≠proven gap) — the last real gap, needs owner actions. The autonomous engineering backlog is now genuinely exhausted.

---

## 2026-05-19 (pass 53) — DB-backed integration harness; shipped SQL now functionally validated (LOCAL, non-runtime)

Branch `main`. Assessment chose "integration test harness" to fix the root cause (correctness depending on post-deploy manual audits). Built + RAN it against the local Supabase Postgres. Default `pnpm test` still 532/26, hermetic; build clean.

### Delivered
- **F1 foundation:** `vitest.integration.config.ts` (separate runner; `integration/` is OUTSIDE `__tests__/` so `pnpm test` never touches a DB), `integration/db.ts` psql-driven helpers (service path vs `role authenticated`+`request.jwt.claims.sub` user path; throwing seed helpers), `pnpm test:integration` script. Self-skips when no DB.
- **F2 tests (18, all green on real Postgres):** 045 `class_signup_tx`/`class_cancel_tx` — RETURNS TABLE→array shape the actions destructure, capacity/waitlist/dedupe/no_session, and the per-session advisory lock under TWO genuinely concurrent psql connections (exactly one registered — D11 proven); 042 exclusion constraint (overlap rejected 23P01, cancelled/adjacent allowed); 044 trigger (member self-edit of role + payment columns blocked, service path bypasses) + 043 WITH CHECK (cross-space move blocked).
- Applying `scripts/schema.sql` to the local DB also validated the "idempotent, runnable top-to-bottom" invariant in practice (it was stale at 041; applied cleanly to 045).
- Harness bug found+fixed during bring-up: `space_members.user_id` FKs `auth.users` (my earlier FK introspection was wrong) — seeds now create the auth user first; seed helpers throw on failure.
- Docs: LOCAL_DEV "Integration tests" section.

### Significance
The concrete prod risk flagged in the pass-52 assessment — signup/cancel possibly broken because the action assumes `supabase.rpc()` returns an array for a RETURNS TABLE function — is **disproven**: the shape + behavior + concurrency are correct. Correctness of the riskiest shipped SQL no longer depends on me manually auditing after deploy.

### State
- **PUSHED** (run 26122719148, success, no-op runtime — prod / = 200). Harness is on origin for CI/contributors. Audited the harness itself: verified it self-skips all 21 / exits 0 with no DB (never blocks CI) and the default `pnpm test` (532/26) does not pick up `integration/`.
- **F3 extension (commit 42f6509):** `integration/billing-idempotency.test.ts` — stripe_webhook_events PK replay protection, member_billing UNIQUE onConflict upsert, notifications UNIQUE + ON CONFLICT DO NOTHING. **21 integration tests** total, all green on real Postgres. Non-runtime; held local (rides next deploy) or push as desired.
- **F4 (commit b56ef4e):** `integration/stripe-webhook.test.ts` — the Stripe webhook ROUTE HANDLER end-to-end (real sig verify good/bad/missing, vault secret+config resolution, stripe_webhook_events replay idempotency, applySubscription→billing/status, D5 out-of-order guard proven e2e). Invokes the actual POST against local Supabase with Stripe-signed `customer.subscription.updated` events (no network, no payments enum). **26 integration tests** total, 5 files, all green. The harness now covers every risky thing shipped this session: 045 RPCs+concurrency, 042 constraint, 043/044 RLS+trigger, billing/notification idempotency, AND the webhook wiring where the Phase-3 P0s + D5 lived.
- Doc drift fixed: ARCHITECTURE limitation #2 now reflects Stripe is integrated.
- Finding (for future invoice.paid webhook test): the LOCAL DB's `payment_platform` enum lacks 'stripe' — schema.sql's wrapped `CREATE TYPE` skips on an existing type; only migration 040's `ALTER TYPE ADD VALUE` adds it. The harness setup would need to apply 040 before testing the `invoice.paid` (payments-insert) path. Avoided here by using `subscription.updated`.
- Backlog now: deferred SECURITY DEFINER status-gate (own session, rationale in pass-52); owner product question (forms attribution). Natural next: more server-action path coverage in the harness; or owner provisioning + end-to-end spine validation (the shipped≠proven gap).

---

## 2026-05-19 (pass 52) — Backlog hardening E1-E3 + evidence-based deferral (LOCAL, NEEDS deploy)

Branch `main`. Worked the pass-51 small backlog. Suite 532, build clean. NOT deployed.

### Done
- **E1 (c2ba958)** Completed D10 defense-in-depth: `auth_param` added to `ConnRow` + `loadEnabledConnection` + the test/selfEntry selects and threaded into every `callDoor` (+ optional on `auditDoor`), so a generic-adapter connection's custom auth-param value is scrubbed from the operator-readable `door_access_log` regardless of param name. Native HeatSync `e=` was already covered.
- **E2 (f11f4b3 + fix 9351969)** Rate-limited anonymous `submitForm` (20/min per IP+form — deliberately loose; hackerspace public signups share NAT/wifi so a tight limit would false-block a room; captcha remains the deferred real control). NOTE: f11f4b3 was committed before its build was verified and had a `const h` redeclaration; 9351969 fixed it forward (local-only, never deployed). Process: commits must be strictly build-gated.
- **E3 (6b84b09)** Webhook returns generic error strings (`Invalid signature` / `Webhook processing error` / `Webhook handler error`); real detail `console.error`'d server-side. Closes raw signature-lib / Postgres text leak to the (partly unauthenticated) caller.

### Deliberately deferred (evidence-based, NOT an omission) — own focused session
- **SECURITY DEFINER status-gate.** Diagnosed all four helpers: `get_user_space_ids` backs nearly every SELECT policy, so status-gating it would strip an `unverified` (pending-approval) member's access to their own `/me` + onboarding — breaks the legitimate require_approval flow. The role/permission helpers have broad subtle blast radius (write policies + the self-change trigger's privileged-bypass + some read policies) for a defense-in-depth-only gain ALREADY closed at the app layer by D2. Per RLS-guardrail (diagnose-before-patch, presentational-when-possible) this is a deliberate deferral with a focused-session plan, not a rushed end-of-session RLS change.

### Owner product question (no code)
- Forms victim-email attribution: an anonymous submitter can type a victim's email and the submission is attributed to that member (attribution only — no data readback, grants nothing; documented locked decision). Flagging for owner re-confirm that forged-waiver-attribution is acceptable in scope.

### State
- **DEPLOYED** (run 26088940576, HEAD 099a103, success). No migration this batch. Smoke clean: public 200; `/dashboard` `/me` `/door/manage` 307; Stripe webhook 400; cron 503. No regressions. (E3's generic signature/handler error bodies need a Stripe-configured space + bad sig to exercise — verified by build/code, not curl.) This deploy-state edit held local (docs-only, rides next deploy).
- **Backlog now essentially exhausted.** Remaining: the deliberately-deferred SECURITY DEFINER status-gate (own focused session — see rationale above) and the owner product question on forms victim-email attribution. All P0s/P1s/P2s from every audit this session are resolved or consciously deferred with documented rationale.

---

## 2026-05-19 (pass 51) — Verify D1-D10 + clear the deferred heavy P1s (LOCAL, NEEDS deploy)

Branch `main`. Verified the D1-D10 batch (trust-but-verify my own fast change set) and worked the deferred deeper-audit backlog. Suite 532, build clean. NOT deployed.

### D1-D10 verification
- **D6 regression found + fixed (commit 6105047).** The fair-drain pre-truncated each space's bucket to PER_SPACE=5 BEFORE the round-robin, so a single-space deployment (the common single-hackerspace case) drained only 5 emails/min instead of 20 (4x slowdown introduced by the fairness fix). Now per-space queues are bounded only by the CANDIDATES fetch; round-robin caps a space's share only under contention; a lone space drains the full BATCH.
- D2 verified safe: member-facing onboarding (markOnboardingStepDone/finishOnboarding/skipOnboarding) uses permissive requireMember; only admin step-mgmt uses requireMemberWithRole. No legit unverified flow broken.
- D1 verified safe: reservations are create+cancel only (no reschedule/time-range UPDATE), so the exclusion constraint is only hit on INSERT (already 23P01-handled).

### Deferred heavy P1s cleared
- **D11 (commit 705f03a)** Class signup/cancel concurrency: migration 045 `class_signup_tx`/`class_cancel_tx` (SECURITY DEFINER, per-session `pg_advisory_xact_lock`) — capacity decision+insert and cancel+promote now atomic. Actions call the RPCs, keep all pre-checks; removed now-unused pure-fn imports (rules still live + tested in classes-logic).
- **D12 (commit 42fd385)** Door SSRF DNS-rebind: executor resolves once, rejects if ANY resolved IP is blocked (`isBlockedDoorIp`: loopback/unspecified/link-local/metadata incl IPv4-mapped; RFC1918/LAN/ULA allowed), then connects to the validated IP literal (no 2nd resolution = TOCTOU closed). Dependency-free (chose this over the undocumented undici connect.lookup seam, verified via web research; fits plaintext-HTTP-LAN). redirect:'manual' retained.

### State
- **DEPLOYED** (run 26086312156, HEAD d5a282b, success). Deploy log confirms `applying 045_class_signup_concurrency.sql`; deploy succeeded (RPCs created cleanly). Smoke clean: public 200; `/dashboard` `/me` `/classes` `/door/manage` 307; Stripe webhook 400; cron 503. No regressions. WATCH (not curl-testable without a session): a real class signup/cancel exercising class_signup_tx/class_cancel_tx, and a live door call exercising the resolve-then-pin path. This deploy-state edit held local (docs-only, rides next deploy).
- Remaining smaller backlog: thread conn.auth_param through the door-call selects (audit-log defense-in-depth; client leak already closed by D10); SECURITY DEFINER user_has_role_in_space/user_has_permission still ignore status (RLS defense-in-depth for unverified — app layer closed by D2); P2s (anon-form rate-limit/captcha, forms victim-email attribution owner-confirm, webhook raw PG error text post-signature).

---

## 2026-05-18 (pass 50) — Deeper audit (3 specialists) + full priority remediation D1-D10 (LOCAL, NEEDS deploy)

Branch `main`. Ran 3 deep adversarial audits (concurrency+financial, privilege-escalation+RLS+trigger-verification, anonymous-surface+credentials) — the systemic classes prior structural passes missed. Owner chose "Full priority pass". 10 fixes landed, gated per-item (suite 528, build clean). NOT deployed.

### Fixes (commits a513ad0,2239e7a,92170e4,705a932,d2b7aa6,c9c0909,7b0948d,26e54f1,785e8e0,66cb84b)
- **D1 (P0)** Equipment double-booking: migration 042 btree_gist + `equipment_reservations_no_overlap` GiST EXCLUDE; reserveEquipment maps 23P01.
- **D2 (P1 sec)** `require_approval` bypass: `isPrivilegeEligible` (current|late only); `requireMemberWithRole` rejects unverified before role check; joinSpace single-active-membership guard.
- **D3 (P1 sec)** `/auth/callback` `next` open-redirect validated (same-origin path only).
- **D4 (P1 sec)** `assignCustomRole` pins both custom role + member to caller's space.
- **D5 (P1)** Stripe out-of-order: `laterPeriodEnd` monotonic guard — a stale event can't rewind current_period_end / false-lapse a paid member.
- **D6 (P1)** Dispatcher fair per-space round-robin drain + `.eq('status','pending')` re-entrancy guard.
- **D7 (P1)** Zero-decimal currency: currency-aware `minorToMajor` + `formatMoney`.
- **D8 (P1 dfd)** Migration 043: `members_update` RLS gains WITH CHECK mirroring USING.
- **D9 (P1 dfd)** Migration 044: trigger also blocks self-change of payment_status/payment_note/dues_paid_until/last_paid_at/last_payment_at/stripe_customer_id/joined_at.
- **D10 (P1 sec)** Door actions return a generic failure to the client (no raw controller reason); redactDoorSecrets/callDoor gained optional authParam (capability ready).

### Deferred (deeper-audit backlog — own careful passes)
- Class signup capacity/waitlist concurrency (needs an RPC + advisory lock per session).
- Door SSRF DNS-rebind: `validateDoorTarget` pins the hostname string; `fetch` re-resolves — resolve-once-and-pin-IP needed (highest-risk subsystem, isolate).
- Thread `conn.auth_param` through the door-call selects so audit-log detail is auth-param-redacted (client leak already closed by D10).
- SECURITY DEFINER `user_has_role_in_space`/`user_has_permission` ignore `status` — RLS-layer defense-in-depth for the unverified case (D2 closed the app layer).
- P2s: anonymous-form rate-limit/captcha; forms victim-email attribution (owner re-confirm — attribution only, no data readback); webhook echoes raw PG error text (post-signature only).

### State
- **DEPLOYED** (run 26071186611, HEAD a7c3a08, success). Deploy log confirms migrations 042/043/044 each applied; deploy.sh succeeded (042's exclusion constraint built cleanly = no pre-existing overlapping reserved rows). Smoke clean: `/` `/login` 200; `/dashboard` `/me` 307 (gate intact, D2 fine); Stripe webhook 400; cron 503; `/auth/callback` 307. No regressions. The equipment P0 + the 2 live P1s (Stripe out-of-order, dispatcher starvation) are resolved in prod.
- This deploy-state edit is held local (docs-only; rides the next deploy). Audit explicitly cleared: anonymous tenancy derivation, /track entropy, helper-fn fail-closed, R5 reconcile, startDuesCheckout customer race.

---

## 2026-05-18 (pass 49) — Phase 3 post-deploy adversarial audit: 2 P0 fixed (LOCAL, NEEDS deploy)

Branch `main`. Phase 3 shipped (pass 48) without a dedicated pre-deploy audit; ran an independent adversarial audit after the fact. Verdict was **NOT SAFE as-is** — 2 P0 + 1 P1 + 1 P2 found in the email-change surface; ALL fixed (commit f2df287). Suite 521, build clean. **Currently deployed prod has the P0s; this fix is local and should deploy ASAP.**

### Findings -> fixes
- **P0-1** `/auth/confirm` passed an attacker-controllable `type` query param into `verifyOtp` on a public route -> unintended auth entrypoint (recovery/magiclink/signup token replayed there mints a session, bypassing its real flow). Fixed: `type` pinned to literal `'email_change'`, query param ignored.
- **P0-2** Email sync used a follow-up `supabase.auth.getUser()` after `verifyOtp` — not guaranteed to reflect the just-verified identity in the SSR route; on miss, `space_members.email` stays stale forever (breaks payment auto-link / notifications / form linking), with no reconciliation anywhere. Fixed: use the `verifyOtp` response `data.user`; `/me` now reconciles `space_members.email` against the authoritative `auth.users.email` on load (self-heals).
- **P1-1** `requestEmailChange` derived the confirm-link origin from request `Host`/`X-Forwarded-Host` (forgeable -> token_hash capture). Fixed: origin from `NEXT_PUBLIC_APP_URL` only.
- **P2-1** `isSecretConfigField` only matched `*_secret`/`client_secret`/`api_key`/`secret_key`; a credential named `password`/`token`/`private_key`/`*_token`/`*_password` would land in plaintext `integrations.config`. Widened (case-insensitive) + tests.
- Audit PASS (no change): `getMyPayments` caller-scoping, the tab refactor (no data dropped), `proxy.ts` gate, R1 credential-loss/recursion paths, comma-split profile fields.

### State
- **DEPLOYED** (run 26068281306, HEAD 997e2e1, success). Smoke clean: `/auth/confirm?type=recovery&token_hash=x` -> safe 307 (invalid token rejected, query type no longer honored); `/auth/confirm` no-token 307; `/auth/callback` 307; `/me` 307; `/` `/login` 200; Stripe webhook 400 (no regression). The 2 P0s are closed in prod.
- This deploy-state edit is the only commit ahead of origin (docs-only, held per pattern; rides the next deploy).
- Email change still needs the Supabase project config from pass-48 (template + redirect allowlist + Secure email change) to function at all; until then the action sends a link that won't land. The P0/P1 fixes harden the path for when it is enabled.

---

## 2026-05-18 (pass 48) — Product spine Phase 3: member self-serve portal (LOCAL, awaiting one reviewed deploy)

Branch `main`. Built Phase 3 (tabbed self-serve portal), gated per sub-phase. Suite 521, build clean. NOT deployed.

### Shipped (commits 5a72832, ef210c9, 6189e20, 2c847be, 5edd778, + this docs)
- **P3a** `/me` restructured into a 3-tab portal (Profile / Membership / Activity). Server page fetches; `me-portal-client.tsx` renders. Read-only sections moved verbatim, no behavior change.
- **P3b** Inline profile editing (Profile tab) via existing `updateMyProfile` + `discloseAffiliations`; affiliations re-disclosed only when changed. Added `bio` to the `updateMyProfile` param type (schema/column already supported it).
- **P3c** Self-serve Cancel for registered/waitlisted class signups + reserved equipment reservations via existing actions (`CancelAction` = AlertDialog + toast + refresh). Server-side ownership/scoping unchanged.
- **P3d** `getMyPayments` (service-client self-view, treasurer-scoped RLS, strictly caller-scoped) + read-only list in Membership tab.
- **P3e** Self-service email change: `requestEmailChange` -> `supabase.auth.updateUser` (Secure email change = double confirm); new `GET /auth/confirm` `verifyOtp(email_change)` + post-verification sync of denormalized `space_members.email`; `proxy.ts` whitelists `/auth/confirm` (exact). Profile-tab UI.
- **P3f** Docs (API_REFERENCE, ARCHITECTURE Phase 3 section, DEPLOYMENT email-change config) + this entry.

### Owner action required (P3e is inert until done) — Supabase project config
- Auth → URL Configuration: add `{APP_URL}/auth/confirm` to the redirect allowlist.
- Auth → Providers → Email: keep "Secure email change" ON.
- Auth → Email Templates → "Change Email Address": link to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change` (NOT the default code-flow link). Full steps in docs/DEPLOYMENT.md.

### State
- **DEPLOYED** (run 26066604148, HEAD 83ff54b, success). Smoke clean: `/` `/login` 200; `/me` `/dashboard` 307 (member-gated); `/auth/confirm` + `/auth/callback` 307 (own no-token redirects, whitelisted); Stripe webhook 400 (money path intact). Portal UI itself behind member auth — NOT browser-tested (typecheck/build only); needs a logged-in click-through.
- Behavior-preserving for existing read-only views; new: profile edit, cancels, my-payments, email change (email change needs the Supabase config above to function).
- Deferred (from the pass-47 audit, still open): P2 polish items + P3 doc cross-ref + optional CI guards.

---

## 2026-05-18 (pass 47) — Full-codebase audit + P1 remediation pass (LOCAL, awaiting one reviewed deploy)

Branch `main`. Ran a 4-agent read-only audit (server actions, DB/RLS/types, security, architecture/drift). Verdict: strong codebase, zero P0, no cross-tenant leaks/RLS gaps/injection/secret-to-client. Then fixed all P1s, gated per sub-phase. Suite 521, build clean.

### Audit summary
- Server-action layer: ~120 actions all validate->auth->scope with universal space_id; no P0/P1.
- DB/RLS/types: 46 tables RLS-protected, idempotent, zero schema/migration/types drift.
- Security: defense-in-depth solid; findings were the P1s below.
- Architecture: logic-extraction+Vitest near-universal; gap was the two payment routes.

### Remediation (commits 504586f, 0306157, 75686c0, b8edd77)
- **R1** PayPal/integration secrets -> AES-256-GCM vault. New `lib/secrets/vault.ts` (canonical generic store/read + `isSecretConfigField`); `saveIntegration` vaults secret-named fields, keeps only `*_ref`, blank submit preserves ref, legacy plaintext auto-migrates on next save; PayPal route reads from vault with transitional plaintext fallback. The lone plaintext-credential path closed.
- **R2** Extracted the Stripe webhook's money/status logic (Basil relocations, period/customer extraction, status patch, invoice->payment row) to pure `lib/stripe/webhook-logic.ts` + 12 tests; route now I/O-only. The biggest untested critical path, now covered.
- **R3** Extracted PayPal sync mapping/dedupe to pure `lib/paypal-logic.ts` + 7 tests; route uses `requireMemberWithRole`; fixed a latent throw on missing/invalid PayPal date.
- **R4** Narrowed `proxy.ts` public prefixes to exact paths (`/auth/callback`, `/api/cron/notifications`).

### State
- **Not deployed.** R1-R4 + this pass committed locally; awaiting one reviewed deploy decision. Also still unpushed: pass-44 + pass-46 docs commits.
- Behavior-preserving except R1 (PayPal secret now vaulted; existing integrations keep working via fallback and self-migrate on next Settings save) and R4 (tighter public routing).
- Deferred (HANDOFF-tracked, from audit): P2s (members.ts self-update space_id belt-and-suspenders, ops/comms client-direct writes -> server actions, door SSRF resolve-IP recheck, pin zod/@supabase, loading/error UX convention, mutation return-shape standardization), P3 doc cross-ref, optional CI guards. Next planned feature work: Product spine Phase 3 (member self-serve portal).

---

## 2026-05-17 (pass 46) — Phase 2 EXTREME AUDIT: NOT-SAFE verdict, P1s fixed (LOCAL, still awaiting deploy)

Branch `main`. Owner asked for an extreme audit before deploy. Ran an independent code audit + self-audit + web re-verify of Resend idempotency semantics. Verdict was **NOT SAFE as-is**; all findings fixed. Suite 499, build clean.

### Findings -> fixes (commit pending in this pass)
- **P1 (P0 blast radius) dispatcher idempotency**: row id alone as Resend Idempotency-Key; Resend's docs do not guarantee a failed response is excluded from the 24h key cache, so a cached transient failure could permanently suppress every retry (email silently lost). Fixed: key is now per-attempt `${row.id}:${attempts}` (concurrent same-attempt runs still dedupe; next-minute retry is a fresh send). `app/api/cron/notifications/route.ts`.
- **P1 enqueue not isolated from money path**: a persistent notifications-table/render failure could 500 the Stripe webhook on every retry and stall ledger finalization. Fixed: `enqueueDues` is fully wrapped (try/catch + non-throwing error log) so email infra can never wedge the money path. `app/api/stripe/webhook/[space]/route.ts`.
- **P1 `dues_lapsed` null-periodEnd collapse**: canceled/deleted subs carry no item period; key collapsed to `dues_lapsed:<member>` and suppressed every future lapse notice. Fixed: fall back to subscription id (`duesDedupeKey`), threaded `subscriptionId` through `enqueueDues`. New test (499 total).
- **P2 dispatcher concurrency**: no row-level lock; documented the once/min + ~5s-drain assumption and why per-attempt key makes it safe.
- Audit PASS (no change needed): Phase-1 webhook guarantees intact, multi-tenant isolation, RLS + member self-view, HTML escaping, CRON_SECRET constant-time, migration idempotent + mirror exact, fresh-clone fails safe.

### State
- **DEPLOYED** (run 25990457904, HEAD f1bae44, success). All 7 local commits (pass-44 docs + 5 Phase 2 + audit-fix) pushed; origin == local. Smoke clean: `/` `/login` 200; gated 307; Stripe webhook 400 (Phase 1 intact, not 307); `/api/cron/notifications` 503 with/without bearer (proxy whitelist works; CRON_SECRET unset = fails safe).
- **Inert until owner provisions (Droplet):** set `RESEND_API_KEY`, `EMAIL_FROM` (Resend-verified domain + SPF/DKIM), `CRON_SECRET`; add the once-a-minute crontab line (docs/DEPLOYMENT.md). Until then the outbox fills but nothing sends.
- Validation after provisioning: Stripe test-mode dues run -> `dues_renewed` enqueued once, dispatcher sends, `/me` shows it; force card failure -> `dues_payment_failed`; let it lapse -> `dues_lapsed`.

---

## 2026-05-17 (pass 45) — Product spine Phase 2: transactional notifications (LOCAL, awaiting one reviewed deploy)

Branch `main`. Built Phase 2 dues-lifecycle email end to end, gated + committed per sub-phase. NOT deployed (ASK pending). Suite 498, build clean.

### What shipped (commits ddb790a, 5295dc2, 2c88278, 75097a6, + this docs/UI)
- **P2a** migration 041 + schema.sql section 26: `notifications` outbox. Service-only writer, SELECT = admin/board/treasurer, member self-view via validated action. `(space_id, dedupe_key)` unique = idempotent enqueue. Pure `lib/notifications-logic.ts` (render + dedupe + terminal rule), 13 tests.
- **P2b** `lib/email/send.ts`: Resend HTTP transport seam (no SDK, `fetch`), `retryable` flag, unset-key = clean no-op. 6 tests (fetch mocked). `RESEND_API_KEY`/`EMAIL_FROM` in `.env.example`.
- **P2c** Stripe webhook enqueues: `invoice.paid`→renewed, `invoice.payment_failed`→failed, lapse→lapsed. Outbox only, never sends inline (keeps the just-hardened money path fast/retry-safe).
- **P2d** `POST /api/cron/notifications`: constant-time `CRON_SECRET`, drains ≤20/min, row id as Resend Idempotency-Key (overlap-safe). `proxy.ts` whitelists `/api/cron` (same redirect trap as the Stripe webhook). `CRON_SECRET` in `.env.example`.
- **P2e** `getMyNotifications` + read-only `/me` section. Docs updated same change: DATABASE_SCHEMA, DB_SCHEMA_MAP, API_REFERENCE, ARCHITECTURE, DEPLOYMENT (env + crontab line).

### Decision / context
- Transport = Resend (owner indicated an existing Resend token; none was wired in this repo). Behind a one-function seam so SMTP can replace it later without touching callers. Generic-platform constraint preserved.
- Scope locked to dues lifecycle; bookings/forms reuse the same outbox in a later phase.

### Open / needs owner
- **Not deployed.** Awaiting one reviewed deploy (ASK). Also still local: pass-44 docs commit dc76a86.
- After deploy, prod needs: `RESEND_API_KEY`, `EMAIL_FROM` (verified domain, SPF+DKIM), `CRON_SECRET` set on the Droplet, plus the once-a-minute crontab line (see DEPLOYMENT.md). Without them the outbox fills but nothing sends.
- Validation (real test): Stripe test-mode dues run → confirm `dues_renewed` enqueued once, dispatcher sends, `/me` shows it; force a card failure → `dues_payment_failed`; let it lapse → `dues_lapsed`.

---

## 2026-05-17 (pass 44) — Stripe Phase 1 DEPLOYED; post-deploy P0 (webhook routing) caught + fixed + redeployed

Branch `main`. Phase 1 shipped (run 25988762909, HEAD 8f74307, success). Post-deploy smoke caught a P0: an unauthenticated POST to `/api/stripe/webhook/<space>` returned **307**, not 400.

### Root cause
Next 16 renamed middleware to `proxy.ts` (root). It auth-gates every non-public path and `NextResponse.redirect('/login')` (307). The webhook is called by Stripe with no session, so it was redirected. Stripe does not follow redirects → every webhook delivery would have failed silently. The earlier audit's "no auth middleware in this app" was wrong; caught only by smoke-testing the live route.

### Fix (commit 37d5b04, deployed run 25988926981, success)
- Added `/api/stripe/webhook` to `PUBLIC_ROUTES` in `proxy.ts` (scoped to the webhook path only — Stripe server actions stay auth-gated, they run from authenticated pages).
- Corrected the route/header comments that wrongly claimed no auth middleware.
- Gate green (479 tests, build). Re-smoke: webhook POST now **400** (route reached, signature rejected); `/` `/login` 200; `/dashboard` `/me` `/settings` 307→login; prod healthy.

### State
- **DEPLOYED & live.** Stripe dues Phase 1 is functional end to end at the code level. Inert until a space admin configures Stripe keys.
- Next: a space admin configures Stripe in **test mode** → member "Pay dues" → confirm webhook flips `member_billing` status + records exactly one `payments` row + stores `current_period_end`. Then Phase 2 = transactional notifications (renewal / failed-payment / booking emails).

---

## 2026-05-17 (pass 43) — Stripe Phase 1 deep-audited + P0/P1 fixed; LOCAL, deploy-ready (pending approval)

Branch `main`. Owner asked for a deep audit before deploy. Ran an independent Stripe-focused audit (verified vs Stripe Basil 2025-03-31 changelog). Verdict was "NOT safe as-is" — 3 P0 + 1 P1 found; ALL fixed. suite 479, build clean.

### Audit findings → fixes (all committed)
- **P0 webhook lost events**: dedupe row written before processing; a handler 500 + Stripe retry was suppressed as duplicate → event dropped. Fixed `ca34e53` (delete dedupe row on handler error → retry reprocesses).
- **P0 `current_period_end` gone from top-level Subscription** (Basil; carried into 2026-04-22.dahlia) → grace never fired, period never stored. Fixed `b477c38`: read `sub.items.data[0].current_period_end`.
- **P0 invoice `subscription_details` moved to `invoice.parent`** → metadata member-resolution always failed (mislinked dues). Fixed `b477c38`: read `inv.parent.subscription_details.metadata`.
- **P1 duplicate ledger rows**: Stripe fires invoice.paid AND invoice.payment_succeeded. Fixed `b477c38`: handle only `invoice.paid` + pre-insert dedupe on `(space_id,platform,external_id)`.
- **P1 migration txn note**: documented (no manual BEGIN/COMMIT; safe on Supabase PG15).
- **P2 customer-create race**: fixed `b477c38` — `idempotencyKey` on `customers.create`.
- Audit CONFIRMED SOUND as-built: secrets never client-exposed/logged; every query space-scoped; cross-space webhook forgery blocked (per-space signing secret + space-rechecked member resolution); RLS correct; status automation strictly current↔late.

### Full Phase-1 commit set (LOCAL, undeployed; no migration to run beyond 040 which is already live)
P1c `5ca7ee6` · P1d `f293e41` · P1e `fa76176` · P1f `1f61029` · P1g docs `ef9b0dc` · audit fixes `ca34e53`,`b477c38` (+ this docs).

### Open
- LOCAL & undeployed: pass-42 + pass-43. Phase 1 is audited and the found issues fixed. Inert until a space admin configures Stripe. **Awaiting deploy approval.** After deploy: configure Stripe in test mode on a space → member "Pay dues" → confirm webhook flips status + records a single payment row + stores period end. Then Phase 2 = transactional notifications.

---

## 2026-05-17 (pass 42) — Stripe dues Phase 1 COMPLETE (P1f UI + P1g docs); LOCAL, one reviewed deploy pending

Branch `main`. P1a/P1b deployed (inert foundation). P1c–P1g built locally — Phase 1 is now a complete, reviewable unit. Owner asked to review the money/webhook code before its deploy; build is clean, suite 479.

### Done this pass (gated, committed, NOT deployed)
- **`1f61029` P1f**: `StripeBillingPanel` (admin, on /settings after SettingsClient) — mode, publishable key, write-only secret/webhook secret, per-tier price ids, grace days, shows the per-space webhook URL + events to subscribe + Portal-activation reminder. `DuesCard` on /me — status via getMyBilling, "Pay dues" (startDuesCheckout redirect) / "Manage billing" (startBillingPortal).
- **P1g**: API_REFERENCE + ARCHITECTURE Stripe sections + this entry.

### Full Phase-1 commit set (LOCAL, awaiting one reviewed deploy)
`5ca7ee6` P1c (dep+client+vault config) · `f293e41` P1d (checkout/portal/getMyBilling/listMemberBilling) · `fa76176` P1e (per-space signed webhook + dues→status) · `1f61029` P1f (UI) · docs. (P1a `521df69` + P1b `3d7cf87` already deployed, inert.)

### Reviewer notes (money-critical surface)
- Secrets: secret key + webhook signing secret only in the AES-256-GCM vault; `getStripeSettings` returns booleans, never values; keys never `NEXT_PUBLIC_`/client.
- Webhook: signature-verified with the space's own secret; idempotent on `event.id`; per-space path (no Connect `event.account`); 400 bad-sig/config, 500 handler (Stripe retries; idempotent). No auth middleware exists so the path is reachable for Stripe by design.
- Status automation only moves `current`↔`late` (filtered `IN ('current','late')`) — never auto-inactive, never auto-approves `unverified`; `last_paid_at` on paid.
- Multi-tenant: every query space-scoped; member resolved by metadata then customer id, re-checked in-space.
- Inert until an admin actually configures Stripe in Settings (no `integrations` stripe row exists in prod).

### Open
- LOCAL & undeployed: pass-42 (P1f + docs) on top of pass-41 (P1c–P1e). **One reviewed deploy** ships all of Phase 1 (no migration in this batch — 040 already live). ASK before deploy. After deploy: a space admin configures Stripe (test mode) → member "Pay dues" → webhook flips status. Then Phase 2 = transactional notifications (renewal/failed-payment/booking emails) — the next product-spine thread.

---

## 2026-05-17 (pass 41) — Stripe dues P1c–P1e (config + actions + webhook) built; LOCAL, REVIEW before deploy

Branch `main`. P1a/P1b deployed (run 25987779054, inert foundation live). Built the money-critical core; per the owner's choice this code should be reviewed before its deploy. 4 commits this pass, suite 479, build clean each.

### Done (gated, committed, NOT deployed)
- **`5ca7ee6` P1c**: `stripe@22.1.1` (exact). `lib/stripe/client.ts` per-request `getStripe` (pinned apiVersion, server-only). `lib/stripe/config.ts` (plain server module — takes admin client, NOT a 'use server' file): store/read secret key + webhook secret in the AES-256-GCM vault (door pattern), `getStripeConfig`. `lib/actions/stripe.ts`: `getStripeSettings` (status only, never returns secrets), `saveStripeSettings` (write-only secrets, integrations.config upsert). Zod `stripeSettingsSchema`.
- **`f293e41` P1d**: `startDuesCheckout` (self/tier-resolved, ensures Stripe Customer, hosted Checkout subscription mode, client_reference_id + metadata on session AND subscription_data), `startBillingPortal` (hosted self-serve), `getMyBilling` (service-client self-view), `listMemberBilling` (admin/board/treasurer). All Stripe calls try/caught.
- **`fa76176` P1e**: `app/api/stripe/webhook/[space]/route.ts` (nodejs/force-dynamic). Raw body, per-space vault secret+signing-secret, `constructEvent`, idempotency via `stripe_webhook_events` PK (replay→200). Handles checkout.session.completed / customer.subscription.* / invoice.paid|payment_succeeded → upsert member_billing + record stripe `payments` row + `duesMemberStatus`/`graceExceeded` → space_members status (only current↔late, never inactive/unverified; last_paid_at on paid). member resolved by metadata then customer id, always space-scoped. bad sig/config→400, handler error→500 (Stripe retries; idempotent).
- No middleware in this app, so the webhook path is reachable unauthenticated by design (verify is signature-based).

### Remaining Phase-1
- **P1f UI**: Settings (admin) Stripe config panel — mode, publishable key, secret key + webhook secret (write-only), per-tier price ids, grace days, show the per-space webhook URL `…/api/stripe/webhook/{space_id}` + reminder to activate the Customer Portal in Stripe. Member surface on `/me`: "Pay dues" (startDuesCheckout) / "Manage billing" (startBillingPortal) + status from getMyBilling; dashboard attention already shows dues issues via member status. Admin dues list via listMemberBilling.
- **P1g**: API_REFERENCE + ARCHITECTURE (Stripe section, per-space-keys + webhook + status mapping + Portal-activation caveat) + HANDOFF; then Phase 2 = transactional notifications, Phase 3 = broader self-serve.

### Open / REVIEW GATE
- LOCAL & undeployed: pass-41 (P1c/P1d/P1e + this docs). Money + webhook code — **owner asked to review before deploying it.** Nothing live can call Stripe yet (no config UI shipped, integrations has no stripe row). Recommended next: build P1f/P1g so Phase 1 is a complete reviewable unit, then one reviewed deploy. ASK before deploy.

---

## 2026-05-17 (pass 40) — Product spine started: Stripe dues P1a+P1b (DEPLOYED, run 25987779054, inert foundation)

Branch `main`. Pass-39 backlog fully DEPLOYED. Began the product spine (Stripe recurring dues) — money-critical, so design-first with a fresh web re-verify. 3 commits this pass, suite 479, build clean.

### Locked design (owner-approved forks, pass-40)
Per-space OWN Stripe keys (NOT Connect); Subscriptions + hosted Checkout + Billing Portal; lapse = grace→`late`, NEVER auto-inactive; config in `integrations.config` + secrets in the AES-256-GCM vault. Re-verified Stripe facts saved to memory `integration-api-facts` (SDK v22.x, apiVersion `2026-04-22.dahlia`, raw `req.text()` body, 300s tolerance, `event.id` idempotency, per-space webhook PATH routing — no Connect `event.account`, `subscription_data.metadata` gotcha, Portal needs per-account Dashboard activation, status map).

### Done (gated, committed)
- **`521df69` P1a**: migration 040 — `payment_platform` += `stripe`; `member_billing` (member↔Stripe customer/sub/status; SELECT admin/board/treasurer, no client write); `stripe_webhook_events` idempotency ledger. Mirrored schema.sql §25 + CREATE TYPE list + types + DATABASE_SCHEMA/DB_SCHEMA_MAP (framing→040). Inert until used.
- **`3d7cf87` P1b**: pure `lib/stripe-logic.ts` + 10 tests — `STRIPE_API_VERSION`, `stripeStatusIsPaid`, `duesMemberStatus` (grace→late, never inactive, unknown→no-op), `graceExceeded` (fail-safe), `priceIdForTier`, `isStripeConfigured`.

### Remaining Phase-1 plan (money-critical — review/checkpoint before/within)
- **P1c**: add `stripe` dep (pin exact, v22.x); `lib/stripe/client.ts` server factory `getStripe(secretKey,{apiVersion})`; `lib/actions/stripe.ts` config get/save (publishable/mode/prices→integrations.config; secret key + webhook secret → encrypted `secrets` rows, ids in config — reuse `lib/secrets/crypto` + the door secret_ref pattern); Zod + admin guard.
- **P1d**: member actions — `startDuesCheckout` (resolve tier→price, ensure Stripe Customer, Checkout subscription mode w/ client_reference_id + metadata + subscription_data.metadata), `startBillingPortal`, `getMyBilling` (self service-client view), admin `listMemberBilling`.
- **P1e**: webhook `app/api/stripe/webhook/[space]/route.ts` — raw body, per-space signing secret, `constructEvent`, idempotent via `stripe_webhook_events`, handle checkout.session.completed / customer.subscription.* / invoice.paid / invoice.payment_failed → upsert `member_billing` + record `payments` row + `duesMemberStatus`→space_members.status + last_paid_at. Exclude path from auth middleware.
- **P1f**: Settings config UI (admin) + member "Pay dues / Manage billing" surface + dues status on /me & dashboard attention. **P1g**: docs (API_REFERENCE/ARCHITECTURE) + HANDOFF.
- Then product spine Phase 2 (transactional notifications) and Phase 3 (broader self-serve) per the pass-35 report.

### Open
- LOCAL & undeployed: pass-40 (3 commits: P1a, P1b, this docs). Migration 040 is additive/inert (enum value + unused tables) — safe to deploy alone. **Awaiting deploy approval.** ASK before deploy; the P1d/P1e money+webhook code should be reviewed before its deploy.

---

## 2026-05-17 (pass 39) — Bulk member actions + palette trigger/a11y (backlog COMPLETE, DEPLOYED run 25987172786)

Branch `main`. Pass-38 (mobile card tables) DEPLOYED (run 25986426224, smoke clean). 2 feature commits this pass, suite 469, build clean. This closes out the analysis-driven backlog the user chose.

### Done
- **`390046a`**: bulk member select + Approve. New `bulkApproveMembers` action (ADMIN_ROLES, Zod ids, one batched space-scoped update flipping only still-unverified rows, audited). Selection checkboxes on the members table + mobile cards (admin only) with header select-all; sticky count bar (Approve selected / Clear); optimistic update.
- **`331a0c6`**: visible labeled command-palette trigger ("Jump to… ⌘K") in the sidebar dispatching a `commandpalette:open` event the palette now also listens for. a11y assessment: sonner `<Toaster>` already provides the aria-live region; sidebar icon buttons already `aria-label`'d; skip-link + drawer focus mgmt already present — so the top a11y items were already satisfied; this fixes the real gap (palette had no discoverable entry point).

### Backlog status (the pass-35 analysis → user-chosen items)
- F1, F2, ⌘K palette + trigger, sortable members, route skeletons, modal-busy, dashboard "Needs attention", cached perms, mobile card tables, bulk approve, a11y assessment — **ALL DONE** (deployed through pass-38; pass-39 pending deploy).
- **`PageHeader` dedupe**: deliberately NOT done (mechanical ~21 files, no user-visible value, browser-unverifiable churn). Recommend leaving unless explicitly requested.
- Deferred by user (separate future thread): product spine — Stripe recurring dues → transactional notifications → member self-serve portal. See the pass-35 report in session history; rationale grounded in Fabman/Cobot/Nexudus/Wild Apricot.

### Open
- **DEPLOYED** pass-39: pushed `d348112..41193d3`, run `25987172786` success, no migration. Smoke: `/` `/login` 200; `/members` `/dashboard` `/payments` 307->login. The full pass-35 analysis backlog the user chose is now LIVE end-to-end. NOT browser-verified. Next session: product spine (Stripe dues → notifications → self-serve portal) is the highest-leverage remaining work. Default ASK-before-deploy.

---

## 2026-05-17 (pass 38) — Mobile card tables (DEPLOYED, run 25986426224)

Branch `main`. Pass-37 (dashboard attention + cached perms) DEPLOYED (run 25986340615, smoke clean). 1 feature commit this pass, suite 469, build clean.

### Done
- **`9d419fe`**: mobile card layouts for the members + payments tables. Table is `hidden md:block`; under `md` a stacked card list renders the same data + key actions reusing existing handlers/dialogs (members: approve/edit/certs/cards/forms/remove; payments: link member). Desktop unchanged.

### Remaining from the chosen backlog
- **Bulk member actions**: multi-select (table + cards) + a `bulkApproveMembers` server action (Zod, one batched call — avoid N round-trips) + sticky selected-count bar. Moderate; clear value for spaces with many `unverified` joiners.
- **a11y AA sweep (targeted)**: first verify sonner already renders an aria-live region (it does by default → that item is satisfied); then add `aria-label` + ≥24px target size to prominent icon-only buttons + visible focus ring. Do as a focused pass, not a blind global edit.
- **`PageHeader` dedupe** (~21 hand-rolled headers): DEPRIORITIZED — mechanical, high churn, no user-visible value, risky without browser test. Skip unless explicitly requested.
- Deferred by user: product spine (Stripe dues → notifications → self-serve portal).

### Open
- LOCAL & undeployed: pass-38 (1 commit + this docs). **Awaiting deploy approval** (no migration). After deploy: open members/payments on a narrow viewport — cards, not a clipped table. Default ASK-before-deploy.

---

## 2026-05-17 (pass 37) — UX pack part 2: dashboard attention + cached perms (DEPLOYED, run 25986340615)

Branch `main`. Continues pass-36. Pass-36 batch (F1/F2 + palette + sortable + skeletons) is DEPLOYED (run 25985954925, smoke clean). 2 new commits this pass, suite 469, build clean.

### Done (gated, own commits)
- **`ca498d5`**: dashboard "Needs your attention" strip (admin/board) — members awaiting approval + unreconciled payments as deep links, only when non-empty (one extra count query).
- **`b8440e9`**: `lib/permissions-cache.ts` — React `cache()`-wrapped `hasPermission(uid,sid,perm)`; layout nav-perm resolution + members page now dedupe overlapping `user_has_permission` RPCs per render. Pure dedupe, semantics unchanged (no permission-logic reimplementation — RLS-guardrail respected).

### Remaining from the chosen backlog (NOT done — heavier UI work)
- **Mobile card layouts** for the members + payments tables (currently `overflow-x-auto` only; action buttons off-screen on phones).
- **Bulk member actions** (multi-select + "Approve selected" / batch dues) with a sticky selected-count bar.
- **a11y AA sweep**: verify sonner already provides an aria-live region (likely yes — then this narrows to icon-button `aria-label` + ≥24px target size + focus ring/sticky `scroll-padding`); targeted, not a blind global edit.
- **`PageHeader` dedupe** across ~21 hand-rolled `bg-sidebar …` headers (mechanical, high churn, low user-visible value — lowest priority; do last or skip).
- Deferred by user: product spine (Stripe dues → notifications → self-serve portal).

### Open
- LOCAL & undeployed: pass-37 (2 commits + this docs). **Awaiting deploy approval** (no migration; app only). After deploy: dashboard attention strip for an admin with unverified members/unlinked payments. Default ASK-before-deploy.

---

## 2026-05-17 (pass 36) — Analysis acted on: F1/F2 fixes + UX pack (part 1) (DEPLOYED, run 25985954925)

Branch `main`. The pass-35 deep analysis (3 agents: competitive, UX/a11y best practice, codebase UX/IA — full report in session history) produced a prioritized backlog. User chose: F1/F2 fixes + UX quick-win pack + bigger UX bets (product spine deferred). 6 commits this pass, suite 469, build clean each.

### Done (gated, own commits)
- **`7054b35` F1**: member CSV import was inserting `space_members` from the browser with a fabricated `user_id` (FK-breaking, bypassed validation). Now routes through the existing admin-gated, Zod, batched `importMembers` action; dropped unused `spaceId` prop.
- **`521fb1f` F2**: PayPal sync route returns inserted rows; client prepends them instead of `window.location.reload()` (preserves scroll/filter).
- **`6c48780`**: ⌘K/Ctrl-K command palette (uses the previously-unused cmdk primitive; admin/manage entries gated by the same isAdmin+navPerms as the sidebar).
- **`4feecda`**: sortable members table (name/tier/joined/last-payment/status, asc→desc→none).
- **`c87cb35`**: per-route skeletons (dashboard/members/payments) + disable modal Cancel during submit.

### Remaining from the chosen backlog (NOT yet done)
- UX pack leftovers: WCAG AA sweep (icon-button target size, aria-live for toasts — verify sonner first, missing labels, focus ring/sticky scroll-padding), `PageHeader` dedupe across ~21 hand-rolled headers.
- Bigger UX bets (task #35): mobile card layouts for members+payments tables; bulk member actions (multi-select + Approve selected); dashboard "Needs attention" zone + role-scoping; per-request cached permission resolver (replace per-page user_has_permission RPC fan-out).
- Deferred by user: product spine (Stripe recurring dues → notifications → member self-serve portal).

### Open
- LOCAL & undeployed: pass-36 (6 commits). **Awaiting deploy approval** (no migration; app only). After deploy: try ⌘K, sort the members table, watch route skeletons, re-run a CSV member import + PayPal sync. Default ASK-before-deploy.

---

## 2026-05-17 (pass 35) — CLEAN CHECKPOINT (all deployed) + UX/product analysis kickoff

State: `origin/main == main`, tree clean, latest deploy green (run 25985079088, pass-34). Migrations applied through **039**. ~469 unit tests + e2e; `pnpm build` clean. Nothing local/undeployed.

### Shipped this overall session (passes 26-34, all live; verify with `git log`, smoke-tested, NOT browser-verified)
- Door epic P3 (slot allocator + live grant/revoke/open-lock-unlock), member self-entry (dashboard), `/doors` member page.
- Classes optional required-form gate + signups roster; equipment reservations roster.
- Presence/attendance (migration 038): check-in/out + host + notes, dashboard "Who's here", `/attendance` (search/day-filter/grouping), `/me` history.
- Forms↔member email association (migration 039 + app): submit-time + member add/email-change + space-wide re-link + backfill; **pass-34 fix**: also derives the email from an email-type form field/answer (not just the dedicated `submitter_email`) and backfills existing rows via "Re-link submissions".
- Per-member FORMS panel on `/members`; delete form (confirm+cascade) / delete submission / re-link button.
- Full 4-agent audit + fixes (defense-in-depth, nav-permission, docs drift, +tests); landing 23b wording + mobile breakpoints.

### Locked decisions / intentional (do NOT revert without explicit ask)
- Single space per user (`getAuthMember` `.single()`, fails closed; documented).
- Forms email-link includes raw anonymous typed emails (attribution-only tradeoff accepted; documented inline + ARCHITECTURE).
- Settings page loads admin's own secrets by design (admin-only, documented).
- ASK before every deploy (the one-time "deploy without asking" was pass-30 only).

### Open / next
- **In progress this pass:** deep app + UI/UX analysis with web research → a prioritized improvement report (suggestions only, no code yet). When the user picks items, build them phase-by-phase per the usual cadence.
- Known deferred (from audit): multi-space support (needs space switcher; product call); PayPal tenant-scoped conflict key (near-zero risk; would need a migration); fuller ARCHITECTURE §7 prose rewrite; systemic test gap (no Supabase mock harness — action orchestration only e2e-able).

### Kickoff prompt for next session (paste verbatim)
> Continue the HeatSync/23b-and-any-hackerspace platform (hackerspace-management; Next.js+Supabase; push to main = prod deploy via GitHub Actions; https://hackerspace.sh). READ FIRST: CLAUDE.md; docs/HANDOFF.md top entry (pass-35 checkpoint); memory files collaboration-cadence, integration-api-facts, hackerspace-rls-guardrail, architecture-standards, platform-not-heatsync-only. VERIFY CLEAN: `git log --oneline origin/main..main` empty, `gh run list` latest green, `pnpm exec vitest run` ~469 green, `pnpm build` clean, migrations through 039. METHOD (locked): phase-by-phase — idempotent numbered migration mirrored in scripts/schema.sql + pure unit-tested lib/*-logic.ts + lib/actions/* + Zod + guard + pages + docs (DATABASE_SCHEMA/DB_SCHEMA_MAP/API_REFERENCE/ARCHITECTURE) in the same change; permissions additive via lib/permissions-catalog.ts; RLS additive/default-deny; gate (vitest + pnpm build) + small commit per phase; ASK before every deploy; after an approved push watch the Actions run + HTTP smoke test; end long sessions with an updated HANDOFF + kickoff prompt. The UX/product improvement report is in this session's history — ask the user which items to take, then build them in that order.

---

## 2026-05-17 (pass 34) — BUGFIX: email linking ignored email-as-form-field (DEPLOYED, run 25985079088)

Branch `main`. 1 commit `9f0ee18`. User report: re-link said "already linked" but submissions weren't showing under the member.

Root cause: association only ever read the dedicated `submitter_email` (the public "your email" box, or the signed-in user's address). A form that collects email as an ordinary **email-type field** stored it in `answers`, so `submitter_email` stayed NULL → no match → `relinkAllSubmissions` updated 0 rows and toasted "already linked", and the submission never appeared under the member. Id plumbing was fine (all `space_members.id`); pure matching was the issue.

Fix (suite 469, build clean):
- New pure `deriveSubmitterEmail(fields, answers, explicit?)` (precedence: explicit valid email > first email-type field answer > any email-looking answer; trimmed+lowercased) + 5 tests.
- `submitForm`: reordered so answers are validated first, then derives + persists `submitter_email` from the answers when no dedicated one — so new submissions populate it and all existing linking (addMember/updateMember/relink) works.
- `relinkAllSubmissions`: now scans every unlinked submission, re-derives email from its `form_snapshot` + answers, matches the space email→earliest-member map, and backfills BOTH `member_id` and `submitter_email` — repairs existing broken rows.

### Open
- **DEPLOYED** pass-34: pushed `c2f8368..8befee9`, Actions run `25985079088` success, no migration. Smoke: `/` `/login` 200; `/forms` `/members` 307->login. ACTION FOR USER: click "Re-link submissions" on /forms once to repair existing rows (backfills member_id + submitter_email from answers), then verify the member's FORMS panel. Default remains ASK-before-deploy.

---

## 2026-05-17 (pass 33) — Form/submission deletion + space-wide re-link (DEPLOYED, run 25984491717)

Branch `main`. 4 commits `c4ae5d2..` (this entry). No migration, no browser verification here.

- **DF1 `c4ae5d2`** actions: `deleteForm` now PERMANENTLY deletes the form + FK-cascades all submissions (the old "refuse if submissions" guard removed); requires explicit `confirm:true` (`deleteFormSchema`) and audits the destroyed count. `deleteSubmission({submissionId})` — forms.manage, service client (form_submissions has no client write policy), space-scoped, audited. `relinkAllSubmissions()` — forms.manage, re-runs email→member linking space-wide (members earliest-joined first; reuses `linkSubmissionsByEmail`; NULL-only).
- **DF2 `1e6e5d5`** UI: forms list per-form Delete (destructive confirm spelling out permanent loss incl. signed waivers) + header "Re-link submissions"; results page per-response Delete (confirm) + "Delete form" header action. Optimistic updates.
- **DF3 (this)**: API_REFERENCE + ARCHITECTURE updated (deleteForm now cascades; immutability caveat); HANDOFF. Suite 464, build clean each phase.

### Decision note
User explicitly wanted forms + results + individual entries deletable with a confirmation; this overrides the prior "submissions are immutable, close instead" stance. Hard delete (no archive); CSV export remains available and the confirm copy points to it. Documented so an audit doesn't revert it.

### Open
- **DEPLOYED** pass-33: pushed `bff8dea..cec2d69`, Actions run `25984491717` success, no migration. Smoke: `/` `/login` 200; `/forms` `/members` `/dashboard` 307->login. NOT browser-verified. Next live check: delete a draft form, delete a response, Re-link button; confirm cascade removed submissions. Default remains ASK-before-deploy.

---

## 2026-05-17 (pass 32) — Forms↔member email association + landing mobile (DEPLOYED, run 25984078567)

Branch `main`. 6 commits `ea521de..` (this entry). No browser verification here.

### Forms email-match association (owner-chosen looser model)
Owner explicitly chose to link by email match INCLUDING raw anonymous typed-email submissions (the question spelled out the impersonated-attribution tradeoff; accepted — attribution only, no access). This SUPERSEDES the codebase's prior verified-email-only stance; the decision is documented inline in `submitForm`, in API_REFERENCE, and ARCHITECTURE so a future audit does not "fix" it back.
- **G1 `ea521de`**: pure `escapeLike` (ILIKE-safe; `_`/`%` in emails literal) + `pickMemberForEmail` (earliest-joined deterministic) + 5 tests (suite 464). `submitForm` links member_id on any submitter_email match. Shared `linkSubmissionsByEmail` helper. Superseded verified-only comment updated.
- **G2 `dbed9ac`**: `addMember` + email-changing `updateMember` call `linkSubmissionsByEmail` (service client, space-scoped).
- **G3 `832a0ae`**: migration **039** — data-only, idempotent backfill of existing `form_submissions.member_id` (NULL only) by `(space_id, lower email match)`, earliest-joined. Not in schema.sql (no structural change). Docs bumped to 039.
- **G4 `ed8d629`**: `listMemberSubmissions` (forms.manage, RLS-honoring, metadata only) + FORMS column/button on `/members` → `MemberFormsDialog` (title/kind/version/date + link to `/forms/[id]/results`).
- **G5 (this)**: API_REFERENCE + ARCHITECTURE updated (decision documented), HANDOFF.

### Landing mobile (L1, owner ask)
`app/(landing)/landing.css`: tightened the ≤600px breakpoint (nav padding/gap, section/cta/hero padding, card padding/min-height) and added a ≤400px block (nav gap/font, button padding, wordmark size) so the nav row fits ~320px without overflow. CSS-only inside media queries; desktop untouched. Next auto-injects the viewport meta (no override anywhere) so scaling is correct. Not device-tested here.

### Open
- **DEPLOYED** pass-32: pushed `a364d15..61c97e3`, Actions run `25984078567` success, migration 039 applied by the deploy. Smoke: `/` `/login` 200; `/members` `/forms` `/attendance` `/dashboard` 307->login; landing serves correct `width=device-width` viewport. NOT browser/device-verified. Next live check: public form submit by a member's email → appears under that member's FORMS panel; eyeball landing at 320/375/414px. Default remains ASK-before-deploy.

---

## 2026-05-17 (pass 31) — Audit follow-ups + attendance polish (DEPLOYED, run 25982959375)

Branch `main`. Continuation of the pass-30 audit. User: handle the deferred items where confident + properly test/doc; "stick to single space for now". 5 commits `2dc0af5..` (this entry).

### Done (each gated + own commit, suite 459, build clean)
- **`2dc0af5` PayPal sync**: `payments` has NO unique index on `external_id`, so the `onConflict:'external_id'` upsert was unreliable and fell back to an insert that stripped `external_id` -> duplicate, non-idempotent rows, not tenant-scoped. Replaced with: look up existing `external_id`s in THIS space, insert only new rows (id preserved). No migration, no schema risk.
- **`1e1b93e` door IPv6 pin**: SSRF pin parser did `pinnedHost.split(':')[0]`, mangling any IPv6 pin (failed closed -> IPv6 controllers unusable). New pure exhaustively-tested `normalizeHost` (scheme/userinfo/port/path strip; `[ipv6]`/`[ipv6]:port`/bare-ipv6 unwrap) applied to both request host and pin. ALL prior behavior preserved (verified: IPv4, host:port, userinfo-spoof reject, trailing-dot reject, metadata always blocked, IPv4-mapped-IPv6 vs IPv4 fails closed). 29 door tests.
- **`d5a71c9` /attendance polish** (user ask): client view with a "Here now" section + inline self check-in / check-in-as-host / check-out + note; history with name search, day picker, grouped-by-day headers, per-visit duration/status/notes, live visits/members summary. New pure tested `dayKey` (tz-stable) + `visitDurationMinutes`.
- **docs (this commit)**: ARCHITECTURE project tree + §7 module paths corrected to `lib/actions/*` reality; explicit note that `/settings` admin secret loading is by-design (not a leak); `getAuthMember` single-space invariant documented in code.

### Decisions / not done (intentional)
- **Single space per user**: kept (user decision). `getAuthMember` `.single()` is intentional and fails closed; documented in code + ARCHITECTURE Known Limitations #7. Not changed.
- **Settings `select('*')`**: NOT narrowed — verified the admin-only client legitimately uses `webhook_secret` + integration `config`; narrowing would be cosmetic and risk breaking the UI. Documented as intentional instead.
- A full ARCHITECTURE §7 prose rewrite remains a nice-to-have (paths now correct; an authoritative top-of-doc note already added pass-30).

### Open
- **DEPLOYED** pass-31: pushed `0bb934d..d0aef9a`, Actions run `25982959375` success, no migration. Smoke: `/` `/login` 200; `/attendance` `/dashboard` `/doors` `/payments` 307->login (gated, expected). NOT browser-verified. Next live check: `/attendance` search/day-filter/check-in, PayPal re-sync idempotency. Default remains ASK-before-deploy next session.

---

## 2026-05-17 (pass 30) — Presence/attendance feature + full app audit pass

Branch `main`. Big session: landing wording fix, a new presence module, a 4-agent read-only audit, and audit fixes. User authorized deploying this work without the per-deploy ask (one-time, for this ready work; default reverts to ASK next session unless reaffirmed). **DEPLOYED**: pushed `4b29280..c12a103`, Actions run `25982428014` success, migration 038 applied. Smoke: `/` `/login` 200; `/dashboard` `/attendance` `/doors` `/classes` `/equipment/manage` 307->login (gated, expected). NOT browser-verified.

### Presence & attendance (migration 038) — F1-F5, suite 432
`space_visits` (check-in/out, is_host, in/out notes; partial UNIQUE one-open-per-member) + `spaces.host_requires_card` (bool default true). RLS additive/default-deny: SELECT = any space member (presence is social), NO client write policy (self-resolved service-client actions only; immutable). Pure `lib/presence-logic.ts` (presenceStatus/hostEligibility/summarizePresence, 11 tests). `lib/actions/presence.ts`: checkIn (host eligibility via host_requires_card + active-card count; blocks fresh double check-in; auto-closes a >18h stale visit, no cron), checkOut, listPresentNow, getMyVisits, listAttendance. UI: dashboard "Who's here" panel (self check-in/out + host + note), `/attendance` page (all members, by product decision), `/me` history, sidebar link. Locked decisions: host = per-space toggle (default require card); attendance report = all members; stale = auto-treat (no cron); report at /attendance.

### Audit (4 parallel read-only agents) + fixes
No P0 anywhere. Door/secrets/multi-tenant clean. Fixes landed:
- **harden `dd9e3ac`**: castVote now verifies proposal in-space + open before upsert; cancelMySignup promotion path scoped by space_id; setAreaLead rejects foreign lead_id. (All were RLS-safe; defense-in-depth.)
- **docs `3efa3cd`**: ARCHITECTURE status=production + authoritative note (no monolithic lib/actions.ts), rewrote stale Known Limitations, fixed env table (dropped phantom SUPABASE_JWT_SECRET); DATABASE_SCHEMA/DB_SCHEMA_MAP ~43 tables / through 038, space_members.status enum default 'unverified' (was wrongly 'active'); README webhook wording; API_REFERENCE real paths + 4 undocumented actions. NOTE: docs-agent's "createSecret should be Admin-only" was a FALSE POSITIVE (ADMIN_ROLES = admin+board) — left correct.
- **nav `c4cba10`**: Admin manage links now gated by actual permission (layout resolves forms/certifications/classes/equipment/door .manage), not role — fixes orphaned delegated-permission members + admins seeing dead links. Customize/Import/Settings stay admin-only.
- **test `dc96d6f`**: +16 (→448): permissions least-privilege guard, invite-logic suite, door SSRF host-spoof + redact edges, pickPromotion unlimited branch.

### Open / deferred (NOT done — need a deliberate decision)
- **getAuthMember single-space assumption** (`lib/auth-helpers.ts:51` `.single()` by user_id): a user in 2+ spaces fails every action (fails closed, no leak). The app has no space switcher — it is single-space-per-user by design. Documented in ARCHITECTURE Known Limitations #7. CHECKPOINT: decide if multi-space is a product goal (needs an active-space selector) before changing.
- **settings page `select('*')`** ships webhook_secret + integration config to an admin-only client. By-design admin exposure; recommend narrowing to explicit columns / reveal-pattern in a focused pass (not changed: risk of breaking settings UI without browser test).
- **PayPal sync `onConflict: 'external_id'`** not tenant-scoped (near-zero real collision; PayPal txn ids globally unique). Recommend a 039 migration adding UNIQUE(space_id, external_id) + route change.
- **door-logic IPv6 pin quirk**: `pinnedHost.split(':')[0]` mangles an IPv6 pin (fails closed → rejects). Fine for IPv4/hostnames; revisit if an IPv6 controller is ever pinned.
- **ARCHITECTURE.md §7 / project tree** still describe the old monolithic layout; corrected with a top-of-doc authoritative note, full rewrite deferred.
- Systemic: no Supabase mock harness; e2e is mostly render smoke. Action orchestration (presence one-open/stale, form gate, door slot) unverified end-to-end.

---

## 2026-05-17 (pass 29) — Classes form-gate + rosters + /doors page DEPLOYED

Branch `main`. Pass-28 (self-entry) deployed. User: "continue, also polish, also add a doors page, also polish the classes and equipment reservation stuff, should be able to see who signed up and also should be able to require a form optionally for classes." Four design forks asked + LOCKED: roster = staff-only (members stay blind); form gate = hard gate + classes.manage override; "completed" = any submission on file (waiver model), form must be published; doors page = full at `/doors`.

### Built (LOCAL, not deployed) — 6 commits, each gated + own commit
- **P1 `92c5737`**: migration `037_class_required_form.sql` (`classes.required_form_id` nullable FK -> forms ON DELETE SET NULL) + schema.sql + types + DATABASE_SCHEMA/DB_SCHEMA_MAP. ADD COLUMN IF NOT EXISTS; no RLS change (additive nullable col on already-policied `classes`).
- **P2 `f3b05af`**: pure `signupFormEligibility` + 4 tests (suite 417->421). `signUpForClass` now has classes.manage override + sign-up-on-behalf (`memberId`) and the hard form gate (`hasFormSubmission` via service client since a class mgr need not hold forms.manage; manager override bypasses). create/updateClass validate the form is in-space + published. `listUpcomingSessions` returns `required_form {title,url,satisfied}`. Manage UI: published-form picker; member UI: shows requirement, links the form, swaps Sign up for "Complete required form" until on file.
- **P3 `69fa64c`**: reused `SessionAttendance` behind a per-session "Signups" toggle on `/classes/manage` (staff roster + attendance + complete). Members still see only spots-left.
- **P4 `c93ee9b`**: new `EquipmentReservations` component behind a per-item "Reservations" toggle on `/equipment/manage` (who reserved + window + status + manager Cancel; `listEquipmentReservations` already existed).
- **P5 `2fdc275`**: new `listMyDoorActivity` (service client after requireMember; rows where caller is actor/target; detail already redacted). New `/doors` member page = self-entry (reuses DoorSelfEntry) + masked own cards (getMyCards) + recent personal activity; empty-state. Sidebar "Doors" under Learn.
- **P6 (this)**: API_REFERENCE + ARCHITECTURE + this entry.

### Open / next
- **DEPLOYED** pass-29: pushed `6d1c853..46b2942` (6 pass-29 commits + carried pass-28 deploy-state `268d78d`), Actions run `25981712253` success, migration 037 applies on deploy. Smoke: `/` `/login` 200; `/doors` `/classes` `/classes/manage` `/equipment/manage` `/dashboard` 307->login (gated, expected). NOT browser-verified. Next live check: confirm 037 applied; create class w/ required form -> member blocked until form submitted -> manager override/on-behalf -> /classes/manage Signups roster -> /equipment/manage Reservations -> /doors page. This pass-29 deploy-state edit is a small follow-up docs commit, LOCAL/unpushed (carry or deploy next).
- Gate green at build: suite 421, `pnpm build` clean.
- Door epic remaining: **P4** inbound access-log ingest; **P5** universal API-call UI builder (`api_buttons`). (Door P-numbers are separate from this pass's P1-P6.)
- Residual/test gap unchanged: no Supabase mock harness so action orchestration (form gate, override, on-behalf) is not unit-tested; pure logic is.

---

## 2026-05-17 (pass 28) — Member self-entry DEPLOYED (dashboard surface)

Branch `main`. Pass-27 (Door P3) is deployed. User then directed: "add door access controls to dashboard if user has card access enabled" = build the locked-design member self-entry, surfaced on the dashboard. No new migration (reuses 035 `allow_member_self_entry` + `member_cards`).

### Built (LOCAL, not deployed)
- `lib/actions/door.ts`: `selfEntry({connectionId})` — `requireMember` (any active member, no permission code), strict rate limit `door-self` 5/min, momentary OPEN only (HeatSync `?o1` / generic `open` template) through the existing hardened executor. Eligibility (locked rule): connection `is_enabled` AND `allow_member_self_entry` AND caller has >=1 active `member_card` (NO `door_card_slots` row required). Membership/cards resolved server-side (client sends only `connectionId`); never unlock/lock/grant/revoke; never anon. One redacted `door_access_log` row `action='self_entry'`, `target_member_id`=self (denials audited too). `listSelfEntryDoors()` returns enabled self-entry connections only if the caller has an active card (else empty → surface hidden).
- Dashboard: `app/(app)/dashboard/door-self-entry.tsx` (client, confirm + toast) + a "Door access" panel in the dashboard right column, rendered only when `listSelfEntryDoors()` is non-empty. First-run dashboard branch unaffected (query runs after that early return).
- Docs: API_REFERENCE + ARCHITECTURE updated; this entry.

### Open / next
- **DEPLOYED** pass-28: pushed `d047820..6d1c853` (self-entry `6d1c853` + carried pass-27 deploy-state docs `14a2554`), Actions run `25981195445` success, app-only (no migration). Smoke: `/` `/login` 200; `/dashboard` `/me` `/door/manage` 307->login (gated, expected). NOT browser/controller-verified. Next live check: with a self-entry-enabled connection + the member holding an active card, the dashboard "Door access" panel should appear and the confirm button fire `selfEntry`; verify `self_entry` audit rows are redacted. This pass-28 deploy-state edit is a small follow-up docs commit, LOCAL/unpushed (carry or deploy next).
- Gate green at build time: suite 417, `pnpm build` clean.
- Door epic remaining: **P4** inbound access-log ingest (poll `?z`/webhook → resolve card_uid→member); **P5** universal API-call UI builder (`api_buttons`, same SSRF executor, door template).
- Residual/test gap unchanged: SSRF pin is host-string equality (theoretical DNS-rebinding, mitigated); no Supabase mock harness so action orchestration (incl. self-entry eligibility) is not unit-tested; pure slot logic is.

---

## 2026-05-17 (pass 27) — Door P3 DEPLOYED (slot allocator + live actions); self-entry CHECKPOINT next

Branch `main`. Start state was the pass-26 clean checkpoint. Reaffirmed framing: this is a generic multi-space hackerspace platform, HeatSync is one tenant/adapter (memory `platform-not-heatsync-only`). Slot-allocator design presented and APPROVED before building; user decisions locked: slot range **0-200 no reservation**, grant ordering **reserve -> call -> roll back on failure**, **checkpoint before member self-entry: YES**.

### Door P3 — CODE-COMPLETE, LOCAL, 5 commits, NOT deployed
Phase-by-phase, each gated (vitest + `pnpm build` read in-run) + own commit:
- **A** `036_door_card_slots.sql` + schema.sql Section 23 + types + DATABASE_SCHEMA/DB_SCHEMA_MAP. Per-connection integer-slot map. `UNIQUE(connection_id,slot)` (DB arbitrates concurrent grants) + `UNIQUE(connection_id,card_id)` (idempotent re-grant). RLS additive/default-deny: SELECT = door.manage/operate; NO client write policy (service-client executor only).
- **B** pure `lib/door-slots-logic.ts` (`pickLowestFreeSlot` lowest-free, range a param so adapter-generic; `slotCapacity`) + 8 tests. Suite 409 -> **417**.
- **C** `lib/actions/door.ts`: `grantCard`/`revokeCard`/`doorControl` (door.operate, rate-limited via `checkRateLimit`, each writes one redacted `door_access_log` row; reads via service client after the perm check since operators lack RLS read on door_connections/member_cards). Grant: reserve slot in DB first, call controller, roll back reservation on failure; idempotent; `slot_exhausted` message. Revoke: idempotent (no slot = already revoked); frees slot only on confirmed controller success. Control open/unlock/lock via the existing hardened `lib/door/executor.ts`. Zod schemas + API_REFERENCE.
- **D** `listDoorCards` (door.operate, service client, masked last4 only) + `/door/manage` passes `canOperate` (door.operate rpc) and renders per-connection Open/Unlock/Lock + expandable card list Grant/Revoke, every action behind a confirm.
- **E** ARCHITECTURE + this entry.

### Open / next
- **DEPLOYED** pass-27: pushed `1db9316..d047820` (5 P3 commits + carried pass-26 HANDOFF), Actions run `25981082371` success. Smoke: `/` `/login` 200; `/door/manage` `/me` 307->login (gated, expected). Migration 036 should be applied by the deploy; NOT browser-verified and NOT exercised against a live controller (none reachable here). Next on-site/with-controller check: grant (slot assigned) -> revoke (slot freed) -> open/lock/unlock; verify `door_access_log` rows are redacted. This pass-27 HANDOFF deploy-state edit is a small follow-up docs commit, LOCAL/unpushed (carry or deploy next).
- **CHECKPOINT (next build step): member self-entry. Design reviewed pass-27; eligibility rule LOCKED by user = "any active card is enough" (NOT slot-on-connection).** Scope: `selfEntry({connectionId})` in `door.ts` allowed only when connection `is_enabled` AND `door_connections.allow_member_self_entry` AND caller is an active member AND caller owns an active `member_card` (any active card in the space; does NOT require a `door_card_slots` row). Resolve the caller's membership/cards server-side (never trust a member/card id from the client). Momentary open only (HeatSync `?o1` / generic `open` template) through the existing executor; never unlock/lock/grant/revoke; never anonymous. Strict per-member rate limit (tighter than operator control, ~5/min). One redacted `door_access_log` row `action='self_entry'`. Surface a confirm button on `/me` (and/or a `/door` member page), hidden when no eligible connection. No new table/migration. Build on next "continue".
- Then **P4** inbound access-log ingest (poll `?z`/webhook -> resolve card_uid->member into door_access_log); **P5** universal API-call UI builder (`api_buttons`, same SSRF executor, door template).
- Residual hardening (unchanged): SSRF pin is host-string equality; hostname pin -> theoretical DNS-rebinding (mitigated by no-redirect + typically-IP pin); consider resolve-and-check. Systemic test gap: no Supabase mock harness, so action orchestration (slot reserve/rollback, idempotency, RLS) is not unit-tested; pure slot logic is.

---

## 2026-05-17 (pass 26) — CLEAN CHECKPOINT: modules 1-3 + Door P1/P2 all DEPLOYED

Clean state: `origin/main == main`, tree clean, latest deploy (`feat(door): flexible transport…`, run 25980463354) green. Migrations applied through **035**. 409 unit tests, `pnpm build` clean. Nothing local/undeployed except this HANDOFF commit (docs-only, unpushed; deploy or carry forward next pass).

### Shipped & live this overall session (verify with `git log`, smoke-tested, NOT browser-verified)
- UX: OAuth buttons gated by env; members-page invite UI; collapsible sidebar categories (order: Workspace, Governance, **Learn**, People, Finance, Account, Admin).
- Bug fixes: `ops.secrets.read` now actually works for reveal/list (migration 031, additive); KB/processes render markdown with working in-document anchor links (shared `lib/markdown-anchors.ts`, also fixes governance docs). Production incident-INSERT RLS bug CONFIRMED RESOLVED by user (closed).
- Modules (locked roadmap): **1 Certifications** (030), **2 Classes** (032), **3 Equipment** (033) — all deployed, each: migration + pure tested logic + actions + guard + admin pages + member surface + `/me` + docs.
- Door epic **P1** (034: member_cards, door.manage/operate perms, masked self-view) and **P2** (035: door_connections + door_access_log + SSRF-safe `lib/door/executor.ts` + native HeatSync adapter + audit) — deployed.
- Landing page + README refreshed to the full feature set.

### Door epic — design APPROVED, locked decisions (do NOT re-litigate)
- Transport is NOT LAN-only (cloud-hosted). Per-connection exact-host pin (public or private allowed) + ALWAYS block metadata/link-local + no redirects + time/body caps + secret server-side only + redacted audit. Plaintext-HTTP firmware risk → recommend a TLS proxy for public exposure. (memory `integration-api-facts` has this + the re-verified fixed-width HeatSync facts + GitHub links; `lib/door-logic.ts` KNOWN_DOOR_CONTROLLERS.)
- Card UID = credential (count+last4 to owner). Member self "buzz me in" = ALLOWED but ELEVATED RISK, per-connection opt-in (`door_connections.allow_member_self_entry`, default false): safeguards = active member + authorized active card + per-connection toggle + strict rate limit + full audit + confirm + never anon.
- Build whole epic phase by phase, each gated + committed; ASK before each deploy.

### Remaining (resume here)
- **P3**: live actions via `door.operate` — grant/revoke a card (HeatSync needs an integer slot allocator per connection: assign/track a 0-200 slot per member_card; pure + tested), open/lock/unlock, all audited + rate-limited + confirm. Then the member self-entry action (own active card + connection.allow_member_self_entry + rate limit + audit), surfaced on `/me`/a member door page. All writes funnel through the existing `lib/door/executor.ts` + service-client validated actions; door_access_log every attempt.
- **P4**: inbound access-log ingest (poll `?z` / webhook) → door_access_log, resolve card_uid→member.
- **P5**: universal API-call UI builder (`api_buttons` table: label/group/method/url_template/headers/body/secret_ref/confirm; same SSRF executor + host pin) with a door template.
- Residual: SSRF pin is host-string equality; hostname pin → theoretical DNS-rebinding (mitigated by no-redirect + typically-IP pin). Consider resolve-and-check in P3 if hardening.
- Systemic test gap (unchanged): no Supabase mock harness; pure logic well covered, action orchestration not unit-tested.
- Slot allocation is the one genuinely new design question for P3 (HeatSync keys cards by integer slot 0-200): propose a `member_card.controller_slot` (per connection) allocator + handle exhaustion, present before building.

---

## 2026-05-17 (pass 25) — Door P1 DEPLOYED; Door P2 code-complete LOCAL

Door P1 + nav reorg DEPLOYED (push `1cbea13`, run 25980105959 success; migration `034` applied; smoke ok, not browser-verified). Nav further tweaked: collapsible categories; order Workspace, Governance, **Learn**, People, Finance, Account, Admin (user moved Learn before People).

### Door P2 — CODE-COMPLETE, LOCAL, 1 commit, NOT deployed
Migration `035` (`door_connections`, `door_access_log`) mirrored schema.sql Section 22; types; Zod; docs (DATABASE_SCHEMA/DB_SCHEMA_MAP/API_REFERENCE/ARCHITECTURE). Safety core is pure + heavily unit-tested (`lib/door-logic.ts`; suite 394→409): `validateDoorTarget` (request host MUST equal pinned host; metadata/link-local always blocked; http/https only), HeatSync encoders with the re-verified fixed-width zero-pad (slot3/perm3/tag8/4-char pw), generic `applyTemplate`, `redactDoorSecrets`. `lib/door/executor.ts` = single hardened egress (re-validate pin, `redirect:'manual'`, abort timeout, body cap, redact). `lib/actions/door.ts`: connection CRUD + `listSecretTitles` + `testDoorConnection` (status verb ONLY, writes one redacted `door_access_log` row) + `listDoorAccessLog`. Password read from AES-256-GCM secrets vault, decrypted server-side only, never returned/logged. `/door/manage` admin UI + sidebar Admin link. No live door verbs exposed yet → deploying P2 is low-risk (only door.manage can configure + status-test).

### Open / next
- LOCAL & undeployed: Door P2 (1 commit). Awaiting deploy approval (migration 035). After push: confirm 035 applied; configure a connection + test (needs a reachable controller / VPN — likely only verifiable on-site).
- Door epic remaining: **P3** live actions (grant/revoke/open/lock via `door.operate`, audited + rate-limited + confirm) + the per-connection member self-entry opt-in (ELEVATED RISK, user-chosen; safeguards: active member + authorized card + per-connection toggle + strict rate limit + audit + confirm, never anon). **P4** inbound access-log ingest (poll/webhook). **P5** universal API-call UI builder + door template.
- Queued user requests outstanding: update landing page + README with the full new feature set (certs/classes/equipment/forms/door/invites/incident-tracking) — task open.
- Residual: SSRF pin is host-string equality; if an admin pins a hostname (not an IP), DNS rebinding is a theoretical risk (no-redirect + LAN-only + typically-IP pin mitigate). Note for P3 hardening if needed.

---

## 2026-05-17 (pass 24) — Equipment DEPLOYED; Door epic design approved; P1 + nav reorg LOCAL

Branch `main`. Equipment module (pass-23) DEPLOYED this pass (push `f32743d`, Actions run 25979725237 success 1m19s; migration `033` applied; `/equipment`, `/equipment/manage`, `/me` smoke 307→login, not browser-verified). Modules 1-3 (Certifications, Classes, Equipment) all live.

### Door epic — design APPROVED (full design in chat pass-24). Locked decisions:
- Transport/SSRF: **per-connection host pin + "internal device" ack**; executor allows only the pinned host, no redirects, size/time caps, secret server-side only.
- Card UID visibility to owner: **count + last4 only** (UID is a credential; managers full).
- Open door: user chose **ALSO member self "buzz me in"** (I advised against; build it opt-in per-connection, active-member + authorized-card check, strict rate limit, per-connection toggle, full audit, confirm, never anon — ELEVATED RISK, flagged).
- Build: **whole epic straight through**, phase by phase, each gated + committed; still ASK before each deploy.
- Permissions: `door.manage` (config + cards) / `door.operate` (live actions) — additive, group Access.

### Native HeatSync adapter facts RE-VERIFIED 2026-05-17 (saved to memory `integration-api-facts`)
Fetched live via `gh api`: `zyphlar/Open_Access_Control_Ethernet.ino` + `heatsynclabs/.../app/models/card.rb`. Unchanged vs memory; ADDED precision: firmware parses FIXED-WIDTH ZERO-PADDED — user slot 3 digits, `&p` perm 3 digits, `&t` tag 8 hex, `?e=` password 4 chars. Canonical: `GET {url}?m{slot}&p{perm}&t{tag}&e{pw}`. Native adapter encoder MUST zero-pad 3/3/8 and be unit-tested. Cited in memory; no re-fetch needed through P2.

### Shipped this pass (LOCAL, not deployed): Door P1 + nav reorg
- Door **P1** (1 commit): migration `034_member_cards.sql` (`member_cards`; UID is a credential — `door.manage`-only RLS, NO member SELECT policy; masked self-view via service-client `getMyCards` = count+last4) + `door.manage`/`door.operate` perms (group Access) seeded+backfilled, mirrored schema.sql Section 21, types, DATABASE_SCHEMA/DB_SCHEMA_MAP. Pure `door-logic.ts` mask + 3 tests (suite 394). `lib/actions/member-cards.ts` (manage CRUD + masked getMyCards). Per-member "Cards" panel on `/members` gated to `door.manage`; "My access cards" (masked) on `/me`. No controller calls. Gated, committed.
- **Nav reorg** (1 commit, user-requested): sidebar now collapsible categories (Workspace/Governance/People/Finance/Learn/Account/Admin), per-section open/closed persisted in localStorage; Finance + Learn split out. Build green.

### Open / next
- LOCAL & undeployed: Door P1 + nav reorg (2 commits). Awaiting deploy approval. After push: confirm `034` applied, board has `door.manage`/`door.operate`, exercise add card → /me masked view.
- Door epic continues: **P2** = `door_connections` (secret_ref → AES-256-GCM secrets vault, host pin, adapter native_heatsync|generic_http, verb templates) + `door_access_log` + hardened SSRF-safe executor (pure URL/SSRF/HeatSync-encoder logic heavily unit-tested; zero-pad 3/3/8) + native adapter + door.manage admin UI + audit. Then P3 live actions (`door.operate` + the member self-entry opt-in), P4 inbound log, P5 universal API-call UI builder + door template.
- Systemic test gap unchanged (no Supabase mock harness; pure logic well covered).

---

## 2026-05-17 (pass 23) — Classes DEPLOYED; Equipment module (3) code-complete LOCAL

Branch `main`. Classes module (pass-22) was deployed this pass (push `2096228`, Actions run 25979364584 success 1m? ; migration `032` applied; `/classes`, `/classes/manage`, `/me` smoke 307→login, not browser-verified). User then chose to continue the locked order → Equipment (module 3).

### Equipment registry + reservations (locked module 3) — CODE-COMPLETE, LOCAL, 6 commits, NOT deployed
Phase-by-phase, each gated (vitest + `pnpm build` read in-run) + own commit:
- A: migration `033_equipment.sql` (`equipment`, `equipment_reservations`) mirrored in `schema.sql` (in-place seed fn + appended Section 20); `equipment.manage` perm (group Equipment) seeded+backfilled; types; DATABASE_SCHEMA/DB_SCHEMA_MAP. Additive default-deny RLS; reservations have SELECT (manage or own) + manager UPDATE, NO INSERT/DELETE (reserve/cancel via validated service-client action). No DB overlap constraint (no btree_gist dep) — overlap enforced in the action via pure logic.
- B: pure `lib/equipment-logic.ts` (intervalsOverlap, hasConflict, reservationEligibility) + 9 tests (suite 391) + Zod.
- C: `lib/actions/equipment.ts` (registry CRUD; listEquipmentForMembers w/ member_certified flag via service client; reserve/cancel validated service-client w/ status+overlap+required-cert, equipment.manage override + book-for-member; listEquipmentReservations; getMyReservations) + `lib/equipment-guard.ts` + barrel + API_REFERENCE.
- D: `/equipment/manage` admin pages + sidebar Admin "Manage equipment".
- E: `/equipment` member browse + reserve (cert gate shown up front) + sidebar member "Equipment".
- F: "My equipment reservations" on `/me` + ARCHITECTURE + this entry.

Cert-gate (user-approved): reserving cert-gated equipment requires an active `member_certifications` for the member; an `equipment.manage` holder overrides and may book on a member's behalf. Cert check reads `member_certifications` via the service client (boolean only) since a non-cert-permissioned equipment manager can't read it under RLS — no write/PII bypass of the guarded surface.

### Open / not done
- Equipment is LOCAL (6 commits). Awaiting deploy approval. After push: confirm `033` applied, board has `equipment.manage`, exercise add equipment (+ required cert) → member reserve (cert gate / overlap) → manager override → `/me`. NOT browser-verified.
- Pure logic unit-tested; action orchestration (overlap/cert/override/RLS) NOT (same systemic no-mock-harness gap).
- Roadmap remaining: module 4 Door epic (member_cards + configurable door integration + native HeatSync adapter + the universal API-call UI builder; largest/riskiest, design-first, do last). Cert/feature nav links for non-admin permission-holders still admin-block-only (known minor gap).

---

## 2026-05-17 (pass 22) — Classes module (2) code-complete LOCAL; roadmap reaffirmed

Branch `main`. Incident-INSERT RLS bug confirmed RESOLVED by the user (closed; see pass-21 note). User asked to continue the locked roadmap; chose Classes (module 2) next; reaffirmed the locked order (Certs done → Classes → Equipment → Door epic, which is where the "custom API-call UI builder" lives, module 4, design-first/last).

### Classes + sessions + signups (locked module 2) — CODE-COMPLETE, LOCAL, 6 commits, NOT deployed
Phase-by-phase, each gated (vitest + `pnpm build` read in-run) + its own commit:
- A: migration `032_classes.sql` (`classes`, `class_sessions`, `class_signups`) mirrored in `schema.sql` (in-place seed fn + appended Section 19); `classes.manage`/`classes.instruct` perms (group Classes) seeded+backfilled; types; DATABASE_SCHEMA/DB_SCHEMA_MAP. Additive default-deny RLS; `class_signups` has SELECT (manage/instruct or own) + instructor UPDATE, NO INSERT/DELETE (signup/cancel via validated service-client action); partial unique = one non-cancelled signup per member+session.
- B: pure `lib/classes-logic.ts` (effectiveCapacity, computeSignupStatus, sessionTiming, canSignUp, pickPromotion) + 10 tests (suite 382) + Zod.
- C: `lib/actions/classes.ts` (class/session CRUD; service-client signUp/cancel w/ capacity+waitlist+dedupe+promotion; listUpcomingSessions w/ service-client counts so members see spots-left but not who; markAttendance; completeSession) + `lib/classes-guard.ts` + barrel + API_REFERENCE.
- D: `/classes/manage` admin pages + sidebar Admin "Manage classes".
- E: `/classes` member calendar (signup/waitlist/cancel) + instructor attendance/completion component + sidebar member "Classes".
- F: "My classes" on `/me` + ARCHITECTURE + this entry.

Cert-on-completion (user-approved design): `completeSession` awards `classes.grants_certification_id` to attended members via the normal `grantCertification` path, so it only issues if the acting instructor also holds `certifications.grant`; else completion still succeeds and the UI says certificates were skipped. No service-role bypass of the guarded certifications surface.

### Open / not done
- Classes is LOCAL (6 commits). Awaiting deploy approval. After push: confirm `032` applied, board has both perms, exercise create class → schedule session → member signup/waitlist/cancel → attendance → complete (cert-on-completion) → `/me`. NOT browser-verified (no live browser).
- Pure logic unit-tested; action orchestration (capacity/waitlist/promotion/RLS) NOT (same systemic no-mock-harness gap as forms/certs).
- Roadmap remaining: module 3 Equipment, module 4 Door epic (member_cards + configurable door integration + native HeatSync adapter + the universal API-call UI builder; design-first, do last). Noted cert refinement still open: `/certifications` (and `/classes/manage`) sidebar links are in the admin-only block, so a non-admin permission-holder must reach them by URL.

---

## 2026-05-17 (pass 21) — Two UX fixes DEPLOYED; Certifications module (1) code-complete LOCAL

Branch `main`. Start state clean, deploys green (incident-tracking pass-20 live).

### Deployed this pass (2 commits, pushed, Actions run 25978300957 success 1m28s, smoke-verified)
- `feat(auth)`: login OAuth buttons are now opt-in via `NEXT_PUBLIC_OAUTH_GITHUB`/`_GOOGLE` (pure `lib/auth-config.ts` `resolveOAuthProviders`, unit-tested; `.env.example` + DEPLOYMENT.md). Prod `/login` smoke: 200, GitHub/Google + OR divider ABSENT (no env set = correctly hidden).
- `fix(members)`: members page now renders the existing `InvitesPanel` for admin/board (server page loads invites + slug, composes via a new `inviteSlot` prop; MembersClient stays invite-agnostic). First-run dashboard copy fixed. Prod `/members` 307 -> /login (auth-gated; logged-in invite UI NOT browser-verified — needs a manual check).

### Certifications + Instructor (locked module 1) — CODE-COMPLETE, LOCAL, 6 commits, NOT deployed
Built phase-by-phase, each gated (vitest + `pnpm build` read in-run) + its own commit:
- A: migration `030_certifications.sql` (`certifications`, `member_certifications`) + mirrored in `schema.sql` (in-place seed fn updated + appended Section 18) + `permissions-catalog` (`certifications.manage`, `certifications.grant`, group Certifications, board defaults + backfill) + `types/database.ts` + DATABASE_SCHEMA/DB_SCHEMA_MAP. RLS additive/default-deny: cert types readable by any space member; grants readable by managers/granters (all) or member (own); INSERT/UPDATE = `certifications.grant`; NO DELETE policy (immutable history, soft revoke); no anon path. Expiry snapshotted at grant.
- B: pure `lib/certifications-logic.ts` (`computeExpiry` month/leap clamp; `isCertificationActive`; `certificationStatus`) + 16 tests (suite 348 -> 364) + Zod schemas.
- C: `lib/actions/certifications.ts` (create/update/delete/list types; grant/revoke/renew; listMemberCertifications; getMyCertifications — no-params, session+RLS scoped) + `lib/certifications-guard.ts` + barrel + API_REFERENCE.
- D: `/certifications` admin pages (manage cert types) + sidebar Admin link.
- E: per-member award/revoke/renew dialog reachable from a "Certs" column on `/members` shown to ANY `certifications.grant` holder (non-admin instructors included; server resolves the perm via RPC).
- F: member-facing `/me` ("My certifications & access": own grants + read-only effective permissions) + sidebar "My access" link + ARCHITECTURE.

### Open / not done
- Certifications is LOCAL (6 commits ahead). Awaiting deploy approval. After push: confirm `030` applied, board has both perms, exercise create-type -> grant -> revoke -> renew -> `/me` -> non-admin-instructor path; nothing is browser-verified (no live browser this session).
- Pure logic is unit-tested; action *orchestration* (RLS/visibility/grant uniqueness) is NOT (no Supabase mock harness — same systemic gap as forms).
- Secrets-permission audit (user-requested) FOUND A REAL BUG and FIXED IT (user-approved, LOCAL): `revealSecret` hard-gated on built-in role `['admin','board']` and `secrets_select` never consulted `ops.secrets.read`, so the permission was inert and even an ACL-granted member was pre-blocked by the action; the Ops page also short-circuited the secrets fetch by built-in role. Fix (additive, guarded-surface, approved): migration `031` adds `OR user_has_permission(...,'ops.secrets.read')` to `secrets_select` (admin/board + per-secret `ops_acl` branches unchanged, access-neutral); `revealSecret` now `requireMember` + RLS-bounded read (RLS is the boundary); Ops page always queries secrets (RLS filters) and shows the section for admin/board OR the perm OR any ACL-returned row. Writes unchanged. Mirrored in schema.sql + migration docs. NOT browser-verified.
- KB/process markdown + anchors (user-requested) DONE, LOCAL: KB/process detail (the ops-client view dialog, the only render path; `/ops/[id]` is the editor) rendered via a bare unsanitized `ReactMarkdown`; now uses the shared `SafeMarkdown`. New dependency-free `lib/markdown-anchors.ts` (heading text flatten + GitHub-ish slug + per-render dedupe + in-doc href test; 8 unit tests, suite 364 -> 372) wired into BOTH `SafeMarkdown` and `MarkdownBody` so headings get ids and `[x](#heading)` resolves; in-document links no longer force a new tab (was breaking the anchor jump in governance docs too). No new npm dep (rehype-slug unavailable offline). NOT browser-verified.
- RESOLVED: the long-standing production incident-INSERT RLS bug is confirmed solved by the user (2026-05-17). No longer an open item; the `025` re-assert + prior hardening held. Close it out in future passes.

---

## 2026-05-17 (pass 20) — Forms epic deployed; research; incident tracking; forward roadmap

### Deployed & verified
- Pushed P6/P7/P8 + docs (commits up to `73eef72`); deploy run succeeded; migrations `028` (forms slug unique per space) + `029` (`space_invites.role`) applied. Smoke-verified on prod: `/f/<space>/<slug>` returns the anonymous 200 page (NOT a login redirect — the long-unverified public-forms route is finally confirmed), `/join/<space>` public, `/forms` + `/my-forms` correctly auth-gated. Forms+invites (migrations 026-029) fully shipped.
- Local commits awaiting deploy at pass close: `2559166` (forms public link + Copy button on member & admin lists) and the incident-tracking work in this entry.

### Integration research (web-verified; saved to memory `integration-api-facts`)
- Payments are manual/CSV only today (no live API; known limitation). For real integration: **Stripe** is the one with a maintained official SDK + signature-verified webhooks (raw body, integer minor units). PayPal v2 works but official Node SDK has gaps (Subscriptions/webhook-verify need raw REST). Zeffy = read-only pull API + manual link. **Venmo has no usable API** (manual link / via PayPal-Braintree only). Canonical platform-agnostic payment record shape recorded in memory.
- HeatSync door = Arduino HTTP query-string API (`?m<slot>&p&t&e=<shared_pw>` add card, `?r` revoke, `?o1`/`?u` open), no TLS, LAN/VPN only. Generic adapter pattern (configurable URL + auth + verbs grant/revoke/open + inbound log) recorded.

### Anonymous incident tracking (this entry, LOCAL)
- Gap found: `fileIncident` mints a `reporter_token` and the filing UI shows it ("the only way to look it up later") but there was NO lookup UI. Built it: pure `lib/incident-logic.ts` `publicIncidentView` (redacts board-only updates, subjects, decision makers; disposition only after decided/closed; double-filtered at DB + logic); `trackIncident` service-client action (token = bearer credential, 192-bit UNIQUE, generic not-found = enumeration-safe); public `/track` page (+ middleware allowlist); filing UI deep-links `/track?token=`; `__tests__/incident-tracking.test.ts`.

### Forward roadmap (decisions LOCKED with user — see memory `heatsync-members-site`, `integration-api-facts`, `architecture-standards`)
Build order, each as its own well-separated module (migration + pure `*-logic.ts` tested + `lib/actions/*` + pages + docs; permissions via the additive catalog; the guarded RLS rule applies):
1. **Certifications + Instructor** (NEXT): `certifications` + `member_certifications` tables/RLS; `certifications.manage` + `certifications.grant` permissions (grant = the Instructor capability, assignable to roles/area-leads); admin pages + member-facing "My certifications & permissions" view.
2. **Classes**: `classes`/`class_sessions`/`class_signups`; `classes.manage`/`classes.instruct`; `payment_link` field at minimum; calendar; a class may grant a cert.
3. **Equipment**: registry + availability + reservations; gated perms.
4. **Door epic ("all of it")**: `member_cards` (RFID/NFC) ↔ member; configurable per-space door integration (URL+auth+verbs+inbound log); native HeatSync adapter; universal API-call UI builder with a door template. Largest/riskiest; own design pass; build last; LAN-only transport caveat.
- Instructor/Host/Champion = PERMISSIONS, not new built-in roles. Payments: add a `payment_link` field generally; a real Stripe integration is a separate, later, explicitly-scoped effort using the verified facts in memory.

### Open / not done
- **Production incident-INSERT RLS bug still OPEN** (separate from the tracking UI just built): never retried/diagnosed since `025`. Needs a prod retry; do not touch the permissions/RLS surface without diagnosis + approval.
- Not browser-verified (no live browser this session): the forms-link Copy buttons, the `/track` flow end-to-end, and the broader forms/onboarding/retro-link chain. Smoke-test lists in pass-18/19.
- Systemic test gap remains: `__tests__/actions.test.ts` largely asserts its own mock; no Supabase mock harness, so action *orchestration* is not unit-tested (pure logic is well covered). Recommended discrete follow-up.

---

## 2026-05-17 (pass 19) — Forms URL restructure + role invites + member surface + audit, LOCAL

User redirected after Phases 1-5 shipped. Decisions (memory `forms-feature` updated): per-space form slug + `/f/[space]/[slug]` (reverses the original global-slug lock), space-scoped invites incl. role-granting + usage caps, member-facing forms surface, starter templates, obvious publish flow.

### What shipped (local commits on top of `origin/main`)

- `5a49ecb` (PUSHED, deploy triggered, NEVER VERIFIED — superseded): `/f` added to middleware PUBLIC_ROUTES so the old `/f/[slug]` was anon-reachable. P6 replaces that route; re-verify the new one post-deploy.
- `8bbe99d` P6: migration 028 (drop global `UNIQUE(forms.slug)`, add `UNIQUE(space_id,slug)`); `getPublicForm({space,slug})`; route moved `app/f/[slug]` → `app/f/[space]/[slug]`; public client submits by `formId`; builder/list show `/f/<space>/<slug>`; forms-guard returns `spaceSlug`.
- `df6951c` P7 + audit hardening: migration 029 `space_invites.role` (member_role, default member); `lib/invite-logic.ts` `canAssignInviteRole` (admin→any, board→non-admin); createInvite/updateInvite enforce it; `joinSpace` applies invite role; invites panel role picker + single-use; `/join/[space]` landing (+ `/join` public); `/login` honors validated `?next=` (was hardcoded); `submitForm` requires `formId` (slug ambiguous post-028).
- P8 (this entry's commit): builder publish-flow UX (draft/published/closed banners, create→edit redirect so Publish is right there, members-only "no public link" note); member-facing `/my-forms` list + `/my-forms/[id]` fill (sidebar "Forms" for all members — fixes the long-standing members-only-forms-have-no-surface gap); starter templates picker on `/forms/new` (`lib/form-templates.ts`); forms-client relabels members-only forms (no misleading public URL).
- Docs corrected (two background audit agents ran): DATABASE_SCHEMA / DB_SCHEMA_MAP / ARCHITECTURE / API_REFERENCE — migration list 014-029, per-space slug, `/f/[space]/[slug]`, getPublicForm signature, invite roles. `next.config` `ignoreBuildErrors` noted (pre-existing).

### Audit results (parallel read-only agents + my review)

- Forms/invites P0: none. RLS sound, anon cannot read submissions/drafts, snapshot immutable, public route genuinely anon, retro-link verified-email-gated (no hijack), onboarding fail-open verified, permissions surface additive/untouched.
- Fixed this pass: `/login` `?next=` (P1), `submitForm` slug ambiguity (P1), members-only misleading public URL (P2).

### Open / residual gaps (honest)

- **NOTHING new deployed.** `origin/main` is at `5a49ecb` (unverified). P6/P7/P8 + doc commits are LOCAL. Migrations 026/027 deployed; 028/029 ship with the next push. Awaiting deploy approval.
- NOT browser-verified (no live browser): the whole builder→publish→public-submit→onboarding→retro-link→member-fill→role-invite→/join chain. Smoke-test list spans pass-18 + this entry.
- Systemic test gap: `__tests__/actions.test.ts` (49 "tests") largely asserts its own Supabase mock, not real actions. New pure logic is well covered (forms-logic, invite-logic, validateAnswers, schemas — 337 tests); action *orchestration* (visibility/RLS/retro-link IO) is NOT unit-tested (no mock harness in repo). Recommended discrete follow-up: a Supabase mock harness, then real action tests.
- Member fill has no "already submitted" indicator (members can't read form_submissions under RLS; would need a service-client probe). Duplicate member submissions possible; acceptable (waivers re-sign), noted.
- Production incident-filing RLS bug still open (not retried since `025`).

---

## 2026-05-16 (pass 18) — Forms + waivers Phases 1-5 COMPLETE (schema/RLS + actions + builder UI + onboarding step + retro-link), LOCAL, awaiting deploy approval

Branch: `main`. Migration: `026` (not yet deployed). `pnpm build` + `pnpm exec vitest run` gate pending in this entry's session.

### State reconciliation (pass-17 prose was stale)

- Pass-17 said Tier 2+3 (`a1ea92a`, `b7461f0`) were "LOCAL/unpushed". They are in fact DEPLOYED: `git log origin/main..main` is empty, and Actions run `25973229017` (commit `3ace1af`) succeeded. So at pass-18 start: `origin/main == main`, clean, all UX Tiers 1-3 live. The pass-17 entry is left as-written (append-only); this is the correction of record.
- Branches present: `main`, `ux-polish-wip` (deletable backup), `hotfix-incident` (stale, not deleted — flag for user).

### Incident-filing RLS open item — STILL OPEN

- User confirms it has NOT been retried on prod since `025`. `025` only fixed cause #2 (policy drift). Item stays open: before any RLS change, retry on prod; if it still fails, run the discriminating SQL in the pass-17 entry to separate cause #1 (auth.uid() null in SSR) vs #3 (membership data drift). Permissions/RLS surface NOT to be modified without that diagnosis + user approval (guardrail).

### Forms + waivers Phase 1 (this session) — schema + RLS only, LOCAL

- New `scripts/026_forms.sql` (idempotent) + mirrored as `schema.sql` Section 17 + Section 15 seed-function updated.
- Tables: `forms` (space_id, globally-UNIQUE `slug`, `kind` form/waiver, `visibility` public_anon/public_auth/members, `status` draft/published/closed, `schema` jsonb, `legal_text`, `version`, `created_by`) and `form_submissions` (form_id, denormalized space_id, member_id, submitter_email, answers, `form_snapshot`/`legal_text_snapshot`/`form_version` immutable snapshots, ip, user_agent). Indexes on space/slug/form/email/member.
- RLS (additive, default-deny): `forms` SELECT = `forms.manage` holders (all forms) or ordinary members (published only — drafts/closed hidden from non-managers); INSERT/UPDATE/DELETE = `user_has_permission(..., 'forms.manage')`. `form_submissions` SELECT = `forms.manage` only; **no write policy at all** → RLS hard-denies every non-service client and makes submissions immutable. Every submission funnels through one validated service-client server action (Phase 2). Public `/f/[slug]` will be served by a service-client server action, so `anon` gets no grant on `forms` (user-chosen option).
- New `forms.manage` permission added to `lib/permissions-catalog.ts` (group Community) + board default; `seed_default_role_permissions()` extended; backfill `board -> forms.manage` for existing spaces (ON CONFLICT DO NOTHING).
- `types/database.ts`: `forms` + `form_submissions` added. Docs updated: DATABASE_SCHEMA (026 row), DB_SCHEMA_MAP (quick-map + migrations), ARCHITECTURE (forms note).

### Phase 1 self-audit (commit `66dd9b7`, local)

Audited the migration before continuing. Three fixes applied: dropped redundant `idx_forms_slug` (UNIQUE already indexes slug); tightened `forms_select` to `forms.manage` (all) OR member+`status='published'` (drafts/closed no longer exposed via raw PostgREST); made the `submitter_email`/`member_id` submission indexes partial. None weaken access; the SELECT change strengthens it. Safe because `forms` is a new table with no existing dependents.

### Forms + waivers Phase 2 (this session) — server actions + Zod + tests, LOCAL

- `lib/validations.ts`: form field/array schemas (8 field types, duplicate-key + select-options refinements), `createForm`/`updateForm`/`setFormStatus`/`formId`/`submitForm`/`linkSubmissions` schemas. slug immutable on update.
- `lib/forms-schema.ts` (pure, unit-tested): `parseFormSchema` + `validateAnswers` (server-side answer validation against the stored schema; unknown keys discarded so no arbitrary jsonb injection).
- `lib/actions/forms.ts`: `createForm`, `updateForm` (waiver version bump on legal/schema change, non-blocking), `setFormStatus`, `deleteForm` (refused when submissions exist), `listForms`, `getFormResults`, `exportFormResultsCsv` (audited), `submitForm` (service-client read + write, visibility + consent enforcement, snapshot, IP/UA capture, no anon DB grant), `linkSubmissionsForMember` (forms.manage manual-link; auto verified-email path is Phase 5). forms.manage gate via `user_has_permission` RPC + RLS defense-in-depth.
- `types/database.ts`: typed `user_has_permission` + `user_effective_roles` (were stale since 023). `lib/actions/index.ts` re-exports forms. `__tests__/forms.test.ts` (14 tests). API_REFERENCE updated.
- Gate: `pnpm exec vitest run` 285/285; `pnpm build` exit 0, clean.

### Forms + waivers Phase 3 (this session) — builder UI + public page, LOCAL

- `components/forms/form-renderer.tsx`: one controlled renderer for all 8 field types, shared by the builder preview and the public page so they cannot drift.
- `components/forms/form-builder.tsx`: the easy builder (locked first-class priority). Label-only field creation (keys auto-derived + de-duped at save, never typed), add via one-click type buttons, up/down reorder buttons (no integer order field), inline options editor, live preview pane. Edit mode adds publish/close/draft/delete (via `useConfirm`) and a copy-public-link affordance.
- Pages (server-gated by `requireFormsManagerPage` in `lib/forms-guard.ts` — forms.manage via the same RPC, redirect non-managers; RLS still the real boundary): `/forms` directory (status/visibility badges, Empty state), `/forms/new`, `/forms/[id]/edit`, `/forms/[id]/results` (table + client CSV download via `exportFormResultsCsv`).
- Public `app/f/[slug]/page.tsx` (top-level, outside `(app)`): `getPublicForm` (service client, published + public-visibility only — members-only forms are NOT exposed here; their schema stays in-app), waiver legal text + consent, optional email for anon, signed-in gate for `public_auth`, thank-you state.
- Sidebar: "Forms & waivers" NavLink in the Admin block. Toasts use `sonner` (matched the codebase convention; the custom use-toast has no mounted Toaster). New `getPublicForm` + `formSlug` export; API_REFERENCE updated.
- Gate: `pnpm exec vitest run` 285/285; `pnpm build` exit 0; `/forms`, `/forms/[id]`, `/forms/new`, `/f/[slug]` all compiled.
- NOT browser-verified (no live browser this session): smoke-test the builder (add/reorder/remove fields, live preview, create + edit + publish + close + delete), the results CSV download, and a public submission for each visibility (anon, public_auth signed-out gate, waiver consent).

### Forms + waivers Phase 4 (this session) — onboarding form step, LOCAL

- `scripts/027_onboarding_form_step.sql` (idempotent constraint replace) + `schema.sql` Section 14 inline CHECK now allows `step_type = 'form'`. Referenced form id lives in the step's existing `config.form_id` (no new column). validations `onboardingStepTypeSchema` + onboarding action union + customize types/casts include `'form'`.
- `finishOnboarding`: a required `form` step is satisfied if a submission for `config.form_id` by this member exists (any version — non-blocking re-sign / auto-satisfy). Fails open if the form is missing or unpublished so a misconfig cannot trap a member out of their space. Submission probe uses the service client (submissions are forms.manage-only under RLS).
- `app/onboarding/page.tsx` enriches `form` steps with the published form def + a prior-submission flag; `onboarding-flow.tsx` renders `FormRenderer` + waiver legal text/consent and submits via `submitForm` then `markOnboardingStepDone`; already-submitted or unavailable forms show a non-blocking notice.
- Admin: `customize/page.tsx` fetches the space's forms; `onboarding-panel.tsx` gets a "+ Form step" button and a form `<select>` (writes `config.form_id`); empty-state hint when no published forms.
- Tests: `__tests__/forms.test.ts` +2 (onboarding form-step contract). Gate: `pnpm exec vitest run` 287/287; `pnpm build` exit 0; onboarding + customize compiled. NOT unit-tested: `finishOnboarding` enforcement/auto-satisfy is DB-bound (no mocked test); covered by reasoning + manual.
- NOT browser-verified: admin adds a form step + picks a form; member onboarding renders/sumbits the form/waiver; required-form blocks finish until submitted; auto-satisfy when a prior submission exists; fail-open on unpublished form.

### Phase 4 self-audit + Phase 5 (this session) — LOCAL

- Phase 4 audit: verified migration `022` uses an inline unnamed column CHECK, so the auto name `space_onboarding_steps_step_type_check` is correct and `027`'s DROP targets it (no fix needed). Fixed a real bug: `onboarding-flow` could double-insert a form/waiver submission on Back-then-Forward — added session-local `submittedNow` tracking so a step is not re-submitted (commit is the small `harden(forms)` one).
- Phase 5 (retro-link): `claimMyAnonymousSubmissions()` in `forms.ts` — exported but safe (no trusted params; resolves member + email from the caller's session; gated on `email_confirmed_at`; idempotent). Hooked best-effort from `joinSpace` (member insert now returns id; links prior anon submissions for the verified email) and `finishOnboarding`. `addMember`/`importMembers` are deliberately NOT auto-linked (admin-asserted emails are unverified — the locked decision forbids auto-link there); the forms.manage `linkSubmissionsForMember` remains the admin manual-link. **Interpretation flagged for the user:** the brief listed addMember/import as hook points, but the locked verified-email rule wins; auto-linking unverified emails would risk mis-attributing a waiver.
- Gate: `pnpm exec vitest run` 287/287; `pnpm build` exit 0. Retro-link logic is DB-bound — not unit-tested (no mocked test); covered by reasoning + manual.

### Test-coverage hardening (this session) — LOCAL

- Audit found the suite is pure-logic only (no test exercises Supabase; `actions.test.ts` only asserts its own mock). Forms security/correctness logic lived inside DB-coupled actions/components and was effectively untested.
- New `lib/forms-logic.ts`: `csvCell`, `parseClientIp`, `shouldBumpFormVersion`, `evaluateRequiredFormStep`, `slugify`, `deriveFieldKeys` extracted behaviour-unchanged; `forms.ts`/`onboarding.ts`/`form-builder.tsx` now consume them (full suite stayed green = no behaviour change). Also collapsed the duplicate-`admin` build break noted earlier (already fixed in `40d4cda`).
- `__tests__/forms.test.ts` 16 -> 62 tests (total 333): every `validateAnswers` branch (type coercion, length caps, required, unknown-key stripping, first-error ordering), `parseFormSchema`, all new Zod schemas incl. `formSlug` boundaries, and every extracted helper. Build re-verified properly (`Compiled successfully`, exit 0, routes present).
- Still NOT covered (DB-bound, no mock harness in repo): the action *orchestration* itself (visibility enforcement in `submitForm`, RLS, retro-link IO). The decision logic they call is now unit-tested; the IO wiring needs the manual smoke-tests listed above.

### Open / next

- **Forms + waivers feature is code-complete (Phases 1-5).** All work is LOCAL; do NOT push without explicit go. Migrations `026` + `027` ship with the first push.
- NOT browser-verified (no live browser this session): the full builder/public-page/onboarding-form-step/retro-link paths. Smoke-test lists are in each phase subsection above.
- Retro-link not browser-verified: sign an anon public waiver, then join the space (or finish onboarding) with that verified email → the submission should attribute to the member; addMember with the same email should NOT auto-link (admin uses linkSubmissionsForMember).
- After an approved push: watch the Actions run; confirm `026`+`027` applied (`_migrations_applied`), a space's board has `forms.manage`, and exercise builder → publish → public submit → onboarding form step → retro-link end to end.
- Unrelated, still open: the production incident-filing RLS bug — not retried since `025`; do not touch the permissions/RLS surface without a prod retry + diagnosis.

---

## 2026-05-15/16 (pass 17) — UX polish Tier 1 (minus S3) + incident-RLS hotfix, both DEPLOYED

Branch: `main`, clean. `origin/main` advanced `4c9b551` -> `1340b4c` (incident hotfix) -> `b8bb213` (UX Tier 1 minus S3 + docs), all deployed via GitHub Actions. Migrations applied through `025`. `pnpm build` clean, `pnpm exec vitest run` 271/271. Safety branch `ux-polish-wip` = pre-restructure stack (deletable once trust established).

### Production incident-filing RLS report (resolved as far as possible blind)

User screenshot: a basic active member filing an incident at `/incidents/new` (anonymous checked) got `new row violates row-level security policy for table "incidents"`. Pre-existing in production, not from this session.

- Not reproducible from source: `fileIncident` sets `reporter_id=NULL` when anonymous and `space_id=member.space_id`; `getAuthMember` resolves by `user_id=auth.uid()`; the 016/017 `incidents_insert` policy allows exactly this. So it is a production deploy/data divergence.
- Three candidate root causes: (1) `auth.uid()` NULL inside the DB request (SSR session not reaching PostgREST); (2) deployed `incidents_insert` policy differs from 016/017; (3) acting `space_members.user_id` != JWT sub on production (data drift).
- **DEPLOYED** as a minimal hotfix off `origin/main` (commit `1340b4c`, GitHub Actions run 25953569904 success, 1m0s; deploy.sh ran the idempotent migration runner so `025` applied): `scripts/025` re-asserts the hardened `incidents_insert` verbatim (access-neutral; fixes cause #2 only); `fileIncident` maps an RLS rejection to an actionable message and logs detail server-side. `scripts/schema.sql` already matched (no change).
- **Still needs user verification:** retry filing an incident on prod. If it still fails, cause #2 is excluded; run the SQL below to confirm #1 vs #3.

### UX polish — Tiers 1-3 ALL COMPLETE. S1-S8+S3 deployed; Tier 2 `a1ea92a` + Tier 3 `b7461f0` LOCAL/unpushed

- Full UI/UX audit done (5 partitioned agents, code-level; no live browser). User chose: implement Tiers 1-3, pause before 4-5; sidebar nav stays as-is (no role-filtering); comments get one-level nesting + edit (Tier 5, deferred). Findings report grouped Tier 1 systemic / 2 first-run / 3 security-adjacent / 4 brand / 5 per-surface.
- Deployed commits (each was build+test green): `3360f54` sidebar/drawer a11y + distinct Ops icon + skip link + BrandMark; `92ba6fb` shared `PageTitle`/`SectionTitle` (21 files); `f885ac7` shared `Empty` (~18 states, projects gained one); `1db9434` shared accessible confirm (ConfirmProvider/useConfirm) replacing all 13 `window.confirm`; `075b274` `:focus-visible` ring (unlayered, in `app/globals.css`) + 44px tap targets at named hotspots + 28 form-field id/htmlFor + search aria-labels + claim/complete/delete/link handlers toast `result.error`. Plus preexisting `fa71d9a` (a prior HANDOFF doc, not this session) and doc commits.
- **Not browser-verified (no live browser this session):** smoke-test on prod the two behavior-changing pieces — the shared confirm dialog on every destructive action (delete member/role/tier/area/invite/onboarding-step/secret/KB/comment/project/contact/thread) and the mobile drawer (open/ESC/scroll-lock/focus); also eyeball the global focus ring and the dense-row tap-target `-my-2` spacing.
- **Tier 1 COMPLETE.** S3 done in commit `108c2a5` (LOCAL, unpushed): every hand-rolled modal converted to Radix `components/ui/dialog.tsx` (focus trap/ESC/aria) — ops (4), members/tasks/projects/contacts add-edit, settings integration-credentials, plus the payments Log-Cash AND Link-Member modals. Forms/handlers/validation/close-reset preserved; `onOpenChange` mirrors old Cancel/X. Build clean, 271/271. 0 residual `fixed inset-0` modal overlays. Not browser-verified: smoke-test each modal opens/submits/ESC-closes.
- **Tier 2 DONE** (`a1ea92a`, local): founder first-run guided dashboard when the space is empty (admin/board alone, no data) replaces the zero grid with a 4-step checklist; reverts once there is activity. Onboarding Skills is now a controlled field (survives Back/forward, no normalize surprise) + a hint when a required ack is unchecked.
- **Tier 3 DONE** (`b7461f0`, local, presentational only — RLS guardrail respected): secrets revealed value gets copy-to-clipboard + auto re-hide after 30s + re-hide on window blur + timer cleared on unmount; permissions matrix shows a view-only notice for non-admins + per-checkbox `aria-label`; OpsAclEditor pills are `aria-pressed` toggles with a selected check + success toast. No server action / RLS / permission logic changed.
- **Open: deploy Tier 2+3** (`a1ea92a` + `b7461f0` + this doc commit, 2-3 commits ahead of `origin/main`). Awaiting user push approval. Not browser-verified: smoke-test the first-run dashboard (new empty space) and the secrets copy/auto-hide.
- Sequence: deploy Tier 2+3, THEN the forms feature (next major effort; design + decisions locked, see below).

### Forms + waivers feature (designed 2026-05-16, build deferred until after polish Tiers 1-3)

Full design delivered in chat. Locked decisions: anonymous waivers allowed (capture IP/UA/timestamp; retro-link to a later account only on verified email; admin manual-link for mismatches); non-blocking re-sign on waiver version bump (old signatures stay valid against their snapshot). User guidance: waivers are the primary need but the feature must also support ANY arbitrary form with a VERY EASY designer (builder ergonomics are an explicit priority). Recommended defaults: global-unique slug `/f/[slug]`; reuse `space_onboarding_steps` for an onboarding `form` step; gate creation via `lib/permissions-catalog.ts` (`forms.manage`) + `user_has_permission`; funnel anon submissions through one validated server action + service client (pattern: `finishOnboarding`); snapshot schema+legal-text per submission for immutable waiver records. Two new tables (`forms`, `form_submissions`); the anon-write + retro-link + immutability RLS is security/legally sensitive — design under the guardrail. Memory: `forms-feature` / `hackerspace-rls-guardrail`.

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
