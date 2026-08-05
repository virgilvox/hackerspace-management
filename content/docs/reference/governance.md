The governance kernel is three linked entities (proposals, incidents, and policies) plus the enums and computed fields that drive async voting, code-of-conduct tracking, and versioned bylaws. This page enumerates every enum value, field, and lifecycle state defined in the schema. It backs the app screens at [/proposals](/proposals), [/incidents](/incidents), and [/policies](/policies), and the how-to guides [Run a proposal](/docs/how-to/run-a-proposal), [Handle incidents](/docs/how-to/handle-incidents), and [Publish a policy](/docs/how-to/publish-a-policy).

## Proposals

A proposal is an async vote in a space. Members read and cast; admin and board members transition status. Tallies are recomputed by trigger on every vote.

### `proposal_type`

| Value | Meaning |
|---|---|
| `bylaw_change` | Amend a policy; usually cites a clause via `policy_ref_id` |
| `board_action` | A board decision put to a vote |
| `membership_vote` | A vote on a membership matter |
| `advisory_poll` | Non-binding poll (the default) |
| `recall` | Vote of confidence / recall |
| `budget` | Budget or spending decision |

The column default is `advisory_poll`.

### `proposal_status`

| Value | Meaning |
|---|---|
| `draft` | Editable by the proposer; not yet open for votes |
| `open` | Voting window active; votes accepted |
| `decided` | Closed with a recorded outcome |
| `withdrawn` | Retracted before decision |
| `expired` | Voting window elapsed without a decision |

The column default is `draft`. Votes are only accepted while `status = 'open'` and the current time is within `voting_opens_at` and `voting_closes_at`.

### `threshold_rule`

Determines what fraction of yes-plus-no votes is required to pass.

| Value | Passes when |
|---|---|
| `simple_majority` | `yes > no` |
| `two_thirds` | `yes * 3 >= (yes + no) * 2` |
| `three_fourths` | `yes * 4 >= (yes + no) * 3` |
| `unanimous` | `no = 0` and `yes > 0` |

A proposal passes only if quorum is met and at least one non-abstain vote exists. The column default is `simple_majority`.

### `vote_position`

| Value | Counts toward quorum | Counts toward threshold |
|---|---|---|
| `yes` | Yes | Yes |
| `no` | Yes | Yes |
| `abstain` | Yes | No |
| `recused` | No | No |

A vote of `recused` requires a non-empty `recusal_reason` (enforced by a check constraint). One vote per member per proposal (`UNIQUE (proposal_id, member_id)`); votes are never deleted.

### Quorum and outcome fields

Quorum is computed by trigger when a proposal moves to `open`. The member count includes only `space_members` with `status` in `current` or `late` and `approved = true`.

| Field | Type | Notes |
|---|---|---|
| `quorum_percent` | integer | Percentage from space settings at open time |
| `quorum_floor` | integer | Minimum absolute count |
| `quorum_required` | integer | `GREATEST(quorum_floor, ceil(members * quorum_percent / 100))` |
| `voting_opens_at` | timestamptz | Defaults to `now()` at open |
| `voting_closes_at` | timestamptz | Defaults to open plus the space voting window |
| `outcome_yes` / `outcome_no` / `outcome_abstain` / `outcome_recused` | integer | Live tallies, refreshed per vote |
| `total_voters` | integer | Total votes cast |
| `quorum_met` | boolean | `(yes + no + abstain) >= quorum_required` |
| `passed` | boolean | Applies the `threshold_rule` |

## Incidents

An incident is a code-of-conduct complaint, safety report, or conflict. Admin and board members see all incidents; the reporter sees their own. Incidents are never deleted.

### `incident_status`

| Value | Meaning |
|---|---|
| `received` | Filed, not yet acknowledged (the default) |
| `under_review` | Acknowledged by board; `acknowledged_at` set |
| `decided` | Disposition recorded; `decided_at` set |
| `appealed` | Reporter filed an appeal, linked via `appeal_proposal_id` |
| `closed` | Resolved; `closed_at` set |

### `incident_severity`

| Value |
|---|
| `low` |
| `medium` (default) |
| `high` |
| `critical` |

### `incident_update_visibility`

Each entry in an incident's update thread carries its own visibility. Admin and board can always read.

| Value | Visible to |
|---|---|
| `reporter_only` | The reporter |
| `all_parties` | Reporter and board (the default) |
| `board_only` | Admin and board only |

### Other incident fields

| Field | Type | Notes |
|---|---|---|
| `reporter_id` | uuid | Null when anonymous |
| `reporter_token` | text | Opaque token for anonymous status lookup; unique |
| `is_anonymous` | boolean | Default false |
| `subjects` | uuid[] | Members the report concerns |
| `category` | text | Free-form; default `general` |
| `disposition` | text | The recorded decision |
| `decision_maker_ids` | uuid[] | Members who decided |
| `sla_response_by` | timestamptz | Computed as `created_at + incident_sla_hours` |

## Policies

A policy is a versioned document, bylaws, code of conduct, station rules. Members read; admin and board create. Rows are immutable: a new version is a new row pointing back via `prior_version_id`, uniqueness enforced by `UNIQUE (space_id, slug, version)`.

### `policy_status`

| Value | Meaning |
|---|---|
| `draft` | Not yet in force (the default) |
| `active` | In effect |
| `deprecated` | Retired without a replacement |
| `superseded` | Replaced by a newer version |

### Other policy fields

| Field | Type | Notes |
|---|---|---|
| `slug` | text | Stable identifier, e.g. `code-of-conduct` |
| `section_ref` | text | Free-form clause reference, e.g. `8.4` |
| `parent_policy_id` | uuid | Nests a policy under another |
| `body_formal` | text | Formal text |
| `body_plain` | text | Plain-language summary |
| `version` | integer | Starts at 1 |
| `effective_at` | timestamptz | When the version takes effect |
| `adopted_by_proposal_id` | uuid | The proposal that adopted it, if any |

## Space-level defaults

Six columns on `spaces` seed governance behavior. Proposals copy the quorum, window, and threshold values at open time; incidents copy the SLA at creation.

| Column | Default | Purpose |
|---|---|---|
| `default_quorum_percent` | 10 | Quorum as a percent of eligible members |
| `default_quorum_floor` | 1 | Minimum quorum count |
| `default_voting_window_hours` | 216 | Voting window (9 days) |
| `default_threshold` | `simple_majority` | Default `threshold_rule` |
| `incident_sla_hours` | 72 | Response SLA (3 days) |
| `mission_statement` | null | Space mission text |

## Cross-references

The three entities link to each other:

- A bylaw-change proposal cites a policy via `proposals.policy_ref_id`.
- An incident appeal becomes a proposal; the proposal carries `parent_incident_id` and the incident carries `appeal_proposal_id`.
- An adopted policy version records the proposal that passed it via `policies.adopted_by_proposal_id`.

See also the [Modules reference](/docs/reference/modules) for where governance sits among the platform's modules.
