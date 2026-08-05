The payments and dues subsystem records money that comes into your space and maps it to members. This page is the authoritative reference for the payment enums, the advance-only dues rule, admin-configured pay-here links, and the Stripe billing fields. For the day-to-day workflow, see [/payments](/payments) and the member self-view at [/me](/me).

## Payment platforms

The `payment_platform` enum tags every payment and every pay-here link with its origin. Only these five values exist.

| Value | Meaning | Pay-here link | In-app checkout |
| --- | --- | --- | --- |
| `paypal` | PayPal | Yes | No |
| `zeffy` | Zeffy | Yes | No |
| `venmo` | Venmo | Yes | No |
| `cash` | Cash logged by a treasurer | No | No |
| `stripe` | In-app recurring dues integration | No | Yes |

The url-based subset (`paypal`, `zeffy`, `venmo`) is the only set allowed for external pay-here links (`DUES_LINK_PLATFORMS`). `cash` and `stripe` cannot be configured as external dues links.

## Link status

Every row in `payments` carries a `payment_link_status`, which records whether the payment has been matched to a member.

| Value | Meaning |
| --- | --- |
| `unlinked` | Not yet matched to a member (the default) |
| `linked` | Matched to a member in this space |

Two columns hold this value: `link_status` is canonical, and `status` is kept for backward compatibility. Both default to `unlinked`. A cash payment logged with a member is inserted as `linked`; imported CSV rows and unmatched platform payments start `unlinked`. Linking via [/payments](/payments) sets `link_status` to `linked` and stamps `member_id`. The unlinked count drives the alert badge on the [/dashboard](/dashboard).

## Advance-only dues rule

When a linked payment updates a member's dues state, the state can only move forward in time. This is enforced by `resolveDuesAdvance`, which compares the member's existing `last_paid_at` against the incoming payment's `transaction_date`:

- If the incoming payment is the same as or newer than what is on file, `last_paid_at` advances to the incoming date and the member's `payment_status` is set to `current`.
- If the incoming payment is older than what is on file, `last_paid_at` is left unchanged and `payment_status` is not touched.

A backdated or historical payment therefore never moves a member's dues state backward. Comparison is by instant, not string order, so timezone offsets and `Z`-suffixed timestamps never disagree. The rule runs on both cash logging and payment linking.

## Pay-here links (`dues_payment_methods`)

Admins configure external pay-here links so members can pay dues off-platform; a treasurer reconciles the payment manually later through the [/payments](/payments) flow (the platform tag pre-types that reconcile). Configuration is link-only, no automated payment record is created.

| Column | Type | Notes |
| --- | --- | --- |
| `platform` | `payment_platform` | One of `paypal`, `zeffy`, `venmo`; unique per space |
| `url` | text | Must be an absolute `https://` URL (DB CHECK `url ~* '^https://'`) |
| `instructions` | text | Optional memo hint, e.g. "put your member name in the note" |
| `is_active` | boolean | Only active links render to members; defaults to `true` |
| `sort_order` | integer | Display order, `0`-`999`; defaults to `0` |

There is at most one link per `(space, platform)`; saving is an idempotent upsert on that pair. The [/me](/me) self-view shows only active links, in `sort_order`; the [/settings](/settings) admin UI shows every configured method, active and inactive.

### URL safety

Because `url` is rendered as a member-clickable anchor and admins can write the row directly through RLS, the `https://`-only rule is enforced at three layers: the DB CHECK constraint, the Zod schema (`isSafeDuesUrl`, max 500 chars), and the read boundary that feeds the clickable card. `http://`, `javascript:`, `data:`, and other non-https schemes are rejected everywhere.

### Permissions

| Operation | Roles |
| --- | --- |
| View active links ([/me](/me)) | Any space member |
| View all links, create, update, delete ([/settings](/settings)) | `admin`, `board` |

## Stripe billing fields (`member_billing`)

Stripe recurring dues uses per-space own keys (not Connect). Each member with a Stripe subscription has one row in `member_billing`.

| Column | Type | Notes |
| --- | --- | --- |
| `stripe_customer_id` | text | The member's Stripe customer |
| `stripe_subscription_id` | text | The active subscription |
| `subscription_status` | text | Raw Stripe subscription status |
| `current_period_end` | timestamptz | End of the paid period; drives the grace window |

Two service-client paths write this table: the Stripe webhook, and `startDuesCheckout`, which upserts `stripe_customer_id` when it first creates the member's Stripe customer. SELECT is limited to `admin`, `board`, and `treasurer` via RLS. A member reads their own row through a validated service-client action ([/me](/me)). The admin dues view lists every member's billing status.

### Status mapping

Raw Stripe `subscription.status` maps to a member status. Dues lapse tops out at `late`, it never auto-sets `inactive`; an admin decides inactivation manually.

| Stripe status | Member status |
| --- | --- |
| `active`, `trialing` | `current` |
| `past_due` (within grace) | `current` |
| `past_due` (grace exceeded) | `late` |
| `canceled`, `unpaid`, `incomplete`, `incomplete_expired` | `late` |

The grace window is `current_period_end` plus the configured `grace_days` (default `7`). Stripe settings live in `integrations.config`: `mode` (`test`/`live`), publishable key, the tier-to-price map, `grace_days`, and the secret/webhook refs. The secret key and webhook signing secret are stored in the encrypted [secrets vault](/docs/explanation/security-model), not in `config`. See [/settings](/settings) to configure Stripe.

## Related pages

- [/payments](/payments), log, import, link, and reconcile payments
- [/me](/me), member dues self-view, pay-here links, and Stripe checkout
- [/settings](/settings), configure Stripe and pay-here links
- [Members: statuses, tiers & fields](/docs/reference/members), member statuses, tiers, and fields
