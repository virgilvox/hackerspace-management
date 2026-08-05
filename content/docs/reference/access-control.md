Physical access lives in the door module: member cards, per-door connections to a controller, the slot map that keys cards into a controller, inbound event ingest, and an append-only access log. This page is the exhaustive reference for those tables, their fields, and the permissions that gate them. To set a door up step by step, see [Connect a door](/docs/how-to/connect-a-door).

## Permissions

Two access permission codes gate the whole module, plus one for API buttons. All are additive and assignable to any role; the seed grants them to `board`, and `admin` holds them implicitly. See [Roles and permissions](/docs/reference/roles-and-permissions).

| Code | Group | Grants |
| --- | --- | --- |
| `door.manage` | Access | Configure connections and API buttons; manage member cards; view the access log |
| `door.operate` | Access | Live actions: open/unlock/lock, grant/revoke a card; view the access log |
| `apicall.invoke` | Access | Default required permission to press an API button |

Managers configure at [/door/manage](/door/manage) and [/door/buttons](/door/buttons). Members see their own cards, self-entry doors, buttons they may press, and their recent activity at [/doors](/doors); the dashboard also surfaces self-entry.

## Member cards

`member_cards` maps a physical card UID to a member. The raw UID is treated as a credential: only `door.manage` holders can read the table, and a member's own view returns a per-card list (`card_type`, `label`, `is_active`, and the last four characters of the UID, rendered `••••ABCD`) — never more than the last four of the UID.

| Field | Type | Notes |
| --- | --- | --- |
| `card_uid` | text | The credential. Unique per `(space_id, card_uid)` |
| `card_type` | text | `rfid` or `nfc` (default `rfid`) |
| `label` | text | Optional operator label |
| `is_active` | boolean | Inactive cards cannot be granted |

## Door connections

A `door_connections` row is one configured integration to a physical controller.

| Field | Values | Notes |
| --- | --- | --- |
| `adapter` | `native_heatsync`, `generic_http` | HeatSync/23b uses built-in query-string verbs; generic uses per-verb templates |
| `base_url` | must start with `http://`/`https://` | Controller or reachable proxy |
| `pinned_host` | hostname/IP | SSRF pin: the executor calls only this host, blocks cloud-metadata/link-local, and forbids redirects |
| `auth_mode` | `none`, `query`, `header`, `bearer` | With `auth_param` |
| `secret_ref` | secrets vault id | Outbound door password; decrypted server-side only, never returned |
| `verbs` | jsonb | Generic per-verb templates with `{slot}`, `{tag}`, `{perm}`, `{door}`, `{pw}` |
| `allow_member_self_entry` | boolean | Opt-in per connection; off by default |
| `is_enabled` | boolean | Disabled connections reject all calls |
| `inbound_enabled` | boolean | Gates the inbound webhook |
| `inbound_secret_ref` | secrets vault id | Inbound webhook bearer, distinct from the door password |

Native HeatSync encodes fixed-width query strings: grant `?m<slot>&p<perm>&t<tag>&e=<pw>`, revoke `?r<slot>&e=<pw>`, and control verbs `?o1` (open), `?u` (unlock), `?l` (lock), `?9` (status), `?z` (log).

## Card slots

`door_card_slots` is the platform's allocation map. Controllers key cards by an integer `slot` (HeatSync range 0–200), scoped per connection.

- `UNIQUE (connection_id, slot)` arbitrates concurrent grants racing for a slot.
- `UNIQUE (connection_id, card_id)` makes re-granting idempotent.
- The lowest-free-slot policy lives in unit-tested logic, not SQL. Only the service-client executor writes rows, in lockstep with the controller call.

## Inbound ingest

Two transports pull entry/denied events into the log and share one core. Ingested rows carry `door_access_log.dedupe_key` (partial-unique per connection), so retries and re-polls insert once via `ON CONFLICT DO NOTHING`.

- Poll: a `CRON_SECRET`-guarded route reads each enabled `native_heatsync` connection's `?z` log through the hardened executor.
- Webhook: a per-connection public endpoint accepts normalized event JSON, authenticated by the inbound bearer secret. Used for generic controllers and relays.

## Access log

`door_access_log` is an append-only, immutable audit of every attempt. Secrets are redacted before write, and only the validated service-client executor inserts rows (no client write policy). `door.manage` or `door.operate` may read it.

| Field | Notes |
| --- | --- |
| `action` | `grant`, `revoke`, `open`, `unlock`, `lock`, `test`, `self_entry`, plus ingested events |
| `success` | Attempt outcome |
| `actor_member_id` / `target_member_id` | Who acted / whose card |
| `detail` | Redacted status snippet |
| `dedupe_key` | Set only on ingested rows |

## API buttons

`api_buttons` are named admin-defined HTTP calls fired through the same hardened egress as the door executor.

| Field | Values | Notes |
| --- | --- | --- |
| `label` / `button_group` | text | Grouped and ordered by `sort_order` |
| `method` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | Default `POST` |
| `base_url` / `pinned_host` | — | Per-button SSRF pin |
| `url_template` / `body_template` / `headers` | — | With `secret_ref` injected server-side |
| `required_permission` | catalog code | Default `apicall.invoke`; a member sees only buttons whose permission they hold |
| `confirm` | boolean | Prompt before firing (default true) |

Managing buttons requires `door.manage`. Every press writes one redacted row to `api_call_log`, which mirrors the access log's immutable, `door.manage`-read posture.
