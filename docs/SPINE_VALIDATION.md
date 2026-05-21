# Spine Validation Runbook

The product spine (Stripe recurring dues, the transactional-notification outbox + dispatcher, the `/me` self-serve portal, notification breadth + per-member preferences + the in-app inbox) and the door epic are all shipped to production but **inert** until an owner provisions a handful of external credentials. Nothing sends email, runs a dues cycle, or talks to a door until then.

This runbook provisions everything in **test mode** and proves each path end to end. It is owner-executed: every step has an action and a **Verify** line. Do Part A (provisioning) in order, then Part B (validation). The copy-paste checklist is at the bottom.

Conventions: `APP` = your app domain (e.g. `hackerspace.sh`). `SPACE_ID` = the id of the space you are validating. Commands run on the Droplet unless noted; the app `.env` and the crontab are edited as root.

---

## Part A. Provisioning

### A1. Resend (transactional email)

1. Create a Resend account and **verify your sending domain** (add the SPF + DKIM DNS records Resend gives you). Until the domain is verified, `onboarding@resend.dev` only delivers to your own Resend account email, and `*@resend.dev` addresses only *simulate* outcomes.
2. Create an API key (starts with `re_`).
3. In the app `.env` set:
   - `RESEND_API_KEY=re_...`
   - `EMAIL_FROM=Your Space <noreply@your-verified-domain>`
4. Restart the app: `systemctl restart hackerspace-app`.

**Verify:** with `CRON_SECRET` also set (A2), run the dispatcher (A2 verify). Before A1, the dispatcher records each row as `failed` with "transport not configured"; after, rows go to `sent`. A quick check after B1 enqueues a real email.

### A2. CRON_SECRET + the two crontabs

1. Generate a secret: `openssl rand -hex 32`.
2. In the app `.env` set `CRON_SECRET=<that value>`. Restart the app.
3. Add two root crontab entries (`crontab -e`):

```
CRON_SECRET=<the same value you set in .env>
* * * * * curl -fsS -m 30 -X POST http://127.0.0.1:3000/api/cron/notifications -H "Authorization: Bearer $CRON_SECRET" >/dev/null 2>&1
* * * * * curl -fsS -m 30 -X POST http://127.0.0.1:3000/api/cron/door-ingest   -H "Authorization: Bearer $CRON_SECRET" >/dev/null 2>&1
```

Define `CRON_SECRET=` on its own line at the top of the crontab as shown. A crontab runs with a bare environment, so a `$CRON_SECRET` reference with no such line expands to empty: every call then silently 401s, and the `>/dev/null 2>&1` hides it.

**Verify:**
- `curl -s -o /dev/null -w "%{http_code}" -X POST https://APP/api/cron/notifications` (no auth) → **401**.
- With `CRON_SECRET` unset the same call returns **503** (fails safe).
- With the bearer: `curl -s -X POST https://APP/api/cron/notifications -H "Authorization: Bearer <CRON_SECRET>"` → **200** with `{"scanned":..,"sent":..,"failed":..,"retried":..,"skipped":..}`.
- The door poll: `curl -s -X POST https://APP/api/cron/door-ingest -H "Authorization: Bearer <CRON_SECRET>"` → **200** `{"ok":true,"polled":0,...}` (0 until a connection enables inbound, A5/optional).

### A3. Per-space Stripe (test mode)

Stripe is configured in exactly one place: **`/settings` → Dues tab** (the per-space `StripeBillingPanel`). Each space uses its OWN Stripe account (not Connect), so do this per space.

In the **Stripe Dashboard, test mode** (`https://dashboard.stripe.com/test`):
1. **Products + prices.** Create a Product and a recurring **Price** for each dues tier you offer. Copy each Price id (`price_...`).
2. **Secret key.** Copy your test secret key (`sk_test_...`) from Developers → API keys.
3. **Webhook endpoint.** Developers → Webhooks → Add endpoint. For the URL, paste the exact value the **Dues tab shows** (`https://APP/api/stripe/webhook/SPACE_ID`). Subscribe to: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Copy the signing secret (`whsec_...`).
4. **Billing Portal.** Activate the test-mode Customer Billing Portal at `https://dashboard.stripe.com/test/settings/billing/portal` (this is what powers "Manage Billing" on `/me`). Save the default config.

In the **app**, `/settings` → **Dues** tab:
5. Set **mode = test**, paste the **secret key** and the **webhook signing secret** (both are write-only and stored in the AES vault; a blank field on a later save keeps the existing value), map each **tier → Price id**, set **grace days** (default 7). Save.

**Verify:**
- `curl -s -o /dev/null -w "%{http_code}" -X POST https://APP/api/stripe/webhook/SPACE_ID` → **400** (missing/invalid signature; the path is live and signature-gated).
- The Dues tab shows "Stripe configured" and the mapped prices.
- On `/me`, the dues card now shows a **Pay dues with card** button (it is hidden until Stripe is configured).

