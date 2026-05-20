import { describe, it, expect } from 'vitest'
import {
  MUTEABLE_CATEGORIES,
  TYPE_CATEGORY,
  CATEGORY_META,
  categoryForType,
  isMuteableCategory,
  isMuted,
} from '@/lib/notifications-prefs-logic'

describe('categoryForType', () => {
  it('maps every dues type to billing', () => {
    expect(categoryForType('dues_renewed')).toBe('billing')
    expect(categoryForType('dues_payment_failed')).toBe('billing')
    expect(categoryForType('dues_lapsed')).toBe('billing')
  })

  it('maps booking, class, and form types to their categories', () => {
    expect(categoryForType('booking_confirmed')).toBe('bookings')
    expect(categoryForType('booking_cancelled')).toBe('bookings')
    expect(categoryForType('class_signup_registered')).toBe('classes')
    expect(categoryForType('class_signup_waitlisted')).toBe('classes')
    expect(categoryForType('class_signup_promoted')).toBe('classes')
    expect(categoryForType('class_session_cancelled')).toBe('classes')
    expect(categoryForType('form_submission_received')).toBe('forms')
    expect(categoryForType('form_submission_admin')).toBe('admin_alerts')
  })

  it('returns null for an unmapped type', () => {
    expect(categoryForType('something_new')).toBeNull()
  })
})

describe('isMuteableCategory', () => {
  it('billing is never muteable', () => {
    expect(isMuteableCategory('billing')).toBe(false)
  })
  it('bookings, classes, forms, admin_alerts are muteable', () => {
    for (const c of MUTEABLE_CATEGORIES) expect(isMuteableCategory(c)).toBe(true)
  })
})

describe('isMuted', () => {
  it('absent pref means enabled (opt-out default): not muted', () => {
    expect(isMuted({}, 'booking_confirmed')).toBe(false)
  })

  it('explicitly disabled muteable category: muted', () => {
    expect(isMuted({ bookings: false }, 'booking_confirmed')).toBe(true)
    expect(isMuted({ classes: false }, 'class_signup_registered')).toBe(true)
    expect(isMuted({ forms: false }, 'form_submission_received')).toBe(true)
    expect(isMuted({ admin_alerts: false }, 'form_submission_admin')).toBe(true)
  })

  it('explicitly enabled: not muted', () => {
    expect(isMuted({ bookings: true }, 'booking_confirmed')).toBe(false)
  })

  it('billing is never muted even if a stray pref tries to disable it', () => {
    // billing is never written, but defend the dispatcher path regardless.
    expect(isMuted({ billing: false } as never, 'dues_lapsed')).toBe(false)
    expect(isMuted({ billing: false } as never, 'dues_payment_failed')).toBe(false)
    expect(isMuted({}, 'dues_renewed')).toBe(false)
  })

  it('unmapped type is never muted (fail-open)', () => {
    expect(isMuted({ bookings: false }, 'brand_new_event')).toBe(false)
  })

  it('a pref for one category does not affect another', () => {
    expect(isMuted({ classes: false }, 'booking_confirmed')).toBe(false)
  })
})

describe('CATEGORY_META', () => {
  it('lists exactly the muteable categories, no billing', () => {
    const cats = CATEGORY_META.map(m => m.category)
    expect(cats).toEqual([...MUTEABLE_CATEGORIES])
    expect(cats).not.toContain('billing')
  })

  it('every emitted type maps to a known category', () => {
    for (const cat of Object.values(TYPE_CATEGORY)) {
      expect(['billing', ...MUTEABLE_CATEGORIES]).toContain(cat)
    }
  })
})
