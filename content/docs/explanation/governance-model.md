Governance in a hackerspace is mostly procedure: who gets to decide, how many people have to weigh in, and what counts as a pass. The platform's governance kernel encodes those procedures as data so they can't be argued about after the fact. This page explains why quorum, thresholds, recusal, anonymity, and SLAs are modeled the way they are.

The whole design follows one rule: **privacy default for individuals, transparency default for institutions.** A member's identity when reporting harassment is protected; the vote a board member cast on a proposal is public forever. Every schema choice below falls out of that principle plus a second one, no hardcoded politics. Quorum percentages, voting windows, thresholds, and SLAs are per-space **DB defaults**, columns on the `spaces` table (`default_quorum_percent`, `default_voting_window_hours`, `default_threshold`, `incident_sla_hours`) that ship sensible values but are not currently editable in the UI. Each proposal sets its own quorum, threshold, and window at creation, seeded from those defaults.

## Why quorum is a floor plus a percent

A single percentage breaks at the extremes. Ten percent of 400 members is a reasonable 40-vote bar; ten percent of 6 members is 0.6, which rounds to nothing and lets two people pass a bylaw change. So quorum is computed as the **greater of an absolute floor and a percentage**:

```
quorum_required = GREATEST(quorum_floor, CEIL(member_count * quorum_percent / 100))
```

The member count is not "everyone in the database", it counts only members with status `current` or `late` who are `approved`. Unverified, inactive, and unapproved rows don't inflate the denominator. Defaults are `default_quorum_percent = 10` and `default_quorum_floor = 1`; a real space typically raises the floor to something like 8 ("10% or 8, whichever is greater").

Crucially, quorum is **computed once, when the proposal opens, and frozen** onto the proposal row (`quorum_required`, `quorum_percent`, `quorum_floor`). If three people join mid-vote, the bar doesn't move under the voters. That freezing is what makes the number un-disputable: it's stated on the proposal page before anyone votes.

## Why thresholds are separate from quorum

Quorum asks "did enough people show up?" Thresholds ask "of those who took a side, did enough agree?" They're independent, and abstentions reveal why. An abstain **counts toward quorum** (the person showed up) but is **excluded from the threshold math** (they took no side). Recused votes count toward neither.

| Threshold | Passes when |
|-----------|-------------|
| `simple_majority` | yes > no |
| `two_thirds` | yes × 3 ≥ (yes + no) × 2 |
| `three_fourths` | yes × 4 ≥ (yes + no) × 3 |
| `unanimous` | no = 0 and yes > 0 |

The denominator is always `yes + no`, never total voters. Using integer cross-multiplication instead of floating-point division avoids rounding disputes on the exact boundary. A proposal only passes if quorum is met *and* the threshold clears, both are recomputed on every vote so the proposal page shows a live, honest tally. See [Run a proposal](/docs/how-to/run-a-proposal) for the operator's view and [Governance reference](/docs/reference/governance) for the full enum tables.

## Why recusal is a first-class position, not a silence

A board member with a conflict of interest could just not vote, but then there's no record of *why* they stayed out, and the count can't distinguish a principled recusal from apathy. So `recused` is one of four vote positions (`yes`, `no`, `abstain`, `recused`), and a database constraint requires a non-empty `recusal_reason` to use it. The recusal is logged permanently and visible to every member, because a recusal record is exactly the kind of institutional transparency the model protects. Votes are never deleted; a member's voting history is a query, not a leak.

## Why anonymity is honest, not cryptographic

Incident reports (`/incidents`) can be filed anonymously, but the platform deliberately does **not** promise cryptographic anonymity, the database admin can always read the row. What it provides instead is an opaque, server-generated `reporter_token` that lets an anonymous reporter track their own case without exposing their identity in any list. When `is_anonymous` is set, `reporter_id` is left null. Named subjects of a report don't see it by default; dispositions stay board-only until a policy says otherwise, enforced by row-level security and the `incident_updates` visibility levels (`reporter_only`, `all_parties`, `board_only`). Promising more than the storage model can deliver would be dishonest, so the model promises exactly what it enforces. See [Handle incidents](/docs/how-to/handle-incidents).

## Why every incident has an SLA clock

The failure mode the incident system exists to prevent is the complaint that vanishes. So an incident isn't just filed, on insert it gets an `sla_response_by` deadline (`created_at + incident_sla_hours`, default 72 hours / 3 days). The status ladder (`received → under_review → decided → appealed → closed`) means action requires an explicit, timestamped transition, and a dismissed report exposes an appeal path that becomes a normal proposal with `parent_incident_id` set. Silence stops being a way to avoid a decision, because the schema records the absence of one.

The through-line: institutional memory is retained and public (proposals, votes, and policy versions are immutable and cross-referenced) while individual reporters keep the privacy the model was built to give them.
