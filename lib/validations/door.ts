import { z } from 'zod'
import { isValidPermission } from '../permissions-catalog'
import { API_METHODS } from '../api-call-logic'

// ─── Member access cards (Door epic) ─────────────────────────────────────────

const cardUid = z
  .string()
  .trim()
  .min(1, 'Card UID is required')
  .max(200, 'Card UID is too long')

export const addMemberCardSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
  card_uid: cardUid,
  card_type: z.enum(['rfid', 'nfc']).optional().default('rfid'),
  label: z.string().max(120).optional().nullable(),
})

export const updateMemberCardSchema = z.object({
  cardId: z.string().uuid('Invalid card ID'),
  label: z.string().max(120).optional().nullable(),
  is_active: z.boolean().optional(),
})

export const cardIdSchema = z.object({
  cardId: z.string().uuid('Invalid card ID'),
})

export const listMemberCardsSchema = z.object({
  memberId: z.string().uuid('Invalid member ID'),
})

// ─── Door connections (Door epic P2) ─────────────────────────────────────────

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .regex(/^https?:\/\/.+/i, 'Must be an http(s) URL')

const doorAdapter = z.enum(['native_heatsync', 'generic_http'])
const doorAuthMode = z.enum(['none', 'query', 'header', 'bearer'])

export const createDoorConnectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  adapter: doorAdapter.optional().default('generic_http'),
  base_url: httpUrl,
  pinned_host: z.string().min(1, 'A pinned host is required').max(255),
  auth_mode: doorAuthMode.optional().default('none'),
  auth_param: z.string().max(120).optional().nullable(),
  secret_ref: z.string().uuid('Invalid secret reference').optional().nullable(),
  // generic adapter per-verb templates (validated as a flat string map)
  verbs: z.record(z.string().max(2000)).optional().default({}),
  allow_member_self_entry: z.boolean().optional().default(false),
  is_enabled: z.boolean().optional().default(true),
  // Inbound access-log ingest (P4). inbound_enabled gates both the poll cron
  // and the per-connection webhook; inbound_secret_ref is the webhook bearer
  // secret (a secrets-vault row), distinct from secret_ref.
  inbound_enabled: z.boolean().optional().default(false),
  inbound_secret_ref: z.string().uuid('Invalid secret reference').optional().nullable(),
})

export const updateDoorConnectionSchema = z.object({
  connectionId: z.string().uuid('Invalid connection ID'),
  name: z.string().min(1).max(200).optional(),
  adapter: doorAdapter.optional(),
  base_url: httpUrl.optional(),
  pinned_host: z.string().min(1).max(255).optional(),
  auth_mode: doorAuthMode.optional(),
  auth_param: z.string().max(120).optional().nullable(),
  secret_ref: z.string().uuid('Invalid secret reference').optional().nullable(),
  verbs: z.record(z.string().max(2000)).optional(),
  allow_member_self_entry: z.boolean().optional(),
  is_enabled: z.boolean().optional(),
  inbound_enabled: z.boolean().optional(),
  inbound_secret_ref: z.string().uuid('Invalid secret reference').optional().nullable(),
})

export const doorConnectionIdSchema = z.object({
  connectionId: z.string().uuid('Invalid connection ID'),
})

// ─── Door live actions (door.operate) ────────────────────────────────────────

export const doorGrantSchema = z.object({
  connectionId: z.string().uuid('Invalid connection ID'),
  cardId: z.string().uuid('Invalid card ID'),
  // HeatSync permission mask; defaults to 1 (basic access).
  permissionMask: z.number().int().min(0).max(255).optional().default(1),
})

export const doorRevokeSchema = z.object({
  connectionId: z.string().uuid('Invalid connection ID'),
  cardId: z.string().uuid('Invalid card ID'),
})

export const doorControlSchema = z.object({
  connectionId: z.string().uuid('Invalid connection ID'),
  verb: z.enum(['open', 'unlock', 'lock']),
})

// ─── Door inbound webhook (Door epic P4) ─────────────────────────────────────
// A controller or relay pushes access events to /api/door/inbound/[connection],
// authenticated by the connection's inbound bearer secret. Each event MUST
// carry a stable id (the dedupe token; retries are idempotent). At least one of
// card_uid / card_number identifies the card; result states the access
// decision. The batch is bounded so one request cannot enqueue unbounded work.
const doorWebhookEvent = z.object({
  id: z.string().min(1).max(200),
  card_uid: z.string().trim().min(1).max(200).optional().nullable(),
  card_number: z.string().trim().regex(/^\d{1,20}$/, 'card_number must be digits').optional().nullable(),
  result: z.enum(['granted', 'denied', 'unknown']).optional(),
  occurred_at: z.string().datetime({ offset: true }).optional().nullable(),
})

export const doorWebhookPayloadSchema = z.object({
  events: z.array(doorWebhookEvent).min(1).max(100),
})

// ─── Universal API-call buttons (Door epic P5) ───────────────────────────────
const apiMethod = z.enum(API_METHODS)
const apiAuthMode = z.enum(['none', 'query', 'header', 'bearer'])
// required_permission must be a real catalog code (any of them; the admin picks
// which capability gates pressing the button, default apicall.invoke).
const requiredPermission = z
  .string()
  .max(60)
  .refine(isValidPermission, 'Unknown permission code')
// A flat string->string header map, bounded in count and value length.
const apiHeaders = z
  .record(z.string().max(2000))
  .refine(h => Object.keys(h).length <= 20, 'Too many headers (max 20)')

export const createApiButtonSchema = z.object({
  label: z.string().min(1, 'Label is required').max(120),
  button_group: z.string().min(1).max(60).optional().default('General'),
  sort_order: z.number().int().min(0).max(100000).optional().default(0),
  method: apiMethod.optional().default('POST'),
  base_url: httpUrl,
  pinned_host: z.string().min(1, 'A pinned host is required').max(255),
  url_template: z.string().max(2000).optional().nullable(),
  headers: apiHeaders.optional().default({}),
  body_template: z.string().max(8000).optional().nullable(),
  auth_mode: apiAuthMode.optional().default('none'),
  auth_param: z.string().max(120).optional().nullable(),
  secret_ref: z.string().uuid('Invalid secret reference').optional().nullable(),
  required_permission: requiredPermission.optional().default('apicall.invoke'),
  confirm: z.boolean().optional().default(true),
  is_enabled: z.boolean().optional().default(true),
})

export const updateApiButtonSchema = z.object({
  buttonId: z.string().uuid('Invalid button ID'),
  label: z.string().min(1).max(120).optional(),
  button_group: z.string().min(1).max(60).optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
  method: apiMethod.optional(),
  base_url: httpUrl.optional(),
  pinned_host: z.string().min(1).max(255).optional(),
  url_template: z.string().max(2000).optional().nullable(),
  headers: apiHeaders.optional(),
  body_template: z.string().max(8000).optional().nullable(),
  auth_mode: apiAuthMode.optional(),
  auth_param: z.string().max(120).optional().nullable(),
  secret_ref: z.string().uuid('Invalid secret reference').optional().nullable(),
  required_permission: requiredPermission.optional(),
  confirm: z.boolean().optional(),
  is_enabled: z.boolean().optional(),
})

export const apiButtonIdSchema = z.object({
  buttonId: z.string().uuid('Invalid button ID'),
})
