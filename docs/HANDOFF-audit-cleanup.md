# HANDOFF — audit / cleanup / architecture engagement

**Branch:** `audit/cleanup-architecture` (40 commits ahead of `main`, **not pushed**).
**Status:** all gates green — `tsc` 0 errors · `eslint` 0 errors · **645 tests** · `next build` ✓.
**Full audit + plan + progress log:** `docs/AUDIT-2026-08.md`. **Architecture:** `ARCHITECTURE.md`.

> ⚠️ `main` auto-deploys to production on push (`.github/workflows/deploy.yml` → SSH → droplet
> `deploy.sh`). Do **not** push to `main` until this branch is reviewed and you intend to deploy.

## What was done

Delivered against the original brief (audit → fixes → tests → refactor → docs), then a second
separation-of-concerns pass on top.

- **Type safety.** 586 → **0** `tsc` errors; removed `next.config` `typescript.ignoreBuildErrors`, so
  every build/deploy now type-checks. Root cause was the `@supabase/ssr` ↔ `supabase-js` version drift
  (schema collapsed to `never`), fixed by annotating the client factories (no dependency bump).
- **Tooling / CI.** Added ESLint 9 flat config (`eslint.config.mjs`), a `typecheck` script, and a
  checks-only CI workflow (`.github/workflows/ci.yml`: typecheck + lint + unit tests), separate from deploy.
- **Confirmed bugs fixed** (one commit + regression test each): invite `max_uses` TOCTOU (atomic CAS),
  board invite re-arming, `appealIncident` admin-gate + orphan rollback, SSRF hex-IPv6, payment dues
  regression (advance-only) + payment `member_id` IDOR scoping, three null-deref crashes, broken
  member-directory visibility gate, equipment/proposals scoping + unverified-member gating, door-log
  parser, CSV-import hang, and a **plaintext-secrets** security bug (ops "Add Secret" wrote the value
  unencrypted from the browser — now via `createSecret`, AES-GCM).
- **Tests.** Replaced a tautological `actions.test.ts` (asserted string literals) with real authz/IDOR
  tests; added authz-primitive tests and per-fix regression tests.
- **Refactor (all 10 slices).** `lib/validations.ts` (143 exports) → `lib/validations/*` barrel;
  `lib/types.ts` → `types/domain/*`; `lib/actions/{classes,door,forms}.ts` → per-capability folders behind
  the `lib/actions` barrel; the 663–956-line `ops`/`settings`/`members` client components decomposed into
  thin orchestrators + `panels/`+`components/` (also fixed a form-field-focus footgun); dead code removed.
  `types/database.ts` is left pristine (regenerate, don't hand-edit).
- **Separation of concerns.** **No client component writes to the DB directly anymore.** The ops
  area-lead roster and the comms message send were the last holdouts — both now go through server actions
  (validated, authz-gated, space-scoped, audited); comms derives sender identity server-side (was
  impersonation-prone). Only browser-client usage left: auth (login/signup) and the comms realtime read.
- **Verification.** A re-audit found **zero refactor regressions** (every authz gate + `space_id` scope +
  handler independently verified across the splits/decompositions). A final independent adversarial review
  of the separation-of-concerns commits found **no introduced bug, security hole, or regression**.

## How to verify (from a clean checkout of the branch)

```
pnpm install --frozen-lockfile
pnpm run typecheck   # 0 errors
pnpm run lint        # 0 errors (warnings are tracked debt)
pnpm run test:run    # 645 pass
pnpm build           # compiles + type-checks all routes
```

## What is NOT done / residual risk

1. **Full authenticated UI testing did not run** — the dev environment had no Docker → no local Supabase.
   Public pages + routing were browser-smoke-tested (render clean; authed routes redirect to `/login`),
   and all routes compile via `next build`, but the decomposed **ops/settings/members** screens were not
   clicked through against real data. **Do a manual smoke-test against a real backend before merge.**
2. **`types/database.ts` needs regeneration** against the live schema (`supabase gen types typescript
   --schema public > types/database.ts`). That removes 3 hand-added RPC entries and ~11 `// TODO(types)`
   join casts, and lets the governance rows in `types/domain/governance.ts` collapse to `Tables<>`/
   `Enums<>`. Needs DB credentials. **Highest-leverage next step.**
3. **Deferred bug L3** — `markOnboardingStepDone` read-modify-writes a JSON column; a concurrent
   double-submit can drop a step. Needs a DB-side atomic append (RPC / jsonb operator + migration).
4. **CI runs only unit tests** — the integration + Playwright e2e suites need a DB service wired in
   (and the run should fail on 0 executed integration tests so a missing DB can't masquerade as passing).
5. **Pre-existing comms realtime dedup edge case** (`app/(app)/comms/comms-client.tsx` ~L82) — two
   identical messages fired in quick succession before the first realtime event lands can collapse onto
   one row (duplicate render / duplicate React key). Not introduced by this work (the old direct-insert
   path had the same race); the robust fix is a client-generated message id / nonce for dedup.
6. **Commit granularity caveat** — commits are logically split (one per fix), and most were gated before
   commit; a few in the final SoC round were split from a combined working tree and were not each
   independently `tsc`/test-gated. The **final tree is fully green**. If you need per-commit bisectability,
   verify per commit or squash-merge.

## Recommended merge path

Review Phases A + B + CI first (low-risk, high-value: type safety, bug fixes, tests). Then the refactor
slices (structural, verified by tsc + build + tests). Then the SoC pass. Merge via PR; a squash or
merge-commit is fine. After merge to `main` it deploys — have the manual UI smoke-test done first.
