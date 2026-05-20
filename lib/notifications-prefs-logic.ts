// Member notification preferences: the pure category model plus the single
// mute decision. No I/O, no Supabase. The dispatcher consumes isMuted to decide
// whether to send an outbox row; the /me UI consumes CATEGORY_META to render the
// toggles. The notifications.type column stays free text, so adding a new event
// type only needs a line in TYPE_CATEGORY here (and a renderer) -- the prefs
// storage and the dispatcher do not change.

export type NotificationCategory =
  | 'billing'
  | 'bookings'
  | 'classes'
  | 'forms'
  | 'admin_alerts'

// Categories a member can mute. 'billing' is deliberately excluded: dues
// renewed / payment-failed / lapsed are membership-critical financial notices
// (a muted lapse notice would let a member silently lose access for
// non-payment), so they always send and never render a toggle.
export const MUTEABLE_CATEGORIES = [
  'bookings',
  'classes',
  'forms',
  'admin_alerts',
] as const satisfies readonly NotificationCategory[]

// Maps every emitted notification type to its category. A type with no entry
// here is treated as always-on by isMuted (fail-open: a member should still
// receive a newly added kind of mail rather than have it silently dropped by a
// missing mapping). Keep in sync with the renderers in notifications-logic.ts.
export const TYPE_CATEGORY: Record<string, NotificationCategory> = {
  dues_renewed: 'billing',
  dues_payment_failed: 'billing',
  dues_lapsed: 'billing',
  booking_confirmed: 'bookings',
  booking_cancelled: 'bookings',
  class_signup_registered: 'classes',
  class_signup_waitlisted: 'classes',
  class_signup_promoted: 'classes',
  class_session_cancelled: 'classes',
  form_submission_received: 'forms',
  form_submission_admin: 'admin_alerts',
}

export function categoryForType(type: string): NotificationCategory | null {
  return TYPE_CATEGORY[type] ?? null
}

export function isMuteableCategory(cat: NotificationCategory): boolean {
  return (MUTEABLE_CATEGORIES as readonly NotificationCategory[]).includes(cat)
}

// Display order + copy for the /me toggles. Only muteable categories appear.
export const CATEGORY_META: Array<{
  category: NotificationCategory
  label: string
  description: string
}> = [
  {
    category: 'bookings',
    label: 'Equipment bookings',
    description: 'Reservation confirmations and cancellations.',
  },
  {
    category: 'classes',
    label: 'Classes',
    description: 'Signups, waitlist moves, and session cancellations.',
  },
  {
    category: 'forms',
    label: 'Your form submissions',
    description: 'Receipts when you submit a form or waiver.',
  },
  {
    category: 'admin_alerts',
    label: 'Admin alerts',
    description: 'New form submissions you can manage.',
  },
]

// A member's stored preferences as a category -> enabled map. An absent
// category means the default (enabled): this is an opt-out model. Only
// muteable categories are ever stored; billing is never written.
export type PrefMap = Partial<Record<NotificationCategory, boolean>>

// The mute decision for one outbox row. Returns true (suppress the send) only
// when the type maps to a muteable category the member has explicitly disabled.
// Always-on categories (billing) and unmapped types never mute.
export function isMuted(prefs: PrefMap, type: string): boolean {
  const cat = categoryForType(type)
  if (!cat) return false
  if (!isMuteableCategory(cat)) return false
  return prefs[cat] === false
}
