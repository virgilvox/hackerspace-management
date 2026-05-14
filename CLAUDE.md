# Working Agreement for Claude

This file is the standing brief for any Claude session in this repository. Read it before touching code, every session.

## Identity rules

- Never include Claude attribution in commits. No `Co-Authored-By: Claude`, no `Generated with Claude Code`, no emoji robot signatures. Commits must look like a human wrote them.
- Never include Claude attribution in pull request descriptions, code comments, or generated documents unless the user explicitly asks for it.

## Writing rules

- No emojis anywhere: not in code, comments, commits, PR bodies, docs, or chat replies. The user reads them as AI tells.
- No em dashes (`—`). Use a period, a colon, a semicolon, or parentheses depending on the sentence.
- No "AI language" patterns: avoid "Let me", "I'll go ahead and", "Sure!", "Certainly!", "delve", "leverage", "robust", "seamless", "comprehensive", "best practices", filler hedges, and breathless intros. Be direct and specific.
- No hype, no sales copy. Describe what something does, not how great it is.
- Code comments only when the WHY is non-obvious. Never comments that say WHAT the code does.

## Engineering rules

- Be cautious. Be careful. Be smart.
- Smart separation of concerns: server actions in `lib/`, UI in `components/` and `app/(app)/*-client.tsx`, data access through `lib/supabase/*`. Do not cross these lines without a reason you can defend in a sentence.
- Test-driven where practical: when changing a server action or a utility, write or update the test first. Tests live in `__tests__/` (Vitest) and `e2e/` (Playwright). New tests must run with `pnpm test` and `pnpm test:e2e` without extra config.
- Match the existing patterns. If you find yourself inventing a new abstraction, stop and ask why the current one is wrong.
- Do not refactor while fixing a bug. Land the fix. Refactor in a separate change.
- Do not introduce backwards-compat shims for code you wrote in the same session.
- Use parameterized queries through the Supabase client. Never build raw SQL with string concatenation.
- Validate input at the server-action boundary with Zod schemas from `lib/validations.ts`. Reject before you touch the database.

## Database rules

- The canonical schema lives in `scripts/schema.sql`. It must remain idempotent and runnable top-to-bottom on a clean Supabase project.
- When you add a column, table, enum, or policy, add it to `scripts/schema.sql` AND add a numbered incremental migration in `scripts/` named `NNN_short_description.sql` so existing deployments can upgrade.
- When you change a column on an existing deployment, the incremental migration runs first, then `scripts/schema.sql` is updated to match.
- Never break RLS. Every new table starts with `ENABLE ROW LEVEL SECURITY` and explicit policies for SELECT, INSERT, UPDATE, DELETE before it is merged.
- Enum changes require a migration, never a re-create. `ALTER TYPE ... ADD VALUE` is the only safe path.
- After any schema change, refresh `types/database.ts` and update `DB_SCHEMA_MAP.md`.

## Deployment rules

- A fresh clone must produce a working app with no more than: clone, `pnpm install`, copy `.env.example` to `.env.local` with real values, run `scripts/schema.sql` in Supabase, `pnpm dev`.
- A fresh production deploy (Vercel, DigitalOcean App Platform, Droplet) must be documented in `docs/DEPLOYMENT.md` step by step, no implicit knowledge required.
- Any new environment variable must be added to `.env.example` in the same change that introduces it. Never let a deploy fail because an env var was only documented in a Slack thread.
- The Dockerfile and docker-compose configuration in the repo are the source of truth for self-hosted deploys. Update them when the runtime requirements change.

## Documentation rules

- Always document. If you add a feature, a server action, or a table, update the relevant doc in the same change:
  - `docs/ARCHITECTURE.md` for structural changes
  - `docs/API_REFERENCE.md` for new server actions
  - `docs/DATABASE_SCHEMA.md` and `DB_SCHEMA_MAP.md` for schema changes
  - `docs/DEPLOYMENT.md` for new env vars or new deploy steps
- Documentation describes the system as it is, not as it might be. Mark known gaps with a clear "Not implemented" or "Planned" so readers do not mistake intent for reality.

## Handoff rules

- For long sessions (anything over ~30 minutes of active work, or any session that touched more than three files), update `docs/HANDOFF.md` at the end of the session.
- A handoff entry includes: date in `YYYY-MM-DD`, branch name, what changed, why, what is still open, and any pending decisions the user needs to make.
- A handoff is a one-screen read. Bullets, not paragraphs.

## Authorization rules

- Do not run destructive git operations without explicit user confirmation: `push --force`, `reset --hard`, `branch -D`, `clean -f`.
- Do not commit, push, or open a pull request unless the user asked for it. Authorization is per-request, not standing.
- Do not skip pre-commit hooks (`--no-verify`). If a hook fails, fix the underlying problem.

## When in doubt

Ask. The cost of a clarifying question is small. The cost of a wrong action is large.
