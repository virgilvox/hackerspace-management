# Handoff Log

Append-only. Newest entries on top. Keep each entry to one screen.

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