### A4. Supabase Change-Email template + `/auth/confirm` allowlist

Needed for the `/me` self-service email change. Full steps are in [DEPLOYMENT.md](./DEPLOYMENT.md#member-email-change-supabase-auth-config--required):
1. Auth → URL Configuration: add `{APP_URL}/auth/confirm` to the redirect allowlist.
2. Auth → Providers → Email: keep "Secure email change" on.
3. Auth → Email Templates → "Change Email Address": point the link at `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`.

**Verify:** `/me` → change email → the confirmation link lands on `/auth/confirm` and completes the change (both old and new addresses confirm).

### A5. Door inbound (optional, only if a controller is reachable)

On `/door/manage`, open a connection's **Inbound** panel, choose a webhook secret (a vault secret), and turn inbound on. For a native HeatSync controller the A2 `door-ingest` crontab will poll its `?z` log; any controller/relay can instead POST to the per-connection webhook URL shown in the panel (with `Authorization: Bearer <that secret>`).

**Verify:** present a card at the door, then on the next minute (poll) or immediately (webhook) an `entry` row appears in the access log on `/door/manage`, matched to the member.

---

## Part B. End-to-end validation (test mode)

Run these as a real member of the space. Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.

### B1. Dues cycle (the money + email path)
1. `/me` → dues card → **Pay dues with card** → complete the hosted Stripe Checkout with the test card.
2. **Verify activation:** `checkout.session.completed` + `customer.subscription.created` fire; the member's status becomes/stays `current`, a `stripe` row appears in `/payments`, and a **dues renewed** email is enqueued. Within a minute the dispatcher sends it: check the recipient inbox AND the `/me` in-app inbox (it appears there even if email is muted).
3. **Manage Billing:** `/me` → **Manage Billing** opens the Stripe Billing Portal; confirm you can update the card and cancel.
4. **Payment failure:** in the Portal (or via a new subscription) use a failing test card such as `4000 0000 0000 0341`; `invoice.payment_failed` → a **payment failed** email.
5. **Lapse (optional, uses a Stripe test clock):** advance time past the period end + grace; `customer.subscription.updated` (past_due) drives status to `late` and a **dues lapsed** email. Status never auto-drops below `late`.

### B2. Booking notification
Reserve an item on `/equipment` (or its manage surface). **Verify:** a booking notification is enqueued and (per prefs) emailed + shown in the `/me` inbox.

### B3. Class signup notification
Sign up for a scheduled class session. **Verify:** a class notification is enqueued + delivered.

### B4. Form submission notification
Submit a form/waiver that has admin notification configured. **Verify:** the permission-holders receive a `form_submission_admin` notification.

### B5. Notification preferences + inbox
On `/me` → Activity → Email preferences, mute a muteable category (bookings/classes/forms/admin_alerts). Trigger that category again. **Verify:** the dispatcher marks the row `skipped` (shown as "Muted" in the history), no email sends, but the row still appears in the in-app inbox. Confirm a **billing** email (B1) is NOT muteable.

### B6. `/me` click-through
Profile editing (skills/interests chips), the dues card states (configured vs not), the Dues tab, inbox read/unread + "Mark all as read" + unread count.

### B7. Door + API buttons (only if A5 / a controller is set up)
Grant a card (`/door/manage`), member self-entry (`/doors` or the dashboard panel), inbound ingest (A5), then create an API-call button (`/door/buttons`, e.g. the door-control preset) and press it from `/doors`. **Verify:** each action writes a redacted row to the door/api-call log.

---

## Checklist

Provisioning:
- [ ] A1 Resend domain verified; `RESEND_API_KEY` + `EMAIL_FROM` set; app restarted
- [ ] A2 `CRON_SECRET` set; both crontabs added; 401/503/200 verified
- [ ] A3 Stripe test: products/prices, secret key, webhook endpoint (URL from the Dues tab) + signing secret, Billing Portal activated; Dues tab saved; webhook returns 400 to an unsigned call; `/me` shows Pay-with-card
- [ ] A4 Supabase Change-Email template + `/auth/confirm` allowlist; test email change completes
- [ ] A5 (optional) door inbound enabled; an entry ingests

Validation:
- [ ] B1 Checkout activates the member; dues-renewed email lands (real inbox + in-app inbox); Billing Portal opens; payment-failed email; (optional) lapse to `late`
- [ ] B2 booking notification
- [ ] B3 class-signup notification
- [ ] B4 form-submission admin notification
- [ ] B5 muting a category skips its email but keeps the inbox row; billing is never muteable
- [ ] B6 `/me` profile + dues + Dues tab + inbox all behave
- [ ] B7 (optional) door grant / self-entry / inbound / API button each audited

When every box is checked, the spine is proven, not just shipped.
