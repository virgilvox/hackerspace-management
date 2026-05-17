// Pure, dependency-free logic for the Door epic. No Supabase/React/Next.
// Unit-tested directly. The card UID is a credential, so the canonical
// masking lives here and is reused everywhere a non-manager could see it.

export function last4(uid: string): string {
  return uid.length <= 4 ? uid : uid.slice(-4)
}

// "••••AB12" — never reveals more than the last 4 characters. For a UID of 4
// or fewer characters nothing is revealed.
export function maskCardUid(uid: string): string {
  if (uid.length <= 4) return '•'.repeat(uid.length || 4)
  return '•'.repeat(uid.length - 4) + uid.slice(-4)
}

// ─── SSRF guard (the dangerous part) ─────────────────────────────────────────
// A door connection deliberately targets a LAN device, so private ranges are
// allowed — but ONLY the exact host the admin pinned, and never the cloud
// metadata / link-local range. The executor additionally forbids redirects
// and caps response size/time; this pure function decides if a target URL is
// allowed to be called at all.

// Always-blocked, regardless of pin: IMDS / link-local and unspecified.
export function isAlwaysBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === '169.254.169.254' || h === 'metadata' || h === 'metadata.google.internal') return true
  if (h.startsWith('169.254.')) return true // IPv4 link-local (includes IMDS)
  if (h === '0.0.0.0' || h === '::' || h === '0:0:0:0:0:0:0:0') return true
  if (h === 'fd00:ec2::254') return true // AWS IPv6 IMDS
  if (h.startsWith('fe80:')) return true // IPv6 link-local
  return false
}

export type DoorTarget =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: string }

// Validate a fully-formed request URL against the connection's pinned host.
// pinnedHost is exactly what the admin entered (hostname or IP, optional
// :port is compared on the host only). The request host must equal the pin
// (case-insensitive) and must not be an always-blocked address.
export function validateDoorTarget(rawUrl: string, pinnedHost: string): DoorTarget {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'The request URL is not a valid URL.' }
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: 'Only http and https are allowed.' }
  }
  const host = u.hostname.toLowerCase()
  const pin = pinnedHost.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0]
  if (!pin) return { ok: false, reason: 'This connection has no pinned host.' }
  if (isAlwaysBlockedHost(host)) {
    return { ok: false, reason: 'That host is blocked (link-local / metadata).' }
  }
  if (host !== pin) {
    return { ok: false, reason: `Request host "${host}" does not match the pinned host "${pin}".` }
  }
  return { ok: true, url: u.toString(), host }
}

// ─── HeatSync native adapter encoders ────────────────────────────────────────
// Firmware (zyphlar/Open_Access_Control_Ethernet.ino, re-verified 2026-05-17)
// parses FIXED-WIDTH ZERO-PADDED query params by byte offset: user slot = 3
// digits, perm mask = 3 digits, tag = 8 hex chars, password = the shared
// secret. Auth is satisfied when "?e=" or "&e=" is present, so every
// privileged verb appends "&e=<pw>". Getting the widths wrong addresses the
// WRONG slot — so these are pure and unit-tested.

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

export type EncodeResult = { ok: true; query: string } | { ok: false; reason: string }

function checkSlot(slot: number): string | null {
  if (!Number.isInteger(slot) || slot < 0 || slot > 200) return 'Card slot must be an integer 0-200.'
  return null
}

export function encodeHeatSyncGrant(input: {
  slot: number
  permissionMask: number
  tagHex: string
  password: string
}): EncodeResult {
  const slotErr = checkSlot(input.slot)
  if (slotErr) return { ok: false, reason: slotErr }
  if (!Number.isInteger(input.permissionMask) || input.permissionMask < 0 || input.permissionMask > 255) {
    return { ok: false, reason: 'Permission mask must be an integer 0-255.' }
  }
  if (!/^[0-9a-fA-F]{1,8}$/.test(input.tagHex)) {
    return { ok: false, reason: 'Tag must be 1-8 hexadecimal characters.' }
  }
  if (input.password.length < 1 || input.password.length > 16) {
    return { ok: false, reason: 'Door password is missing or implausible.' }
  }
  const tag = input.tagHex.toLowerCase().padStart(8, '0')
  return {
    ok: true,
    query: `?m${pad(input.slot, 3)}&p${pad(input.permissionMask, 3)}&t${tag}&e=${input.password}`,
  }
}

export function encodeHeatSyncRevoke(slot: number, password: string): EncodeResult {
  const slotErr = checkSlot(slot)
  if (slotErr) return { ok: false, reason: slotErr }
  if (!password) return { ok: false, reason: 'Door password is missing.' }
  return { ok: true, query: `?r${pad(slot, 3)}&e=${password}` }
}

// verb: 'open1' | 'open2' | 'unlock' | 'lock' | 'arm' | 'disarm' | 'status' | 'log'
export function encodeHeatSyncControl(verb: string, password: string): EncodeResult {
  if (!password) return { ok: false, reason: 'Door password is missing.' }
  const map: Record<string, string> = {
    open1: '?o1',
    open2: '?o2',
    unlock: '?u',
    lock: '?l',
    disarm: '?1',
    arm: '?2',
    status: '?9',
    log: '?z',
  }
  const base = map[verb]
  if (!base) return { ok: false, reason: `Unknown door verb "${verb}".` }
  return { ok: true, query: `${base}&e=${password}` }
}

// ─── Generic adapter template substitution ───────────────────────────────────
// A generic connection stores a path/query template per verb with {slot},
// {tag}, {perm}, {door}, {pw} placeholders. Substitution is literal and the
// values are URL-encoded; unknown placeholders are left untouched so a
// misconfig fails loudly rather than silently calling something unintended.

export function applyTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (m, key) =>
    key in vars ? encodeURIComponent(String(vars[key])) : m,
  )
}

// Before anything (URL, response snippet) is written to the audit log, scrub
// the shared door password: any literal occurrence, and any e=/&e= query
// value (the firmware auth param), become "<redacted>". The password is a
// credential and must never land in door_access_log.
export function redactDoorSecrets(text: string, password?: string | null): string {
  let out = text
  if (password && password.length > 0) {
    out = out.split(password).join('<redacted>')
  }
  out = out.replace(/([?&](?:e|pw|password|api[_-]?key|token)=)[^&\s"']*/gi, '$1<redacted>')
  return out
}
