# Governance feature proposals

A diagnostic-to-feature mapping from twelve recurring institutional pain patterns documented in real hackerspace operations. Filtered through three questions:

1. **Does this generalize?** Will it serve any hackerspace, not just one with HeatSync Labs's specific bylaws, room layout, or political history?
2. **Does it solve a recurring pain?** Not an interesting capability; a documented every-few-months problem.
3. **Does it fit the existing model?** Multi-tenant (`space_id` on every row), RLS-enforced, role-gated (`admin`, `board`, `treasurer`, `member`, `associate`), built on Supabase. Avoid features that require new infrastructure (door hardware, SMTP, IdP, federation protocols) unless the operator has already deployed them.

What follows is what I'd actually add. Things I'd reject or defer are at the end.

---

## Architectural principles for any new feature

Three rules govern every proposal below.

1. **Privacy default for individuals; transparency default for institutions.** A member's payment notes are private. The vote a board member cast on a proposal is public. Schema choices reflect this.
2. **Audit trails for governance, not for member behavior.** Who voted yes on proposal X is logged forever. Whether a member opened the chat at 2am Tuesday is not logged at all.
3. **Configuration per space; no hardcoded politics.** Bylaws section numbers, quorum percentages, voting windows, role names, "Hack Your Heart Out" night, anonymity policy — all of it lives in `spaces` settings or per-proposal config. The app ships sensible defaults; each space overrides.

---

## Tier 1: the governance kernel (Phase 1) — SHIPPED 2026-05-14

Status: implemented end-to-end (schema, server actions, validations, tests, UI). See `docs/HANDOFF.md` pass 5 for the build summary.

Migration: `scripts/016_governance_kernel.sql` (also folded into `scripts/schema.sql` as Section 9). Routes: `/proposals`, `/proposals/[id]`, `/proposals/new`, `/incidents`, `/incidents/[id]`, `/incidents/new`, `/policies`, `/policies/[slug]`, `/policies/new`. Tests: 40 schema-validation tests in `__tests__/governance.test.ts`. Sidebar nav has a new "Governance" group.

The three top-frequency patterns (CoC complaints, information asymmetry, async voting) collapse into one tightly integrated module: **proposals + incidents + policies**. Built together; each references the others.

### 1.1 `proposals` and `proposal_votes`

The single most valuable feature. Generalises patterns 3, 4, 5, 10, 12.

```
proposals
  id                uuid PK
  space_id          uuid FK → spaces
  title             text
  body              text (markdown)
  proposer_id       uuid FK → space_members
  proposer_name     text (denormalized for history)
  proposal_type     enum: 'bylaw_change' | 'board_action' | 'membership_vote'
                          | 'advisory_poll' | 'recall' | 'budget'
  status            enum: 'draft' | 'open' | 'decided' | 'withdrawn' | 'expired'
  quorum_required   integer (absolute count, computed when proposal opens)
  quorum_percent    integer (the percentage from space settings at time of open)
  threshold         enum: 'simple_majority' | 'two_thirds' | 'three_fourths' | 'unanimous'
  voting_opens_at   timestamptz
  voting_closes_at  timestamptz
  policy_ref_id     uuid FK → policies (nullable; for bylaw-change proposals)
  parent_incident_id uuid FK → incidents (nullable; for appeals)
  outcome_yes       integer (frozen at close)
  outcome_no        integer (frozen at close)
  outcome_abstain   integer (frozen at close)
  passed            boolean (frozen at close)
  created_at, updated_at, decided_at

proposal_votes
  id                uuid PK
  proposal_id       uuid FK
  member_id         uuid FK → space_members
  position          enum: 'yes' | 'no' | 'abstain' | 'recused'
  recusal_reason    text (required iff position = 'recused')
  comment           text (optional public comment on vote)
  voted_at          timestamptz
  UNIQUE (proposal_id, member_id)
```

**RLS**:
- SELECT: members of the space.
- INSERT proposal: any active member (proposing is universal).
- UPDATE proposal: proposer while `status = 'draft'`; admin/board for status transitions.
- INSERT/UPDATE vote: voter on their own row only, only while `voting_opens_at <= now() < voting_closes_at`.
- DELETE vote: never.

**Why this generalises**: every cooperative has decisions. The differences (quorum percent, threshold rule, voting window length) are configuration, not code. The hardcoded thing HSL did — "Member-Called Special Elections" — becomes one of several `proposal_type` values; the threshold and quorum are read from space settings at proposal-open time.

