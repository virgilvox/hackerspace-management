Onboarding is the short, ordered flow a new member walks through the first time they open the app. You edit it under the **Onboarding** section of [/customize](/customize), in the **New member onboarding** card. This page shows you how to add, reorder, require, disable, and delete steps.

## Who can edit onboarding

Editing onboarding is role-gated:

| Action | Required role |
| --- | --- |
| Add a step (Custom or Form) | admin |
| Edit title, body, config, order, toggles | admin |
| Delete a step | admin (built-in steps can never be deleted) |

Board members can open [/customize](/customize) and see the onboarding steps, but the panel is read-only for them: the **+ Custom step** / **+ Form step** buttons are hidden and every field, toggle, and Delete control is disabled. Members who are neither admin nor board are redirected away from /customize entirely.

## Understand the built-in steps

Every space is seeded with four built-in steps when it is created. They are marked **built-in** and cannot be deleted — only disabled or reordered.

| Step | Type | Seeded as | Notes |
| --- | --- | --- | --- |
| Welcome to *space* | `welcome` | enabled, optional | Info screen, markdown body, never blocking |
| Code of Conduct | `code_of_conduct` | enabled, required | Body plus a required acknowledgement checkbox |
| Complete your profile | `profile` | enabled, optional | Prompts the member for display name, handle, bio, skills |
| Set up your dues | `payment` | enabled, optional | Dues nudge with an optional payment link button |

## The step types

There are six step types. The four above are built-in; the two you can add yourself are `content` and `form`.

| Type | Body editable | Extra config | Deletable |
| --- | --- | --- | --- |
| `welcome` | yes | — | no (built-in) |
| `code_of_conduct` | yes | `require_ack`, `ack_label` | no (built-in) |
| `profile` | no | — | no (built-in) |
| `payment` | yes | `payment_url` (link button) | no (built-in) |
| `content` | yes | — | yes |
| `form` | yes | `form_id` (published form) | yes |

Body fields accept markdown and a safe subset of HTML.

## Add a custom step

1. Go to [/customize](/customize) and open the **Onboarding** section.
2. Click **+ Custom step**. A new `content` step is appended at the bottom, titled "New step".
3. Edit the **title** field and the body textarea inline. Changes save when the field loses focus.

## Add a form or waiver step

Use this to make members sign a waiver or fill out a form as part of joining.

1. First create and **publish** the form under [/forms](/forms) (Forms & waivers). Only published forms can be linked.
2. In the **Onboarding** section, click **+ Form step**.
3. In the new step, use the **Select a form…** dropdown to pick the published form. Waivers are labelled `(waiver)`. The choice is stored as `form_id` on the step.

If there are no published forms yet, the step shows a prompt to create one first instead of a dropdown.

## Reorder steps

Each step row starts with a small number field — its `sort_order`. Type a new number and click away; steps re-sort by ascending order. Lower numbers run first. New steps are added with an order one higher than the current maximum.

## Toggle required and enabled

Each step has two checkboxes:

- **Enabled** — unchecked steps are hidden from the flow entirely.
- **Required** — the member cannot finish onboarding until every *enabled and required* step is completed.

Edge cases worth knowing:

- A member can only **skip** onboarding when no enabled step is required. If any enabled required step exists, skip is refused.
- A required `form` step is satisfied once a submission for the linked form exists for that member. If the linked form is missing or unpublished, the step is treated as non-blocking so a misconfiguration cannot lock members out.

## Delete a step

Only custom (`content`) and `form` steps show a **Delete** button, and only for admins. Built-in steps have no delete control — disable them instead. Deleting asks for confirmation and is permanent.

## Related

- [Onboard members](/docs/tutorials/onboard-members)
- [Invite links](/docs/how-to/invite-links)
- [Import members](/docs/how-to/import-members)
