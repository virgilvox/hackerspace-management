# Database scripts

This directory holds the SQL that defines the application's database. The application is multi-tenant per `spaces` row; every other table is keyed by `space_id`. Row-level security is mandatory.

## Two kinds of file

### `schema.sql`

The canonical, full-schema file. Run this **once** in a fresh Supabase project's SQL editor. It is idempotent: extensions, enums, tables, indexes, policies, triggers, and realtime publications are all wrapped in guards so re-running is safe.

Sections in order:

1. Extensions
2. Enums
3. Tables (in FK-dependency order)
4. Indexes
5. Helper functions (`get_user_space_ids`, `user_has_role_in_space`)
6. Row Level Security (drops before recreating)
7. Triggers and auth hook (signup hook, default channels, privilege-escalation guard)
8. Realtime publication membership

Anyone deploying for the first time needs only this file plus the environment variables documented in `.env.example`.

### `NNN_short_description.sql`

Incremental migrations for **existing** databases. Each file:

- Is named `NNN_short_description.sql` where `NNN` is the next zero-padded sequence number after the highest existing file in the directory.
- Does one focused thing.
- Is idempotent (`ALTER COLUMN ... DROP NOT NULL`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` then `CREATE TRIGGER`).
- Carries a short comment block at the top: background, what it does, safety notes.

When you add an incremental migration, you must also update `schema.sql` so that a fresh deploy ends up in the same final state.

## Current incremental migrations

| File | Purpose |
|------|---------|
| `014_member_user_id_nullable.sql` | Drops NOT NULL on `space_members.user_id` so offline members can be inserted by `addMember` / `importMembers`. |
| `015_prevent_member_self_role_change.sql` | BEFORE UPDATE trigger that rejects self-modification of role, tier, status, approved, has_card_access, space_id by non-privileged members. Closes a privilege-escalation hole. |
| `016_governance_kernel.sql` | Tier 1 of `docs/GOVERNANCE_FEATURES.md`: proposals + proposal_votes, incidents + incident_updates, policies. Plus six new `spaces` columns for governance defaults. Adds quorum-computing and tally-refreshing triggers. |
| `017_governance_rls_hardening.sql` | Closes four cross-tenant RLS holes in the governance kernel (votes_insert/update, incidents_insert, incident_updates_insert), plus a partial unique index so only one policy version per slug can be `active` at a time. |
| `018_member_state_and_visibility.sql` | Tier 2 + Tier 3: skills / interests / willing_to / affiliations / coi_last_disclosed_at columns on `space_members`; `financial_visibility` + `member_directory_visibility` settings on `spaces`; `is_meeting_minutes` + `meeting_date` on `knowledge_base`; auto-scheduled 180-day card-access review trigger; `inactive_members` view. |
| `019_proposal_expiry.sql` | `public.expire_proposals()` function that closes proposals whose `voting_closes_at` has passed: flips to `decided` if quorum was met, `expired` otherwise. Schedules itself hourly via `pg_cron` if the extension is enabled. |
| `020_areas.sql` | Per-space `space_areas` table (code, name, icon, sort_order, is_archived). Trigger seeds 10 sensible defaults on space creation; backfill populates existing spaces. RLS: members read, admin/board write, admin delete. |

### `seed.sql`

Demo data loader for local development. Run after `schema.sql` against an empty database to populate a "Demo Hackerspace" with five offline members (one per role), a policy, three tasks, a project, a KB entry, three proposals (open / draft / decided) with seven votes already cast, an open incident, and matching activity-log rows. Idempotent: re-running drops and reseeds the demo space without touching anything else.

Older migrations (001 to 013) lived in the original Supabase project and were collapsed into `schema.sql`. They are not in this directory.

## Workflow

When making a schema change:

1. Write the SQL as an incremental migration: `scripts/NNN_what_you_changed.sql`.
2. Apply the same change to `schema.sql` so fresh deploys land in the new state.
3. Re-run `schema.sql` against a scratch Supabase project to confirm it still completes without error.
4. Regenerate types: `supabase gen types typescript --project-id <ref> > types/database.ts`. If you cannot run the CLI, hand-edit `types/database.ts` to match and note it in the PR.
5. Update `DB_SCHEMA_MAP.md` if column names, defaults, or enum values changed.

## Naming

- Enums: singular, snake_case (`task_status`, not `task_statuses`).
- Tables: plural, snake_case (`tasks`, `space_members`).
- Foreign keys: `<other_table_singular>_id` (`space_id`, `member_id`).
- Timestamps: `created_at`, `updated_at`, `<action>_at` (`claimed_at`, `completed_at`).
- Policies: `<table>_<verb>` where verb is `select | insert | update | delete` (e.g. `members_insert`).

## Idempotency rules

- `CREATE TABLE IF NOT EXISTS` for every table.
- `CREATE INDEX IF NOT EXISTS` for every index.
- `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` for every enum.
- `DROP POLICY IF EXISTS ...` immediately before `CREATE POLICY ...`.
- `CREATE OR REPLACE FUNCTION` for every function.
- `DROP TRIGGER IF EXISTS ...` before `CREATE TRIGGER ...`.
- `DO $$ BEGIN ALTER PUBLICATION ... ADD TABLE ...; EXCEPTION WHEN duplicate_object THEN NULL; END $$` for realtime membership.

If you find yourself reaching for a non-idempotent statement, wrap it.

## Security baseline

Every new table must, before merging:

- Have `ENABLE ROW LEVEL SECURITY`.
- Have at least a SELECT policy and INSERT policy.
- Scope every policy by `space_id IN (SELECT public.get_user_space_ids(auth.uid()))` or a role check via `public.user_has_role_in_space(...)`.
- Be covered in `docs/DATABASE_SCHEMA.md` and `DB_SCHEMA_MAP.md`.

## Verifying a fresh deploy

```sql
-- After running schema.sql, sanity-check:
SELECT count(*) FROM pg_tables WHERE schemaname = 'public';
SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
SELECT count(*) FROM pg_trigger WHERE tgrelid IN (
  SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace
);
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

You should see roughly: 13 tables, around 45 policies, multiple triggers, and the two `comms_*` tables in `supabase_realtime`.
