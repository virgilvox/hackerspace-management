Most hackerspaces collect dues through tools they already use — PayPal, Venmo, Zeffy, cash, and increasingly Stripe. Reconciliation is the work of turning that scattered money trail into a trustworthy answer to one question: is this member paid up? This page explains the two ideas that make that answer safe — dues that only ever advance, and payments that link to members by hand or automatically.

## Two separate ledgers

The platform keeps money and membership state in two places on purpose.

A row in `payments` is an immutable record of a transaction: an amount, a `platform` (`paypal`, `zeffy`, `venmo`, `cash`, or `stripe`), a `transaction_date`, and identifying scraps like `from_identifier`, `from_note`, and `payer_email`. It answers "money moved."

A member row answers "membership state" — the `status` enum (`current`, `late`, `inactive`, `unverified`), a `payment_status` field, and `last_paid_at`. Reconciliation is the bridge between the two: attaching a payment to a member, then letting that payment update the member's dues state.

Keeping them separate means a payment is never rewritten to fit a member. See the [payments & dues reference](/docs/reference/payments-and-dues) for every field.

## Why dues only advance

The core rule lives in `resolveDuesAdvance` (`lib/dues-payments-logic.ts`): a payment may move a member's dues state *forward* in time, never backward.

When a payment is applied, the logic compares the payment's `transaction_date` against the member's existing `last_paid_at` and keeps whichever is later. Only when the incoming payment is genuinely the most recent one on file does it also set the member's `payment_status` to `current`. A payment older than what is already recorded changes nothing — it returns the existing date and leaves the status untouched.

This matters because reconciliation is frequently retroactive. A treasurer imports six months of PayPal history, or belatedly links a cash payment from March. If applying an old payment could overwrite `last_paid_at`, a routine cleanup would rewind a member who is actually current back to "late." Advance-only makes the order of data entry irrelevant: you can link payments in any sequence and the member's standing always reflects their most recent real payment.

The comparison is done by instant, not by string, so timestamps from different sources (a PostgREST `+00:00` offset versus a JavaScript `Z` suffix) never disagree about which came first.

## Hand-matching and auto-matching

An imported or logged payment starts `unlinked` — its `link_status` is `unlinked` and it has no `member_id`. The `link_status` enum has exactly two values, `linked` and `unlinked`, and it is the canonical signal of whether a transaction has been reconciled. (An older `status` column mirrors it for backwards compatibility.)

**Hand-matching** is the treasurer's job. On [/payments](/payments), the unmatched pile shows each payment's amount, platform, and `from_identifier`, and the "Link to Member" action lets a treasurer, board member, or admin pick the right person. Linking sets `member_id` and flips `link_status` to `linked`, then runs the same advance-only logic so a historical payment cannot rewind dues. See [connect payments & reconcile dues](/docs/how-to/connect-payments) for the walkthrough.

**Auto-matching** happens for Stripe. When a Stripe invoice is paid, the webhook resolves the member automatically — from the subscription's `member_id` metadata, or by mapping the Stripe customer id to a member's stored `member_billing.stripe_customer_id` — and writes the payment already `linked`. The payer's email is recorded as `payer_email` only so a human can verify the match; it is never the match key. The member is identified from identifiers Stripe already carries, so no manual linking is needed.

Everything else is deliberately manual. Imports and cash payments land as `unlinked` rather than guessing, because a wrong auto-link silently credits the wrong member.

## Who is allowed to write dues state

Because dues state gates access and standing, only trusted actors may touch it. Migration `044` blocks a member from changing their own `payment_status`, `dues_paid_until`, `last_paid_at`, and related financial columns — even though row-level security otherwise lets members edit their own profile. A member cannot forge a "dues good" signal by writing directly to their row.

The only legitimate writers are the Stripe webhook and treasurer actions running as a privileged service client, or a privileged member (admin, board, or treasurer) editing *another* member. The [members reference](/docs/reference/members) covers how status flows through to access.

## Pay-here links, not payment processing

The `dues_payment_methods` table stores admin-configured pay-here links for PayPal, Zeffy, and Venmo — the URL a member clicks on [/me](/me) to pay off-platform. The platform never handles that money; it only hands the member a button. Because that URL is admin-entered and shown to members, it is constrained to absolute `https://` at three layers — a database `CHECK`, the admin form in [/settings](/settings), and one more check (`isSafeDuesUrl`) at the boundary that renders the clickable card — so a bad value can never become a downgrade or injection vector. After the member pays through the link, the transaction still comes back as an `unlinked` payment for a treasurer to reconcile by hand.
