import { describe, it, expect } from 'vitest'
import {
  last4,
  maskCardUid,
  isAlwaysBlockedHost,
  validateDoorTarget,
  encodeHeatSyncGrant,
  encodeHeatSyncRevoke,
  encodeHeatSyncControl,
  applyTemplate,
  redactDoorSecrets,
} from '@/lib/door-logic'

describe('last4', () => {
  it('returns the last 4 chars, or the whole short value', () => {
    expect(last4('0123456789')).toBe('6789')
    expect(last4('ABCD')).toBe('ABCD')
    expect(last4('AB')).toBe('AB')
  })
})

describe('maskCardUid', () => {
  it('reveals only the last 4 characters', () => {
    expect(maskCardUid('0123456789')).toBe('••••••6789')
    expect(maskCardUid('AABBCCDD')).toBe('••••CCDD')
  })
  it('reveals nothing for short UIDs', () => {
    expect(maskCardUid('ABCD')).toBe('••••')
    expect(maskCardUid('AB')).toBe('••')
    expect(maskCardUid('')).toBe('••••')
  })
})

describe('isAlwaysBlockedHost', () => {
  it('blocks cloud metadata and link-local', () => {
    expect(isAlwaysBlockedHost('169.254.169.254')).toBe(true)
    expect(isAlwaysBlockedHost('169.254.1.2')).toBe(true)
    expect(isAlwaysBlockedHost('metadata.google.internal')).toBe(true)
    expect(isAlwaysBlockedHost('fe80::1')).toBe(true)
    expect(isAlwaysBlockedHost('0.0.0.0')).toBe(true)
  })
  it('allows ordinary LAN hosts', () => {
    expect(isAlwaysBlockedHost('192.168.1.50')).toBe(false)
    expect(isAlwaysBlockedHost('10.0.0.5')).toBe(false)
    expect(isAlwaysBlockedHost('door.local')).toBe(false)
  })
})

describe('validateDoorTarget', () => {
  it('allows a LAN target that matches the pin', () => {
    const r = validateDoorTarget('http://192.168.1.50/?o1&e=1234', '192.168.1.50')
    expect(r.ok).toBe(true)
  })
  it('rejects a host that does not match the pin (anti-redirect/SSRF)', () => {
    const r = validateDoorTarget('http://evil.example.com/x', '192.168.1.50')
    expect(r.ok).toBe(false)
  })
  it('rejects metadata even if someone pins it', () => {
    const r = validateDoorTarget('http://169.254.169.254/latest/meta-data/', '169.254.169.254')
    expect(r.ok).toBe(false)
  })
  it('rejects non-http protocols', () => {
    expect(validateDoorTarget('file:///etc/passwd', 'x').ok).toBe(false)
    expect(validateDoorTarget('gopher://192.168.1.50', '192.168.1.50').ok).toBe(false)
  })
  it('pin may be entered with scheme/port/path and still matches host', () => {
    const r = validateDoorTarget('http://192.168.1.50:8080/?9&e=1234', 'http://192.168.1.50:8080/door')
    expect(r.ok).toBe(true)
  })
})

describe('encodeHeatSyncGrant', () => {
  it('zero-pads slot/perm to 3 and tag to 8 (firmware byte offsets)', () => {
    const r = encodeHeatSyncGrant({ slot: 7, permissionMask: 1, tagHex: 'abcd', password: '1234' })
    expect(r).toEqual({ ok: true, query: '?m007&p001&t0000abcd&e=1234' })
  })
  it('rejects out-of-range slot/perm and bad tag', () => {
    expect(encodeHeatSyncGrant({ slot: 999, permissionMask: 1, tagHex: 'ab', password: '1' }).ok).toBe(false)
    expect(encodeHeatSyncGrant({ slot: 1, permissionMask: 500, tagHex: 'ab', password: '1' }).ok).toBe(false)
    expect(encodeHeatSyncGrant({ slot: 1, permissionMask: 1, tagHex: 'xyz', password: '1' }).ok).toBe(false)
    expect(encodeHeatSyncGrant({ slot: 1, permissionMask: 1, tagHex: 'ab', password: '' }).ok).toBe(false)
  })
})

describe('encodeHeatSyncRevoke / control', () => {
  it('revoke zero-pads the slot and appends auth', () => {
    expect(encodeHeatSyncRevoke(12, 'pass')).toEqual({ ok: true, query: '?r012&e=pass' })
  })
  it('control maps verbs and appends auth', () => {
    expect(encodeHeatSyncControl('open1', 'pw')).toEqual({ ok: true, query: '?o1&e=pw' })
    expect(encodeHeatSyncControl('status', 'pw')).toEqual({ ok: true, query: '?9&e=pw' })
    expect(encodeHeatSyncControl('nope', 'pw').ok).toBe(false)
  })
})

describe('applyTemplate', () => {
  it('substitutes and URL-encodes known vars, leaves unknowns', () => {
    expect(applyTemplate('?card={tag}&slot={slot}', { tag: 'a b', slot: 5 })).toBe('?card=a%20b&slot=5')
    expect(applyTemplate('?x={missing}', {})).toBe('?x={missing}')
  })
})

describe('redactDoorSecrets', () => {
  it('scrubs the literal password and e= query value', () => {
    expect(redactDoorSecrets('GET http://x/?m007&t00ab&e=1234 -> 200', '1234'))
      .toBe('GET http://x/?m007&t00ab&e=<redacted> -> 200')
  })
  it('scrubs auth-ish params even without the password known', () => {
    expect(redactDoorSecrets('?pw=hunter2&token=abc')).toBe('?pw=<redacted>&token=<redacted>')
  })
  it('leaves unrelated text intact', () => {
    expect(redactDoorSecrets('status 200 ok', null)).toBe('status 200 ok')
  })
  it('redacts a regex-special password literally (split/join, not regex)', () => {
    expect(redactDoorSecrets('controller said a.*b ok', 'a.*b')).toBe('controller said <redacted> ok')
  })
  it('redacts an e= value with no trailing delimiter (end of string)', () => {
    expect(redactDoorSecrets('GET /?o1&e=1234')).toBe('GET /?o1&e=<redacted>')
  })
})

describe('validateDoorTarget — SSRF host-spoof edges', () => {
  it('rejects a userinfo-spoofed host (real host is what after @)', () => {
    // new URL(...).hostname is "evil.com", not the pinned LAN IP -> reject
    const r = validateDoorTarget('http://192.168.1.50@evil.com/?o1', '192.168.1.50')
    expect(r.ok).toBe(false)
  })
  it('matches the pin case-insensitively for hostnames', () => {
    expect(validateDoorTarget('http://Door.Local/?9', 'door.local').ok).toBe(true)
  })
  it('a trailing-dot FQDN does not equal the bare pin (fails closed)', () => {
    expect(validateDoorTarget('http://door.local./?9', 'door.local').ok).toBe(false)
  })
})