**What it solves**:
- Async voting (Pattern 3): voting_opens_at and voting_closes_at do the work.
- Vote-of-confidence as a first-class workflow (Pattern 3): proposal_type='recall'.
- Decision archive (Pattern 4): closed proposals are immutable and full-text searchable.
- Recusal log (Pattern 5): `position='recused'` with required reason.
- Vote-record visibility (Pattern 5): a member's voting history is a query, not a leak.
- Quorum/threshold transparency (Pattern 12): both are stored on the proposal at open time, displayed on the proposal page, no procedural disputes possible.

**Defaults a space should set** (new fields on `spaces`):
- `default_quorum_percent` (e.g. 10)
- `default_quorum_floor` (e.g. 8 — "10% or 8, whichever is greater")
- `default_voting_window_hours` (e.g. 216 for 9 days)
- `default_threshold` (e.g. 'simple_majority')

The proposal page shows live counts as votes come in, computes whether quorum is met, shows the outstanding required count if not. No spreadsheet, no manual tally.

### 1.2 `incidents` (CoC complaints, safety reports, conflicts)

Generalises Pattern 1 (the CoC complaint black hole) plus the chain-of-custody concern that recurs in every cooperative.

```
incidents
  id                  uuid PK
  space_id            uuid FK → spaces
  reporter_id         uuid FK → space_members (nullable; null when anonymous)
  reporter_token      text (server-generated, opaque; lets anonymous reporter check status)
  is_anonymous        boolean
  subjects            uuid[] (optional FKs to space_members; the people the report is about)
  category            text (e.g. 'code_of_conduct', 'safety', 'theft', 'harassment')
                            — free-form so each space defines its own taxonomy
  severity            enum: 'low' | 'medium' | 'high' | 'critical'
  title               text
  body                text
  status              enum: 'received' | 'under_review' | 'decided' | 'appealed' | 'closed'
  disposition         text (markdown; what the board/admin decided)
  decision_makers     uuid[] (FKs to space_members)
  appeal_proposal_id  uuid FK → proposals (set when an appeal is filed)
  sla_response_by     timestamptz (computed: created_at + space.incident_sla_days)
  created_at
  acknowledged_at     timestamptz (when board first marked under_review)
  decided_at          timestamptz
  closed_at           timestamptz

incident_updates
  id                  uuid PK
  incident_id         uuid FK
  author_id           uuid FK → space_members
  body                text
  visibility          enum: 'reporter_only' | 'all_parties' | 'board_only'
  created_at
```

**RLS**:
- SELECT: reporter + admins/board + named subjects (configurable per space). Anonymous reporters use the `reporter_token` to fetch their own report via a public route; the token never appears in lists.
- INSERT: any active member, or anonymous via a rate-limited public endpoint that requires a turnstile/captcha.
- UPDATE: admin/board (status, disposition); reporter can add `incident_updates` only.
- DELETE: never. Incident records are retained.

**Status notifications**: every status change inserts a row into the existing `activity_log` AND triggers a notification to the reporter (in-app comms message; email if configured). Silence becomes structurally impossible because the schema *requires* a status transition for action, and every transition notifies the filer.

**Appeal pathway**: closing an incident in `disposition='dismissed'` exposes a "request membership review" button visible to the reporter. Clicking it creates a `proposals` row with `parent_incident_id` set, pre-populated body, and `proposal_type='recall'` or `'membership_vote'`. The appeal is then a normal proposal with normal voting mechanics.

**Pattern surfacing**: an admin/board view groups incidents by overlapping subjects. Three independent incidents naming the same member surface as a single card, even if each individual incident was dismissed. No machine-learning needed; just `SELECT subjects, count(*) FROM incidents WHERE subjects @> ARRAY[<member_id>]`.

**On anonymity**: I would not promise cryptographic anonymity. The honest implementation is "the database admin can read the report; the rest of the board cannot tie it to a member". A `reporter_token` provides status-tracking without UI-level identity. If a space wants stronger anonymity it can disable `reporter_id` storage entirely via a space setting; the cost is that the reporter cannot prove authorship if disputed later.

### 1.3 `policies` (versioned bylaws, code of conduct, station rules)

Generalises Patterns 4 and 12.

