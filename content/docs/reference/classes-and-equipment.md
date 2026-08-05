The classes, certifications, and equipment modules share one spine: a certification type awarded by completing a class can gate who may reserve a piece of equipment. This page is the exhaustive reference for their data model, statuses, capacity rules, and the permissions that guard each action.

## Classes

A class is a per-space offering; a session is a scheduled occurrence; a signup is one member's place in a session. Members browse and sign up at [/classes](/classes); managers create classes and sessions at [/classes/manage](/classes/manage).

### Class fields

| Field | Notes |
| --- | --- |
| `title` | 1–200 chars, required |
| `description` | optional |
| `payment_link` | optional `http(s)` URL only; a manual link, no live payment integration |
| `capacity` | optional default per-session capacity; `> 0`; null = unlimited |
| `grants_certification_id` | optional; completing a session of this class can award this certification |
| `required_form_id` | optional; a published [form](/docs/how-to/build-a-form) that must be on file before signup |
| `is_active` | archive flag; inactive classes are hidden from members |

### Session fields

`class_sessions` carry `starts_at`, optional `ends_at` (must be `>= starts_at`), `location`, an optional `capacity` override, `notes`, and a status.

| Session status | Meaning |
| --- | --- |
| `scheduled` | open; the default |
| `cancelled` | closed to signups; signed-up members are emailed |
| `completed` | run and closed; set only via completion, which fires cert awards |

### Signup and waitlist rules

- **Effective capacity** = the session `capacity` if set, else the class `capacity`, else unlimited.
- A new signup is `registered` when the current registered count is below effective capacity, otherwise `waitlisted`.
- At most one non-cancelled signup per member per session; cancelling leaves the row as history and a re-signup is allowed.
- When a `registered` member cancels and a seat frees, the earliest-signed-up `waitlisted` member is promoted to `registered` and emailed.
- Signup and cancel run inside per-session transactional functions (`class_signup_tx` / `class_cancel_tx`) so concurrent signups cannot over-enroll and concurrent cancels cannot double-promote.

| Signup status | Set by |
| --- | --- |
| `registered` | signup below capacity, or waitlist promotion |
| `waitlisted` | signup at or above capacity |
| `cancelled` | member or manager cancel |

Signing up needs no permission, only space membership. If the class has a `required_form_id`, the member must have a completed submission on file first; a manager acting with override bypasses this and can sign another member up.

### Attendance and completion

Instructors mark `attended` per signup and complete a session. Completing sets the session to `completed`; if the class has `grants_certification_id`, the certification is awarded to every attended, non-cancelled member. That award goes through the normal certifications path, so it only succeeds if the acting instructor also holds `certifications.grant`; otherwise completion still succeeds and the response reports that certificates were not issued.

### Class permissions

| Permission | Grants |
| --- | --- |
| `classes.manage` | create/edit/archive classes; schedule/cancel/delete sessions |
| `classes.instruct` | view attendees, mark attendance, complete a session |

Both seed to the `board` role by default.

## Certifications

A certification is a per-space type (name unique case-insensitive, `description`, optional `validity_months`, `is_active`). A grant (`member_certifications`) awards one type to one member. Managed alongside members at [/certifications](/certifications) and [/members](/members).

- `expires_at` is computed and stored **at grant time** from the type's `validity_months` (null = never expires). Later edits to the type never change existing grants.
- At most one active (non-revoked) grant per member per type; revoked grants stay as history and a re-grant is allowed.
- Revoking is a soft revoke (`revoked_at`, `revoked_by`, `revoked_reason`); grants are never hard-deleted by clients.
- Renewing a non-revoked grant resets `granted_at` and recomputes expiry. A revoked grant is terminal — issue a fresh grant.

| Cert status | Rule |
| --- | --- |
| `active` | not revoked, not expired |
| `expiring_soon` | expires within 30 days |
| `expired` | past `expires_at` |
| `revoked` | `revoked_at` set (always wins) |

| Permission | Grants |
| --- | --- |
| `certifications.manage` | create/edit/archive certification types |
| `certifications.grant` | award/revoke/renew grants; this is the "instructor" capability |

## Equipment and reservations

Equipment is a per-space tool record; a reservation is one member's time window on one tool. Members browse and reserve at [/equipment](/equipment); managers maintain the registry at [/equipment/manage](/equipment/manage). See [Reserve equipment](/docs/how-to/equipment-reservations) for the task walkthrough.

Equipment fields: `name` (1–200), `description`, `location`, `asset_tag`, `is_active`, an optional `required_certification_id`, and an operational status.

| Equipment status | Reservable? |
| --- | --- |
| `available` | yes |
| `maintenance` | no |
| `retired` | no |

### Reservation rules

- Reservations use half-open `[starts_at, ends_at)` windows; `ends_at` must be after `starts_at` and cannot start in the past.
- Only `reserved` rows block; `cancelled` and `completed` never do. Two `reserved` windows on the same equipment may not overlap. Touching end-to-start does not overlap.
- No-overlap is enforced in the database by a GiST exclusion constraint, so concurrent requests cannot double-book.
- If the equipment has `required_certification_id`, the member must hold an active grant of it. A manager with `equipment.manage` override bypasses the cert gate and may book on another member's behalf, but override never bypasses an operational status block.

| Reservation status | Meaning |
| --- | --- |
| `reserved` | active; blocks overlaps |
| `cancelled` | released; member or manager |
| `completed` | past/closed |

Reserving needs only membership. `equipment.manage` covers registry CRUD, status changes, and adjusting or cancelling any reservation. Equipment that has reservations must be archived rather than deleted; likewise a class with sessions and a session with signups.

Cert-gating ties the modules together: grant a certification on class completion, require that certification to reserve a machine. Roles and the seeding of these permissions are covered in [Roles and permissions](/docs/reference/roles-and-permissions).
