A door connection ties your space to a physical door controller so the platform can push member cards, actuate the door, and record every action. This recipe walks you from an empty screen to a working connection with cards assigned and live events flowing into the access log.

You need the `door.manage` permission (held by `admin` and `board` by default) to create and configure connections. Operating the door and assigning cards additionally needs `door.operate`.

## Before you start

Store the controller's shared password in your encrypted Secrets vault under [/ops](/ops) first. The password is never stored on the connection itself — the connection only references a vault entry by title, and the server decrypts it at call time. If your controller has no password, you can skip this.

## Add the connection

1. Open [/door/manage](/door/manage) (the "Door access" screen) and click **New connection**.
2. Enter a **Name** (for example, `Front door`).
3. Pick the **adapter**:
   - **HeatSync / 23b Open Source Access Control (native)** — the verified Arduino query-string firmware. Verb encoding is built in; you configure nothing else.
   - **Other / generic HTTP controller** — any controller you can drive over HTTP, using per-verb templates (see below).
4. Choose the vault password from the second dropdown, or leave **No password (auth: none)**.
5. Set the **Base URL** (for example, `http://192.168.1.50/`) and the **Pinned host** (for example, `192.168.1.50`).
6. Click **Create connection**.

The app is cloud-hosted, so the target can be a publicly reachable controller or proxy, or a VPN-reachable device on your LAN. The server only ever calls the exact pinned host, never follows redirects, caps time and response size, and blocks cloud-metadata and link-local addresses regardless of what you pin.

### Generic controller verbs

For a generic connection, fill the request templates the controller expects. Each is appended to the base URL and sent as a `GET`. Placeholders are URL-encoded and substituted:

| Placeholder | Meaning |
| --- | --- |
| `{slot}` | the member's integer card slot |
| `{tag}` | the card UID / tag value |
| `{perm}` | permission level (default 1) |
| `{door}` | door identifier, for open/lock verbs |
| `{pw}` | the shared password from your vault (server-side only) |

Leave any verb blank if the controller does not support it. Example: `?m{slot}&p001&t{tag}&e={pw}`.

## Verify it

Click **Test** on the connection. This runs the read-only `status` verb only — it never opens the door — and writes one redacted row to the access log. A success toast shows the HTTP status.

## Assign member cards

With `door.operate`, click **Cards** in the Operate row. You get every active card in the space. Click **Grant** to write a card to the controller; the platform allocates the lowest free slot (HeatSync uses slots `0`–`200`) and shows it. Click **Revoke** to remove it. Slots are per connection, so the same card can hold different slots on different controllers, and re-granting is idempotent.

The Operate row also gives you **Open** (momentary), **Unlock** (hold open), and **Lock**.

## Read real events back in (optional)

To pull actual entry and denied events into the log, click **Inbound**:

1. Choose a **webhook secret** from your vault (distinct from the door password) and click **Turn inbound on**.
2. For a generic controller, POST events to the shown webhook URL, `/api/door/inbound/<connection-id>`, with header `Authorization: Bearer <your webhook secret>` and a JSON body like `{ "events": [{ "id": "<stable-id>", "card_uid": "<hex>", "result": "granted" }] }`. The `id` dedupes retries.
3. For a HeatSync connection, a once-a-minute poll reads the controller's log automatically once inbound is on — no webhook wiring needed.

Ingested events resolve each presented card to a member and appear in the **Access log** at the bottom of the page. That log is append-only and immutable: only the server writes it, secrets are redacted first, and rows survive even if you later delete the connection.

## Related

- Enable member self-entry per connection with the **Self-entry on** toggle (elevated physical-security risk; off by default).
- Define custom HTTP actions at [/door/buttons](/door/buttons) ("API buttons"), which members invoke from [/doors](/doors).
