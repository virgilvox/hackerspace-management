## Database Setup

> For full deployment instructions (Vercel, DigitalOcean App Platform, Docker on a Droplet), see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

### Fresh deployment

Run **one file** in Supabase SQL Editor:

```
scripts/schema.sql
```

This creates the entire schema from scratch — all tables, enums, indexes, RLS policies, functions, and triggers. Idempotent, can be run multiple times safely.

### Existing deployment migration

If you have a legacy Hackerspace database and want to sync it to the canonical schema:

```
scripts/012_canonical_sync.sql
```

This migration adds all missing columns, renames `full_name` → `display_name`, creates missing constraints, fixes the auth trigger, and updates all other tables to match the canonical schema. Also idempotent — safe to run multiple times.

### Migration history (reference only)

Scripts `001_*` through `011_*` represent the evolution of the live database. **Do not re-run them.** They exist for historical reference.

### What `schema.sql` contains

| Section | Contents |
|---------|----------|
| Extensions | `uuid-ossp` |
| Enums | 14 custom types (`member_role`, `task_status`, `payment_platform`, etc.) |
| Helper functions | `get_user_space_ids`, `user_has_role_in_space` |
| Tables | 13 tables: `spaces`, `space_members`, `tasks`, `projects`, `payments`, `contacts`, `knowledge_base`, `secrets`, `area_leads`, `integrations`, `comms_channels`, `comms_messages`, `activity_log` |
| Indexes | 22 performance indexes on foreign keys and common filters |
| RLS policies | Full row-level security on all tables (access gated by space membership) |
| Triggers | `on_space_created` (auto-creates 4 default channels), `on_auth_user_created` (auth signup hook) |
