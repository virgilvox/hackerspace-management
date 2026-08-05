hackerspace.sh treats every space as an isolated tenant and assumes the network is hostile: the browser is never trusted to say who you are or what you may do. This page explains the layers that enforce that assumption, Postgres Row Level Security, server-derived identity, the encrypted secrets vault, the authorization gates inside every server action, and input validation, and why each layer exists even when another already covers it.

## Defense in depth, not a single wall

There is no one place where security "happens." A write travels through several independent checks, and any one of them can reject it:

```
browser → proxy (session) → (app) layout (re-check) → server action
        → validate → authorize → space-scope → Postgres RLS
```

No layer trusts the layer above it. The proxy gates routes, the layout re-checks the user, the action re-derives identity and re-authorizes, and Postgres RLS filters rows one last time. If a bug opens a hole in one layer, the next one is still standing.

## Server-derived identity

The browser never tells the server who the caller is. Every server action starts from the session cookie and asks Supabase Auth directly:

```ts
const { data: { user } } = await supabase.auth.getUser()
```

From that verified `user.id`, `getAuthMember` (in `lib/auth-helpers.ts`) loads the caller's active `space_members` row and returns their real `role`, `status`, and `space_id`. Client code cannot supply any of these. If a request body contained a `space_id` or `role` field, it would be ignored, the action uses the derived membership, not the payload.

Two details harden this:

- **Active-only.** `getAuthMember` accepts only the `ACTIVE_STATUSES` (`current`, `unverified`, `late`); an `inactive` member is blocked from every action.
- **Fail closed.** The lookup uses `.single()`. If a user somehow had two active memberships, the query errors and no action runs, rather than silently picking a space.

See [The permissions model](/docs/explanation/permissions-model) for how a role becomes a concrete set of capabilities.

## Authorization gates in server actions

Once identity is derived, the action authorizes it. `requireMemberWithRole(supabase, allowed)` enforces two conditions before returning the member:

1. The member's status is privilege-eligible, `PRIVILEGE_STATUSES` is `current` and `late` only. An `unverified` member awaiting approval in a `require_approval` space holds **no** privileged capability, even if they redeemed a role-bearing invite code. Without this gate, redeeming an admin invite would grant instant admin.
2. The member's role is in the `allowed` set.

Only then does the action run its query, and it must scope that query to the caller's own space with `.eq('space_id', member.space_id)`. This scope is mandatory on the `admin` (service-role) client, which bypasses RLS entirely, there, the code-side scope is the only thing standing between the caller and a cross-tenant (IDOR) leak.

## Row Level Security as the backstop

RLS is enabled on every tenant table. The RLS-bound `server` and `client` clients are filtered by Postgres regardless of what the application code does. Read policies reduce to one predicate, evaluated by a `SECURITY DEFINER` helper:

```sql
USING (space_id IN (SELECT public.get_user_space_ids(auth.uid())))
```

Sensitive tables narrow further by role via `user_has_role_in_space(...)`, `secrets` are admin/board only, `payments` is treasurer and up, and the `knowledge_base` `visibility` column (`all_members`, `board`, `admin_only`) is enforced in the SELECT policy itself.

### The self-role-change trap

RLS deliberately lets a member update *their own* `space_members` row so they can fix their display name or handle. That opens an escalation path: a member could issue a direct PostgREST `PATCH` setting `role = 'admin'` on themselves. The `prevent_member_self_role_change` trigger closes it. On every self-update by a non-privileged member, it rejects any change to `role`, `tier`, `status`, `approved`, `has_card_access`, or `space_id` with a `42501` error. Only a member who already holds `admin`/`board`/`treasurer` in that space may touch those columns.

## The encrypted secrets vault

Third-party credentials (Stripe keys, door-controller bearer tokens, API keys) are never stored in plaintext. `lib/secrets/crypto.ts` encrypts them with **AES-256-GCM**:

- The master key comes from `SECRETS_ENCRYPTION_KEY` (64 hex characters, 32 bytes). The module is server-only; the key is never reachable from the browser.
- Each secret gets a fresh 12-byte IV on every encrypt. The stored `encrypted_value` is `iv (12) || ciphertext || authTag (16)`, tagged with `encryption_version = 1`.
- GCM's authentication tag means decryption fails on any tampered ciphertext; payloads shorter than the IV-plus-tag minimum are rejected before the crypto primitive runs.

Secrets are written only through server actions and the `storeSecret`/`readSecret` vault helpers, and are never returned to a client. Fields are routed into the vault by naming convention (`isSecretConfigField`): keys like `api_key`, `client_secret`, or anything ending in `_secret`, `_token`, or `_password` are encrypted, while derived `_set`/`_ref` markers are not.

## Input validation

Before authorization even runs, every action validates its input with a Zod schema through `parseInput`, which returns a discriminated result and rejects malformed data with a first-error message. Validation is the outermost gate: bad input never reaches the authorization check or the database.

## Public endpoints self-authenticate

A handful of routes are intentionally session-less, Stripe webhooks, inbound door events, cron jobs, public forms under `/f/*`, and `/track`. Each carries its own proof instead of a cookie: Stripe verifies a per-space signing secret with a replay guard, door callbacks compare a per-connection vault bearer with `timingSafeEqual`, crons check `CRON_SECRET`, and `/track` uses a 192-bit token.
