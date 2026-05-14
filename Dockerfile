# syntax=docker/dockerfile:1.6
# -----------------------------------------------------------------------------
# Multi-stage build for Next.js (standalone output)
# -----------------------------------------------------------------------------
# Stage 1: deps      — install production + dev deps for the build.
# Stage 2: builder   — run `next build` with DOCKER_BUILD=1 to emit standalone.
# Stage 3: runner    — minimal runtime image, copies standalone server only.
# -----------------------------------------------------------------------------

ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS base
RUN corepack enable
WORKDIR /app

# ----- deps ------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ----- builder ---------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next.config.mjs keys `output: 'standalone'` off this env var.
ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* values are inlined at build time. Pass them as build args
# when the URL differs per-environment, or rely on runtime values for the
# anon key (Supabase ssr handles cookie-based auth without baking secrets).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN pnpm build

# ----- runner ----------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for the runtime process
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy the standalone server output and static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
