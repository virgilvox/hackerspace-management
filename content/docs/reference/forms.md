Forms and waivers are per-space form definitions with a jsonb field schema, a lifecycle status, and a visibility setting. Every submission snapshots the schema and legal text it was signed against, so a waiver stays valid against exactly what the signer saw even after the form is edited. This page documents the field types, visibility rules, gating, and the immutable submission record. To build one, see [Build a form](/docs/how-to/build-a-form).

## Where forms live

Managers work with forms at [/forms](/forms): created at [/forms/new](/forms/new), edited at `/forms/{id}/edit`, and their submissions viewed at `/forms/{id}/results`. Public and signed-in forms are filled at `/f/{space}/{slug}`; members-only forms are filled from inside the app. Managing forms requires the `forms.manage` permission, seeded to the `board` role by default (admins always have it via implicit-all). Ordinary members can read only `published` forms.

## Form record

Each form is one row in the `forms` table.

| Field | Type | Notes |
| --- | --- | --- |
| `slug` | text | Unique per space. Lowercase letters, numbers, and internal hyphens; 1-80 chars. Immutable after creation. |
| `title` | text | 1-200 chars. |
| `description` | text | Optional, up to 2000 chars. |
| `kind` | enum | `form` or `waiver`. |
| `visibility` | enum | `public_anon`, `public_auth`, or `members`. |
| `status` | enum | `draft`, `published`, or `closed`. |
| `schema` | jsonb | Ordered array of field definitions (see below). |
| `legal_text` | text | Optional legal/consent text, up to 100000 chars. |
| `version` | integer | Starts at 1; bumps on waiver edits (see [Versioning](#versioning)). |

The slug is unique per space (`UNIQUE (space_id, slug)`), not globally, so two spaces can use the same slug.

## Field types

The `schema` is an ordered array of fields. Each field has a `key` (lowercase letters, numbers, underscores; 1-60 chars; unique within the form), a `label`, an optional `help` string, and an optional `required` flag (default `false`). A form may have up to 200 fields.

| `type` | Answer stored as | Server validation |
| --- | --- | --- |
| `short_text` | trimmed string | max 2000 chars |
| `long_text` | trimmed string | max 20000 chars |
| `email` | trimmed, lowercased string | must match an email pattern |
| `number` | number | must be finite |
| `date` | string | must parse as a date |
| `checkbox` | boolean | if `required`, must be checked (`true`) |
| `select` | string | must be one of `options` |
| `radio` | string | must be one of `options` |

`select` and `radio` fields require an `options` array (each option 1-200 chars, up to 100 options). Answers are validated server-side against the stored schema on submit: unknown keys are discarded, empty required fields are rejected, and only known fields are persisted.

## Member linking

A submission links to a member when its `submitter_email` matches a member in the same space (case-insensitive); if several members share an email, the earliest-joined one is chosen. For members-only and signed-in forms the linked member and email come from the authenticated session. For anonymous public submissions the email may be typed or derived from an `email`-type answer; linking by a typed email is an intentional attribution-only behavior that grants no access. Managers can re-run linking across the space, and members can retro-claim their own prior anonymous submissions once their email is verified.

## Visibility

Visibility controls who can open and submit a form.

| `visibility` | UI label | Who can submit | Public URL |
| --- | --- | --- | --- |
| `public_anon` | Public | Anyone, no sign-in | `/f/{space}/{slug}` |
| `public_auth` | Signed in | Any signed-in user | `/f/{space}/{slug}` |
| `members` | Members only | Members of the space | Not served publicly; filled in-app |

Members-only forms are never returned by the public page, so their schema is not exposed to non-members. The public read path serves only a `published` form and never a `members` form. A form must be `published` to accept responses regardless of visibility; `draft` and `closed` forms reject submissions.

## Required-form gating

A class definition can reference a form as its `required_form_id`. When set, the form gates signups for that class's sessions: a member cannot sign up until they have a submission on file for that form. The referenced form must be `published` before it can gate signups. See [Classes and sessions](/docs/reference/modules) and the class screens under [/classes](/classes).

## Submission snapshots

Submissions are rows in `form_submissions`. Each row captures a point-in-time copy of the form so the record is self-contained:

| Field | Notes |
| --- | --- |
| `answers` | jsonb, keyed by field `key`; only known, validated fields. |
| `form_snapshot` | The field schema as it was at submit time. |
| `legal_text_snapshot` | The legal text as it was at submit time. |
| `form_version` | The form's `version` at submit time. |
| `member_id` | Linked member, if resolved (see below). |
| `submitter_email` | Provided or derived email, lowercased. |
| `ip`, `user_agent`, `created_at` | Request metadata and timestamp. |

Submissions are immutable and append-only. The `form_submissions` table has no client insert, update, or delete policy under row-level security, so every submission is written by one validated server action using the service client, after server-side schema validation and snapshotting. Managers can read submissions (`forms.manage`) and permanently delete a single submission from the results screen. Deleting a form cascades and permanently removes all of its submissions, including signed waivers; this requires an explicit confirmation.

Results are viewable at `/forms/{id}/results` and can be exported to CSV. The CSV header is `submitted_at`, `form_version`, `member_id`, `submitter_email`, `ip`, followed by one column per field key.

## Waivers and versioning {#versioning}

A form with `kind` set to `waiver` requires the submitter to agree (a consent flag must be `true`) before the submission is accepted. A form's `version` starts at 1. Editing bumps the version only when it is a `published` waiver and either the legal text or the field schema actually changed. This is a non-blocking re-sign: existing submissions stay valid against their own snapshot, and only new signers see the bumped version. Ordinary forms and draft waivers never bump their version on edit.