```
policies
  id                  uuid PK
  space_id            uuid FK → spaces
  slug                text (e.g. 'bylaws', 'code-of-conduct', 'laser-station-rules')
  section_ref         text (free-form; each space defines its own structure, e.g. '8.4' or 'Article III §2')
  parent_policy_id    uuid FK → policies (nullable; nests policies, e.g. CoC under Bylaws)
  title               text
  body_formal         text (markdown; legalese version)
  body_plain          text (markdown; plain-language summary — Pattern 12, Kirk's "explain to a five-year-old")
  version             integer
  prior_version_id    uuid FK → policies (null for v1, points back for v2+)
  status              enum: 'draft' | 'active' | 'deprecated' | 'superseded'
  effective_at        timestamptz
  adopted_by_proposal_id  uuid FK → proposals (nullable; null for migrated-in initial versions)
  created_at, updated_at
  UNIQUE (space_id, slug, version)
```

**RLS**:
- SELECT: members.
- INSERT: admin/board.
- UPDATE: never (immutability). Edits insert a new row with incremented `version` and `prior_version_id` pointing back.
- DELETE: never. Deprecation flips `status='deprecated'`.

**Diff view**: a UI route renders any two versions side-by-side. Implemented client-side from the two rows.

**Citation linking**: any `proposals.body` markdown supports a `[policy:bylaws#8.4]` syntax that renders as a hover-card with the clause's current text. Same for `incidents.body`. Members vote knowing what they're voting on.

**Why versioning matters**: Pattern 4 is "Why is this rule here?" The chain `policy v3 → adopted_by_proposal → proposal.created_at → proposal_votes` is the answer. A query reconstructs the institutional history of any clause.

---

## Tier 2: information-equity extensions (Phase 2) — SHIPPED 2026-05-14

Status: schema fully in place (migration 018). `/financials` route shipped end-to-end (gated by `space.financial_visibility`). Member directory visibility column + COI disclosure + skills/interests/willing_to columns ready; UI for those follows.

These are smaller and mostly extend existing tables. Generalise Pattern 2 (information asymmetry).

### 2.1 Member directory transparency

The pain: an incumbent withholding the cardholder count. Fix in three lines.

- Add a space setting: `member_directory_visibility` enum (`public_members_visible`, `member_count_visible`, `board_only`). Default: `member_count_visible`.
- The members page renders an aggregate count box visible to whatever the setting allows. The page already exists; this is one query.
- A space setting `member_directory_public` exposes the directory to non-members at `<host>/<slug>/members`. Off by default.

No new tables. Just settings + queries.

### 2.2 Financial dashboard

The pain: members not knowing about rent increases until "the numbers were posted".

- A new server-component route `/financials` that renders aggregates from `payments`: income by month, by platform, by member tier; counts of linked vs unlinked.
- A space setting `financial_visibility` enum (`treasurer_only`, `board_visible`, `all_members_visible`). Default: `board_visible`.
- Optional: an `expenses` table for non-Stripe outflows (rent, insurance, supplies). One row per expense with category, amount, paid_on, payee, note. RLS gates by `financial_visibility`.
- Optional: a `recurring_obligations` table (rent, insurance, ISP) with monthly amount and renewal_at. The dashboard sums these into a "monthly burn" figure.

The "runway" metric is `(cash_on_hand - 3*monthly_burn) / monthly_burn`. Display it. Members making decisions about expansion need this.

### 2.3 External-account control registry

The pain: Flores controlling Facebook with no transfer mechanism.

- Extend `integrations` (already exists) to also model non-OAuth platforms: Facebook page, Twitter, mailing list, domain registrar. Add fields: `account_holder_member_id`, `recovery_email`, `transfer_documented_at`.
- A board-visible page lists every external account with the responsible member and last-verified date.
- An annual `transfer_documented_at` check: if a board member rotates, the page surfaces "these accounts have not been re-verified since the rotation."

No new table; columns on `integrations`.

### 2.4 Board meeting minutes auto-distribution

The pain: "we decided X privately for privacy reasons."

- New `kb_visibility` enum value: `board_meeting`. Any KB entry tagged board_meeting is visible to all members and pushed as a comms notification when published.
- Optionally: a space setting `board_minutes_sla_hours` (default 48). A scheduled job alerts admins if a board meeting (logged via a separate `meetings` table or a calendar feature) ended more than that many hours ago without published minutes.

Light-touch. Mostly UI work on top of `knowledge_base`.

---

## Tier 3: member-state extensions (Phase 2 continued) — SHIPPED 2026-05-14

Status: all schema in migration 018. Server actions for self-profile and COI disclosure built. Card-access mid-tenure review trigger live. `inactive_members` view live. UI for self-editing profile / disclosing affiliations follows.

Each one is a small column-set extension to `space_members`. None requires new tables.

### 3.1 Skill / interest / willing-to fields

Generalises Pattern 10 (succession infrastructure).

