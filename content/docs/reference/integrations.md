The platform reaches the outside world through three server endpoints: a notification dispatcher cron that drains the email outbox, two inbound door transports (a poll and a webhook), and the Resend email transport behind them. All three are session-less and authenticated by a shared secret or a per-connection bearer secret, never by a logged-in user. This page documents their contracts, environment variables, and behavior.

## Environment variables

These control delivery and cron authentication. The ones that govern integrations are:

| Variable | Purpose | Unset behavior |
|----------|---------|----------------|
| `RESEND_API_KEY` | Resend HTTP API key for transactional email. | Outbox still fills; each row is recorded `failed` with "transport not configured" (non-retryable). |
| `EMAIL_FROM` | From address for all platform email, e.g. `HeatSync Labs <noreply@hackerspace.sh>`. Domain must be verified in Resend (SPF + DKIM). | Same as unset `RESEND_API_KEY`: sends no-op as failed. |
| `CRON_SECRET` | Shared secret guarding both cron endpoints. Generate with `openssl rand -hex 32`. | Both cron routes return `503` and never run. |
| `SENTRY_DSN` | Optional Sentry-compatible error backend; both cron dispatchers and the webhook report to it. | Capture seam no-ops. |

The two cron endpoints reuse the same `CRON_SECRET`. The door webhook does not use it — it authenticates on a per-connection secret from the vault.

## Notification dispatcher — `POST /api/cron/notifications`

Transactional email is an outbox (the `notifications` table). The Stripe webhook and other server actions only enqueue rows; nothing sends inline. This endpoint drains the outbox and is meant to be hit once a minute by the droplet crontab.

- Auth: `Authorization: Bearer <CRON_SECRET>`, compared in constant time. Returns `503` if `CRON_SECRET` is unset, `401` on mismatch.
- Selects up to 200 oldest `pending`, `channel = 'email'` rows under the attempt cap, then round-robin fair-drains up to 20 across spaces so one tenant's burst cannot head-of-line-block others.
- Sends are spaced ~220 ms apart (~4.5/sec) to stay under Resend's 5 req/sec limit.
- Idempotent and safe to overlap: there is no row lock, but each send carries a per-attempt `Idempotency-Key` of `${id}:${attempts}`, so concurrent runs of the same attempt dedupe at Resend.
- Response body: `{ scanned, sent, failed, retried, skipped }`.

### Outbox row lifecycle

| Status | Meaning |
|--------|---------|
| `pending` | Awaiting send or awaiting retry. |
| `sent` | Delivered to Resend; `sent_at` set. |
| `failed` | Terminal: permanent (config/validation) error, or attempt budget exhausted. |
| `skipped` | Terminal: the recipient muted this category (never sent, no Resend call). |

A row retries on transient failures (`429`, `5xx`, network) up to `MAX_NOTIFICATION_ATTEMPTS` (5) before going to `failed`. Every status write is guarded on `status = 'pending'`, so a losing overlapping run is a no-op.

## Notification preferences and muting

Members opt out of muteable categories from their profile at [/me](/me); the toggles write per-member rows the dispatcher reads. Billing notices are membership-critical and can never be muted.

| Category | Muteable | Example types |
|----------|----------|---------------|
| `billing` | No | `dues_renewed`, `dues_payment_failed`, `dues_lapsed` |
| `bookings` | Yes | `booking_confirmed`, `booking_cancelled` |
| `classes` | Yes | `class_signup_registered`, `class_signup_waitlisted`, `class_signup_promoted`, `class_session_cancelled` |
| `forms` | Yes | `form_submission_received` |
| `admin_alerts` | Yes | `form_submission_admin` |

The model is opt-out: an absent preference row means enabled. A type with no category mapping is treated as always-on (fail-open). When the dispatcher marks an email `skipped`, the notification still appears unread in the member's in-app inbox on [/me](/me) — the `read_at` marker is independent of email delivery.

## Door inbound — poll vs. webhook

A space that runs a door controller can pull real entry/denied events into the access log through one of two transports, both configured per connection on [/door/manage](/door/manage) (requires the `door.manage` permission — see [Access control](/docs/reference/access-control) and [Connect a door](/docs/how-to/connect-a-door)). Both share one ingest core; ingested rows dedupe on `(connection_id, dedupe_key)`.

### Poll — `POST /api/cron/door-ingest`

For native-HeatSync controllers only. A once-a-minute crontab call reads each enabled connection's `?z` log through the hardened outbound executor and matches each card to a member.

- Auth: same `CRON_SECRET` bearer as the notification cron. `503` if unset, `401` on mismatch.
- Polls only connections with `is_enabled`, `inbound_enabled`, and `adapter = 'native_heatsync'`, up to 50 per run, concurrently.
- Idempotent: overlapping or missed minutes are harmless.

### Webhook — `POST /api/door/inbound/[connection]`

For generic (non-HeatSync) controllers or a LAN relay that pushes normalized events. This is the reliable transport: each event carries a caller-supplied stable id, so retries are idempotent.

- `[connection]` is the connection's UUID; a malformed id returns a generic `404`.
- Auth: `Authorization: Bearer <inbound secret>` — the per-connection secret from the AES-256-GCM vault (`inbound_secret_ref`), distinct from the outbound door password. A missing connection, disabled inbound, or bad secret all return the same `401`. The webhook URL is shown on [/door/manage](/door/manage) once inbound is enabled.
- Rate limited to 120 requests/minute per connection (`429` over that). Bodies over 64 KB are rejected `413`.

Request body:

```json
{
  "events": [
    {
      "id": "stable-caller-id",
      "card_uid": "optional-string",
      "card_number": "optional-digits",
      "result": "granted",
      "occurred_at": "2026-08-05T14:03:00Z"
    }
  ]
}
```

`events` holds 1–100 items. `result` is one of `granted`, `denied`, `unknown`. Provide `card_uid` and/or `card_number` (digits only) to resolve the event to a member. Valid requests return `{ "received": true, ... }` with per-batch insert counts; malformed JSON or a schema failure returns `400`.

## Email transport (Resend)

`lib/email/send.ts` is the single transport seam. It talks to Resend's HTTP API (`https://api.resend.com/emails`) with `fetch`, no SDK, so a self-hosted deploy can swap it for SMTP without touching any caller. It classifies each failure as retryable (`429`, `5xx`, network) or terminal (unset config, invalid recipient, other `4xx`), which is what drives the outbox retry-vs-`failed` decision above.
