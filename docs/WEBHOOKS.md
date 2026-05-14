# Webhooks

Webhooks let an external service react to events happening inside a space (a new member, a payment recorded, a proposal opened, an incident filed, etc). Each space has one webhook endpoint and one signing secret.

> Status: the webhook envelope, signing secret rotation, and the verification contract documented here are stable. Per-event delivery, retry policy with backoff, and the delivery history UI are tracked in `docs/AUDIT.md` and `docs/PRODUCTION_AUDIT.md` and may land in a follow-up release.

## Configuring the endpoint

1. Sign in as a space admin.
2. Go to **Settings → API → Webhooks**.
3. Paste your endpoint URL into the **Endpoint URL** field. The endpoint must be HTTPS and reachable from the internet. Local development URLs (e.g. `ngrok` tunnels) are fine for testing.
4. Save.
5. Click **Show secret** to reveal the signing secret, then **Copy** to copy it. Store it in your receiver's environment, never in source control.
6. To rotate the secret, click **Rotate**. A new value is generated and shown immediately. The previous secret stops verifying as soon as you rotate.

## Payload envelope

Every delivery is a JSON `POST` with the following structure:

```json
{
  "id": "evt_01HZ8KQ8X1T2W3Y4Z5A6B7C8D9",
  "type": "payment.recorded",
  "created_at": "2026-05-14T22:00:00Z",
  "space_id": "8f3a...",
  "data": {
    "...": "event-specific payload"
  }
}
```

Fields:

- `id` — a stable identifier you can use for de-duplication. Format: ULID prefixed with `evt_`.
- `type` — dotted event type. Current vocabulary: `member.created`, `member.updated`, `member.removed`, `payment.recorded`, `payment.failed`, `proposal.created`, `proposal.closed`, `incident.created`, `policy.published`.
- `created_at` — ISO 8601 UTC.
- `space_id` — UUID of the space that owns the event.
- `data` — event-specific payload. See the per-type schema in `docs/API_REFERENCE.md`.

## Signing and verification

Every request includes two headers:

```
X-Hackerspace-Timestamp: 1747257600
X-Hackerspace-Signature: t=1747257600,v1=<hex-hmac-sha256>
```

The signature is computed as:

```
v1 = HMAC_SHA256(secret, f"{timestamp}.{raw_request_body}")
```

To verify a delivery, your receiver should:

1. Read the raw request body before any JSON parsing.
2. Extract the `t` and `v1` values from `X-Hackerspace-Signature`.
3. Reject the request if `|now - t| > 300` seconds (replay protection).
4. Compute the expected signature using your stored secret.
5. Compare with a constant-time comparison.

### Node.js example

```ts
import crypto from "node:crypto";
import express from "express";

const app = express();

app.post(
  "/webhooks/hackerspace",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const header = req.header("X-Hackerspace-Signature") ?? "";
    const parts = Object.fromEntries(header.split(",").map(p => p.split("=")));
    const t = Number(parts.t);
    const sig = parts.v1;

    if (!t || !sig) return res.status(400).end();
    if (Math.abs(Date.now() / 1000 - t) > 300) return res.status(401).end();

    const payload = `${t}.${req.body.toString("utf8")}`;
    const expected = crypto
      .createHmac("sha256", process.env.HACKERSPACE_WEBHOOK_SECRET!)
      .update(payload)
      .digest("hex");

    const ok =
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));

    if (!ok) return res.status(401).end();

    const event = JSON.parse(req.body.toString("utf8"));
    // handle event
    res.status(204).end();
  }
);

app.listen(3000);
```

### Python example

```python
import hmac, hashlib, time, os
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = os.environ["HACKERSPACE_WEBHOOK_SECRET"].encode()

@app.post("/webhooks/hackerspace")
def handle():
    header = request.headers.get("X-Hackerspace-Signature", "")
    parts = dict(p.split("=") for p in header.split(","))
    t = int(parts.get("t", "0"))
    sig = parts.get("v1", "")

    if abs(time.time() - t) > 300:
        abort(401)

    body = request.get_data()
    payload = f"{t}.".encode() + body
    expected = hmac.new(SECRET, payload, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(sig, expected):
        abort(401)

    event = request.get_json(force=True)
    # handle event
    return "", 204
```

## Retries and backoff

A delivery is considered successful when the receiver returns any 2xx status within 10 seconds. Non-2xx responses or timeouts trigger up to five retries with exponential backoff (15s, 1m, 5m, 30m, 2h). After the fifth failed attempt the delivery is dropped and logged on the **Webhooks → Recent deliveries** panel.

> The delivery history panel and retry policy editor are scheduled for a follow-up release. Until then, retries follow the fixed policy above.

## Operational notes

- Webhook deliveries originate from your Droplet's outbound IP. Allowlist that IP if your receiver enforces source restrictions.
- The signing secret is stored encrypted at rest in `public.integrations` (per space). Rotating it invalidates the previous value immediately.
- Webhook configuration is per space. Multi-space tenants must configure each space individually.