Add to `space_members`:
- `skills text[]`
- `interests text[]`
- `willing_to text[]` (e.g. `'board_candidate'`, `'treasurer'`, `'host_volunteer'`, `'area_lead:laser'`)

A new server-component route `/recruitment` (board-visible) queries `willing_to`. Recruitment becomes "show me members who marked `'board_candidate'`" instead of one person's manual outreach.

Strictly opt-in. Members write their own values. No automatic skill inference, no behavioural scoring.

### 3.2 Conflict-of-interest disclosure

Generalises Pattern 5.

Add to `space_members`:
- `affiliations text[]` (free-form: organizations the member is associated with)
- `coi_last_disclosed_at timestamptz`

A space setting `coi_disclosure_required_for_roles text[]` lists roles that must keep COI current (default: `['admin', 'board', 'treasurer']`). When a member in one of those roles has `coi_last_disclosed_at < now() - 365 days`, the dashboard surfaces a "disclose your affiliations" reminder. Affiliations are visible to all members of the space; the role-vs-affiliation comparison is the institutional check.

### 3.3 Mid-tenure card review

Generalises Pattern 7.

- When `has_card_access` flips from false → true, the schema fires a trigger that inserts a `tasks` row: `task_type='admin'`, `title='Card-access review: <display_name>'`, `due_date=now() + 180 days`, `assigned_to_role='board'`.
- The existing tasks page surfaces it like any other due task. Resolution is a normal task completion, with an optional note that appears in the member's profile.

Pure schema work; uses the `tasks` table that already exists.

### 3.4 Re-engagement detection

Generalises Pattern 7's "faded-out members are still members."

- A view `inactive_members` that computes membership rows with no entries in `activity_log` for the past 180 days.
- The members page renders a filter chip "Inactive (N)" that toggles the view.
- An optional "send re-engagement message" action that drops a templated message into the member's DM channel (when DMs ship — not in Phase 1).

No new table; one view.

---

## Tier 4: operational additions (Phase 3)

Lower frequency but real. Build only after Tier 1 and 2 land.

### 4.1 Hosting calendar

Generalises Pattern 9.

```
host_shifts
  id              uuid PK
  space_id        uuid FK
  host_id         uuid FK → space_members
  starts_at       timestamptz
  ends_at         timestamptz
  swap_requested  boolean
  swap_note       text
  created_at, updated_at
```

Members claim, swap, cancel. The space page renders the next 30 days. Notifications when a shift is unclaimed within 24 hours of starting.

### 4.2 Sponsor / partner registry

Generalises Pattern 8.

Two options. Pick one.

Option A (cheaper): extend `contacts` with `status` enum (`active, paused, withdrawn, prospective`) and `liaison_member_id`. Contacts already supports a `contact_type='partner'` value.

Option B (cleaner): a new `organizations` table separate from `contacts` (which is people-shaped). Add `engagement_log` rows for status changes with notes.

I'd start with Option A. Migrate to Option B if it outgrows.

### 4.3 Community survey

Generalises Pattern 11.

```
surveys
  id               uuid PK
  space_id         uuid FK
  title            text
  body             text
  opens_at, closes_at
  status           enum: 'draft' | 'open' | 'closed'
  is_anonymous     boolean
  visibility_of_results enum: 'admin_only' | 'board_visible' | 'all_members'

survey_questions
  id, survey_id, prompt, response_type (likert | text | multi_choice), options jsonb, required

survey_responses
  id, survey_id, member_id (nullable iff anonymous), submitted_at

survey_answers
  id, response_id, question_id, value text / value_int
```

A space sets an annual baseline survey (trust in board, welcoming to marginalized groups, project completion vs frustration, mission alignment). Results render as a time series across years. No scoring, no leaderboard. Read-only analytics for the membership.

### 4.4 Mission statement display

Generalises Pattern 11.

Add `mission_statement text` to `spaces`. Each space writes its own. Renders in the page footer everywhere. No template; pure freeform.

---

## What I would not build

