Policies are your space's versioned governance documents: bylaws, code of conduct, station rules. Each policy has a stable slug and a full version history, and only one version at a time is active. This recipe walks you through drafting a policy, publishing it, and later superseding it with a new version.

You need the `admin` or `board` role. Every member can read policies at [/policies](/policies), but the `New policy` button and the management controls only appear for admins and board.

## Draft a new policy

1. Go to [/policies](/policies) and click `New policy` (top right). This opens [/policies/new](/policies/new).
2. Fill in the fields:

| Field | Required | Notes |
| --- | --- | --- |
| Slug | Yes | Lowercase letters, numbers, and hyphens only; max 80 characters (e.g. `bylaws`, `code-of-conduct`). This is the stable identifier that carries across every version. |
| Section reference | No | An optional citation label such as `Article III §2`, shown next to the version. |
| Title | Yes | Human-readable name, max 200 characters. |
| Plain-language summary | No | A short, readable gloss of the formal text. Rendered as Markdown. |
| Formal text | Yes in practice | The authoritative body. Rendered as Markdown. |

3. Click `Save as draft v1`. The policy is created at `version` 1 with status `draft` and you land on its detail page at `/policies/<slug>`.

A draft is not yet in force. It has no `effective_at` date and does not count as the space's governing text until you activate it.

The slug must be unique within your space. If you try to create a second policy with a slug that already exists, you get an error telling you to supersede the existing one instead — that is how new versions are made.

## Publish (activate) the policy

1. Open the policy at `/policies/<slug>`.
2. In the `Manage` panel, click `Activate v1`.

Activating does two things atomically:

- Sets the policy's status to `active` and stamps `effective_at` with the current time.
- Marks any previously `active` version of the same slug as `superseded`, so exactly one version is ever active.

The detail page's primary view always shows the active version (falling back to the latest version if none is active), and the status badge on [/policies](/policies) reflects it.

## Supersede with a new version

When the text needs to change, you do not edit the active version in place — you publish a new version and swap it in.

1. Open the active policy and click `Supersede with new version` in the `Manage` panel.
2. The formal text and plain-language fields open pre-filled with the current version's content. Edit them.
3. Click `Create draft v<n+1>`. This inserts a new row that keeps the same slug, increments `version`, records `prior_version_id` pointing at the version you superseded, and starts at status `draft`.
4. Review the new draft, then click `Activate v<n+1>`. Activation flips the new version to `active` and marks the prior active version as `superseded` in the same step.

The full lineage stays visible in the `Version history` section of the detail page, newest first, with each version's status and creation date. Nothing is ever deleted.

## Other status transitions

The `Manage` panel also exposes the remaining statuses. Policy status is one of:

| Status | Meaning |
| --- | --- |
| `draft` | Written but not in force; no effective date. |
| `active` | The current governing version. At most one per slug. |
| `deprecated` | Retired without a replacement (e.g. a rule you no longer enforce). Use the `Deprecate` button on an active policy. |
| `superseded` | Replaced by a newer version. Set automatically when a newer version is activated. |

You can also set `draft`, `deprecated`, or `superseded` directly with the `Set <status>` buttons, but the automatic transitions during activation handle the common case.

## Notes

- Every action here requires the `admin` or `board` role; the underlying create, supersede, and status actions reject anyone else.
- A version can record the proposal that adopted it; when set, the version history links straight to that proposal. See [Run a proposal](/docs/how-to/run-a-proposal) for putting a bylaw change to a vote before you activate it.
- Both body fields render Markdown, so headings, lists, and emphasis display formatted on the detail page.
