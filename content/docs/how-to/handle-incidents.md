Incidents are how your space records code-of-conduct complaints, safety reports, and conflicts, then moves each one from a report to a decision. Any member can file; admins and board members triage. This recipe walks the whole path, including the anonymous option and the appeal-to-a-proposal exit.

## Before you start

- **File a report:** any member of the space.
- **Change status, record a disposition, scope update visibility, appeal:** `admin` or `board` role.
- A reporter always sees their own incident and its non-board updates, even without a privileged role.

## File a report

1. Go to [/incidents](/incidents) and click **File a report** (or open [/incidents/new](/incidents/new) directly).
2. Enter a **Title** (short summary, up to 200 characters) and describe **What happened** in the body — when, where, who was present, what was said or done.
3. Set **Category** (free text, e.g. `general`, `safety`, `harassment`, `theft`) and **Severity**.
4. Optionally check any **Subjects** — members the report concerns. Subjects are stored on the record but are not notified and do not gain read access by default.
5. Optionally check **File anonymously** (see below).
6. Click **File report**. A named report opens at its detail page; the incident starts in status `received`.

Severity is one of:

| Value | |
|---|---|
| `low` | |
| `medium` | default |
| `high` | |
| `critical` | |

## File anonymously

Checking **File anonymously** omits your name from the record and the activity log. In exchange you get a one-time **tracking token** shown on screen.

- The token is the only way to look the report up later — it is never emailed or displayed again. Save it immediately.
- Check status any time at [/track](/track) by entering the token. That view shows the report, its status timeline, a disposition once one exists, and updates that are not board-only.
- This is not cryptographic anonymity: an admin with direct database access can still see the row exists.

## Triage and move the incident

On the incident detail page (`/incidents/[id]`), admins and board members get an **Update status** control. Statuses:

| Status | Meaning | Timestamp stamped |
|---|---|---|
| `received` | Filed, not yet acknowledged | — |
| `under_review` | Acknowledged, being handled | `acknowledged_at` |
| `decided` | A disposition has been reached | `decided_at` |
| `appealed` | Reporter has appealed the decision | — |
| `closed` | Resolved and archived | `closed_at` |

When you select `decided` or `closed`, a **Disposition / reasoning** box appears. What you write there is visible to the reporter and is surfaced on the public tracking view. Deciding also records you in the incident's decision-makers.

## Post updates with scoped visibility

Use **Post an update** to add information, ask a question, or share a decision. Admins and board members choose a visibility for each note; reporters post at `all_parties`.

| Visibility | Who can read it |
|---|---|
| `reporter_only` | Admin/board and the reporter |
| `all_parties` | Admin/board and the reporter |
| `board_only` | Admin/board only — hidden from the reporter and the tracking view |

Each incident also has a discussion thread at the bottom of the page for members who can see the record.

## Appeal a decision

Once an incident is `decided`, the reporter sees a **Request membership appeal** form. Filing an appeal:

1. Creates a **draft** proposal of type `membership_vote` with a simple-majority threshold, linked back to the incident.
2. Flips the incident to `appealed`.
3. The action itself requires `admin` or `board` access.

The proposal opens as a draft so the language can be refined before voting — you still open it for voting yourself. From then on it behaves like any other proposal; see [Run a proposal](/docs/how-to/run-a-proposal). A link to the appeal proposal appears on the incident under **Appeal**.

Incidents are never deleted — the platform has no delete path, so the record is retained for the space's history.