These are real concerns in the source analysis but they fail one of the three filters (don't generalise, infrastructure-too-heavy, or solve a workflow problem better solved by workflow).

| Item from the source | Why I'd skip |
|----------------------|--------------|
| Cryptographic anonymity for complaints | Over-promises. The DB admin can always read. Honest "anonymous-reported, opaque token for status" covers 95% of cases; a hackerspace that needs stronger anonymity should use Signal. |
| Discourse / Loomio integration | We already ship comms + KB. Adding a third governance forum on top fragments more than it consolidates. If a space wants Discourse they can self-host it; we don't need to be it. |
| Door-system access logging | Hardware integration. Out of scope for a CRUD app. Operators can wire whatever access controller they have to write to `activity_log` via the existing service-role API if they want to. |
| Cross-platform identity unification (SAML/OIDC across Slack/Discord/wiki) | Each space's other tools are different. We provide a stable internal identity. Federation is out of scope. |
| External-perception dashboard (social media monitoring) | Belongs in a separate marketing tool. Not core to running the space. |
| Pattern-detection ML on incidents | Just surface raw co-occurrence. Humans are better at "is this a pattern?" than a classifier on 12 incidents/year. |
| Term-limits enforcement | Configurable bylaws can vary too widely. Display "term ends on YYYY-MM-DD" if a member has one. Don't auto-kick. |
| Onboarding curriculum modules per station | Too space-specific. Each space defines its own stations. A station might be a laser, a forge, or a bee hive. Generic "modules" become useless abstraction. The existing KB plus a `prerequisite_kb_ids` field on tasks covers the 80% case. |
| Public-private framing surveillance (tracking DM contradictions) | Even the source analysis flagged this as wrong. Make the institutional record so visible that drift is self-evident. Don't watch private conversations. |
| Email digest summarisation with sentiment scoring | Building a "drama detector" is a tar pit. Provide structured decision logs and let members read those instead of chat backlog. |

---

## Schema and code impact summary

If Tier 1 ships, the changes are:

**New tables**: `proposals`, `proposal_votes`, `incidents`, `incident_updates`, `policies`.

**Modified tables**: `spaces` gains ~6 settings columns (defaults for quorum, voting window, visibility flags, SLA, mission statement).

**New enums**: `proposal_type`, `proposal_status`, `vote_position`, `threshold_rule`, `incident_status`, `incident_severity`, `incident_visibility`, `policy_status`.

**New RLS policies**: ~20 (4 per new table × 5 tables, roughly).

**New routes**: `/proposals`, `/proposals/[id]`, `/proposals/new`, `/incidents`, `/incidents/[id]`, `/incidents/new`, `/incidents/track/[token]` (public, for anonymous status), `/policies`, `/policies/[slug]`, `/policies/[slug]/[version]`.

**New server actions in `lib/actions/`**: a new `governance.ts` (or split into `proposals.ts`, `incidents.ts`, `policies.ts`). Each uses the existing `requireMember` / `requireMemberWithRole` / `parseInput` helpers. Each emits an `activity_log` row via the existing `logActivity` helper.

**New triggers in `scripts/schema.sql`**:
- One to insert a card-review task when `has_card_access` flips true.
- One to freeze `outcome_*` on `proposals` when status transitions to `decided`.
- One to update `policies.prior_version_id` and increment `version` when a new row replaces an active one.

All within the architecture already in place. No new dependencies, no new auth providers, no new background workers (the proposal-close action can be a cron-triggered DO endpoint that runs once an hour).

---

## Sequencing recommendation

Build Tier 1 first, as one cohesive thing, because the three modules reference each other and shipping them piecemeal leaves gaps:

1. `proposals` and `proposal_votes` (basic CRUD + voting)
2. `policies` with versioning
3. `incidents` with reporter notification and appeal-as-proposal linking
4. Cross-references between the three working (citation linking, appeal pathway)

This is roughly 3 months of focused work for one engineer including UI. The schema work is a week; the rest is forms, lists, detail pages, RLS testing, and writing the in-product help that explains what each thing does to a non-political member.

Then Tier 2: financials and member-state extensions. Mostly UI on top of existing tables; 1 month.

Then Tier 3 as appetite allows.

---

## A meta-observation

The source analysis warns: "Cooperatives die more often from bureaucratic creep than from under-tooling." This is correct. The features above only help if they make institutional work *easier*, not if they make it more elaborate. The test for any new screen: would a tired board member at 11pm on a Tuesday actually use this, or would they slack-message the chair instead? If the answer is "slack-message the chair," the feature is wrong.

The simplest test for the proposals module: can a member, in two minutes, file a vote-of-confidence proposal that hits all the required procedural elements (quorum stated, threshold stated, voting window defined, bylaws clause cited)? If yes, it's good. If they have to read three help pages first, simplify the form.

The simplest test for the incidents module: when a complaint is filed and the board dismisses it, does the reporter receive an unambiguous in-app notification within 24 hours that names the decision-makers and provides a one-click path to a membership appeal? If yes, the black hole is closed. If they have to ask, the feature failed.

Build for what hurts repeatedly. Defer what hurts occasionally. Reject what hurts hypothetically.
