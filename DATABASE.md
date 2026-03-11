## Database Setup

> For full deployment instructions (Vercel, DigitalOcean App Platform, Docker on a Droplet), see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

### Fresh deployment

Run **one file** in Supabase SQL Editor:

```
scripts/schema.sql
```

This creates the entire schema from scratch — all tables, enums, indexes, RLS policies, functions, and triggers. Idempotent, can be run multiple times safely.

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
