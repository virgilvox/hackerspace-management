# Hackerspace.sh Documentation

> **Version**: 1.0.0  
> **Last Updated**: 2026-03-10  
> **Status**: Pre-Production

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System overview, tech stack, project structure, auth flows |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Complete schema reference, enums, relationships, RLS |
| [API_REFERENCE.md](./API_REFERENCE.md) | All server actions, parameters, return types |
| [COMPONENT_REFERENCE.md](./COMPONENT_REFERENCE.md) | React components, props, usage patterns |
| [PRODUCTION_AUDIT.md](./PRODUCTION_AUDIT.md) | Security audit, issues, action plan |

---

## Quick Start

### Development Setup

```bash
# Clone and install
git clone <repo>
cd hackerspace-sh
pnpm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run database migrations
# Execute scripts/001_create_schema.sql through scripts/011_*.sql in order

# Start development server
pnpm dev
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

---

## Application Overview

### What is Hackerspace.sh?

A comprehensive member management platform for hackerspaces, makerspaces, and community workshops. Features include:

- **Member Management** - Registration, approval, roles, payment tracking
- **Task System** - One-time tasks and recurring chores
- **Project Tracking** - Kanban-style project management
- **Payment Reconciliation** - Multi-platform payment integration
- **Communications** - Real-time chat via Supabase Realtime
- **Knowledge Base** - Documentation and secrets management
- **Contact Directory** - Vendors, suppliers, partners

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| UI | shadcn/ui component library |
| Backend | Next.js Server Actions |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Real-time | Supabase Realtime |
| Hosting | Self-hosted DigitalOcean Droplet (Docker, Caddy) |

---

## Key Concepts

### Spaces

A "space" represents a single hackerspace organization. Each space has:
- Unique slug and invite code
- Its own members, tasks, projects, etc.
- Independent settings and integrations

### Membership

Users belong to spaces via the `space_members` table:
- A user can belong to multiple spaces
- Each membership has a role (admin, board, treasurer, member, associate)
- Status tracks account state (current, late, inactive, unverified)

### Roles & Permissions

| Role | Capabilities |
|------|--------------|
| Admin | Full access to everything |
| Board | Members, payments, projects, board-level KB |
| Treasurer | Payments and financial data |
| Member | Tasks, projects, comms, public KB |
| Associate | Read-only, can claim chores |

### Row Level Security

All database access is protected by RLS policies:
- Users can only see data from their space
- Role-based write permissions
- Enforced at the database level

---

## Common Tasks

### Add a New Feature

1. Create page in `app/(app)/feature/page.tsx` (Server Component)
2. Create client component in `app/(app)/feature/feature-client.tsx`
3. Add server action in `lib/actions.ts`
4. Add navigation link in `components/app-sidebar.tsx`
5. Update types in `lib/types.ts` if needed

### Add Database Table

1. Create migration script in `scripts/0XX_description.sql`
2. Define table with RLS policies
3. Run migration via Supabase SQL Editor
4. Add TypeScript interface to `lib/types.ts`
5. Update `docs/DATABASE_SCHEMA.md`

### Add Server Action

1. Add function to `lib/actions.ts`
2. Include auth check: `supabase.auth.getUser()`
3. Include membership check
4. Include role check if needed
5. Add Zod validation (recommended)
6. Call `revalidatePath()` for cache
7. Update `docs/API_REFERENCE.md`

---

## Code Style

### TypeScript

- Use strict types, avoid `any`
- Define interfaces in `lib/types.ts`
- Use Zod for runtime validation

### React

- Server Components for data fetching
- Client Components for interactivity
- Use `'use client'` directive explicitly

### Styling

- Tailwind CSS utility classes
- shadcn/ui design tokens (`bg-background`, `text-foreground`)
- Monospace font for labels: `font-mono text-[10px]`

### File Naming

- Pages: `page.tsx`
- Client components: `feature-client.tsx`
- Server actions: `lib/actions.ts`
- Types: `lib/types.ts`

---

## Deployment

### DigitalOcean Droplet (production)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the at-a-glance flow and [DEPLOY_DO_SELFHOSTED.md](./DEPLOY_DO_SELFHOSTED.md) for the end-to-end provisioning procedure. Every push to `main` triggers GitHub Actions, which runs the deploy script on the Droplet over SSH.

### Database Migrations

Migrations must be run manually via Supabase SQL Editor:
1. Open Supabase Dashboard → SQL Editor
2. Run migration scripts in order
3. Verify with `SELECT * FROM pg_tables WHERE schemaname = 'public'`

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Not authenticated" | Check session, redirect to login |
| "No active membership" | User needs to create/join space |
| RLS policy error | Check user has correct role |
| Infinite redirect | Check middleware, layout redirects |
| Stale data | Call `revalidatePath()` or `router.refresh()` |

### Debug Mode

Add console logs in server actions:
```typescript
console.log('[app] User:', user?.id, 'Space:', member?.space_id)
```

View logs with `journalctl -u hackerspace-app -f` on the Droplet, or in the dev server terminal locally.

---

## Support

- GitHub Issues: Report bugs and feature requests
- Documentation: This folder
- Code: Well-commented in key areas

---

## License

[Add license information]
