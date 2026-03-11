## Database Setup

> For full deployment instructions (Vercel, DigitalOcean App Platform, Docker on a Droplet), see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

### Fresh deployment

Run **one file**:

```
scripts/schema.sql
```

Paste it in Supabase → **SQL Editor → New query** and hit Run.  
That is the complete, idempotent schema — all tables, enums, indexes, RLS policies, functions, and triggers.

### Existing deployment

The numbered scripts (`001_*` → `011_*`) are the **migration history** of the live database.  
Do not re-run them. They are kept for reference only.

### What `schema.sql` contains

| Section | Contents |
|---------|----------|
| Extensions | `uuid-ossp` |
| Enums | 14 custom types (`member_role`, `task_status`, etc.) |
| Helper functions | `get_user_space_ids`, `user_has_role_in_space` |
| Tables | `spaces`, `space_members`, `tasks`, `projects`, `payments`, `contacts`, `knowledge_base`, `secrets`, `area_leads`, `integrations`, `comms_channels`, `comms_messages`, `activity_log` |
| Indexes | 22 performance indexes |
| RLS policies | Full row-level security on every table |
| Triggers | `on_space_created` (auto-creates 4 default channels) |
| Auth hook | `on_auth_user_created` (handles create-space and join-space signup flows) |
