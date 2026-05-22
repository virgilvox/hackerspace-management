# Optional: self-hosted error monitoring (GlitchTip)

The app reports server-side errors (the Stripe webhook, the cron dispatchers,
and every server action via `onRequestError`) to any Sentry-compatible backend
named by the `SENTRY_DSN` env var. With `SENTRY_DSN` unset the capture seam is a
no-op, so error monitoring is entirely optional and the app runs fine without it.

This directory is a self-contained, batteries-included way to run that backend
yourself with [GlitchTip](https://glitchtip.com) (open-source, Sentry-API
compatible). It brings its own Postgres + Redis and shares nothing with the app
stack, so it works on any Docker host. You can equally point `SENTRY_DSN` at
Sentry SaaS instead and skip this entirely.

## Bring it up

```sh
cd deploy/glitchtip
cp .env.example .env
# set POSTGRES_PASSWORD and SECRET_KEY (openssl rand -hex 32)
docker compose up -d
```

`migrate` runs once automatically, then `web` + `worker` start. The dashboard
binds to `127.0.0.1:8100` only (port 8100 by default so it does not collide with
Supabase's Kong gateway on 8000; no public surface). Reach it either by:

- an SSH tunnel: `ssh -L 8100:127.0.0.1:8100 you@your-host` then open
  `http://localhost:8100`, or
- your own reverse proxy / TLS in front of `127.0.0.1:8100` (set
  `GLITCHTIP_DOMAIN` to that URL).

## Connect the app

1. In GlitchTip: register the first user, create an Organization, then a
   Project (platform: Node/JavaScript). Copy the Project's **DSN**.
2. Set `SENTRY_DSN=<that DSN>` in the app's environment and restart the app.
   (For the localhost setup the DSN host will be `localhost:8100`; the app
   reaches GlitchTip over the loopback on the same host.)
3. Turn off open registration: set `ENABLE_OPEN_USER_REGISTRATION=False` in
   `.env` and `docker compose up -d`.

## Notes

- Resources: the capped stack needs roughly 1.5-2 GB RAM. On a small host add
  swap first.
- Reproducibility: the `glitchtip/glitchtip` image is pinned to a release tag
  in `docker-compose.yml` (currently `6.1.6`). Bump it deliberately rather than
  tracking `latest`.
- Updates: edit the pinned tag, then `docker compose pull && docker compose up -d`
  (re-runs `migrate`).
