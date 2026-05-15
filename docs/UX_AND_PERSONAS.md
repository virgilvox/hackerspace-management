# UX Notes and Personas

This document captures the persona model and the UX audit that drove the
configurable-onboarding feature. It is a working reference, not marketing copy.

## Personas

A single hackerspace install serves several distinct people. They share a
codebase but have different jobs-to-be-done. Research consistently shows the
first real onboarding in a multi-tenant tool belongs to an admin, not an end
user, and that role-based segmentation lifts activation 30 to 50 percent over a
one-size-fits-all flow. The product reflects that split.

### 1. The Founder / Admin ("Dana")

- Starts the space. Technical or technical-adjacent. Wants the space
  configured: members imported, dues collected, areas defined, channels set up.
- Cares about configuration, permissions, and not losing data.
- Jobs: stand up the space, get money flowing, delegate.
- Onboarding need: an admin setup path, not the member welcome flow. The app
  now marks the founder's `onboarding_completed_at` at space creation so they
  land directly on the dashboard.

### 2. The New Member ("Sam")

- Joined via an invite code. May be brand new to makerspaces.
- Cares about: am I allowed in, what are the rules, how do I pay, who do I
  talk to.
- Jobs: understand the code of conduct, set up dues, complete a profile, feel
  oriented.
- Onboarding need: a short, friendly, mostly non-blocking flow. This is the
  flow `/onboarding` implements. Real makerspace onboarding (Milwaukee, Dallas,
  MakerFX, Asmbly) is consistently: orientation, sign a code-of-conduct/waiver,
  start recurring dues, then tool training. The default steps mirror that.

### 3. The Operator / Board / Treasurer ("Riley")

- Recurring power user. Runs payments, proposals, incidents, area leads.
- Cares about visibility and throughput. Low onboarding need; high need for
  scannable lists and good empty states.

### 4. The Casual / Associate Member ("Jess")

- Low-frequency. Claims a chore, reads the forum, checks a policy.
- Cares about a low-friction path to the one thing they came for. Sidebar
  breadth is overwhelming for this persona; progressive disclosure matters.

## Onboarding principles applied

From current UX research (Appcues, Userpilot, NN/g progressive disclosure,
B2B activation studies) and makerspace practice:

- Short: 3 to 5 steps, not 10. Defaults ship 4 (welcome, code of conduct,
  profile, payment).
- Personalized and configurable: each space edits, reorders, enables, requires,
  or adds steps. Not one-size-fits-all.
- Visible progress: a progress bar and "Step X of N" reduce abandonment.
- Value before commitment: the welcome and rules come before the dues nudge;
  payment is a non-blocking nudge by default ("Remind me later").
- Enforce only what matters: code of conduct is `required` by default; the
  server double-checks required steps so a tampered client cannot skip them.
- Escape hatch: if a space marks nothing required, members can "Skip for now".

## UX audit findings (prioritized)

The audit reviewed every authenticated page, the auth flow, and the layout.
Onboarding was the single highest-leverage gap and is now addressed. The
remaining findings are tracked for follow-up passes:

1. (Done) No post-signup onboarding. Implemented as configurable steps.
2. Sidebar icon collision: Ops and Settings both use the `Settings2` icon.
   Low effort, high clarity win.
3. Inconsistent empty states: roughly 17 variants. Forum, Policies, and
   Recruitment are the good models; the rest are blank or minimal. Recommend a
   single `Empty` component with icon, message, and a primary CTA.
4. Heading hierarchy differs between pages (dashboard large/white vs members
   small/mono). Recommend `PageTitle` / `SectionTitle` primitives.
5. No in-app "getting started" affordance for admins. The onboarding admin tab
   in Settings partially covers this for member-facing content; an admin
   checklist is still worth adding.
6. Cognitive load for first-time members: 16+ sidebar items with no role
   filtering. Consider hiding admin-only items for non-privileged roles.

Items 2 to 6 are intentionally deferred so the onboarding feature ships in a
reviewable change rather than a sprawling UI rewrite.
