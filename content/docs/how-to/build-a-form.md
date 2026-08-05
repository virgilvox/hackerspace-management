Build a custom form or a signable waiver, choose who can submit it, share it, and read the responses. This recipe covers the whole lifecycle from the form builder at [/forms](/forms) through published results.

This is an admin-side task. You need the `forms.manage` permission, which is granted to the `admin` and `board` roles by default. If the Forms screen is not available to you, ask an admin to grant it.

## Create the form

1. Go to [/forms](/forms) and choose **New form**. You land in the builder at [/forms/new](/forms/new).
2. Set the **Type**:
   - **Form**, a plain form (surveys, interest lists, equipment requests).
   - **Waiver**, a form that requires the signer to agree to legal/consent text before submitting.
3. Enter a **Title**. As you type, a **Link slug** is generated for you; edit it if you want. The slug is lowercase letters, digits, and hyphens (1-80 characters) and must be unique within your space. It becomes the public address `/f/<space>/<slug>`. The slug and the Type cannot change after creation, so pick them deliberately.
4. Optionally add a **Description** shown above the fields.
5. For a **Waiver**, fill in **Waiver / consent text**. This is the exact text the signer must agree to, and it is snapshotted into every signature (see [Immutable submissions](#immutable-submissions)).

## Add fields

In the **Fields** section, add one field per answer you want to collect. The available field types are:

| Builder button | Type | Collects |
| --- | --- | --- |
| Text | `short_text` | A single line (up to 2000 chars) |
| Paragraph | `long_text` | Multi-line text (up to 20000 chars) |
| Email | `email` | A validated email address |
| Number | `number` | A numeric value |
| Date | `date` | A calendar date |
| Checkbox | `checkbox` | A yes/no box |
| Dropdown | `select` | One choice from a list |
| Choice | `radio` | One choice from a list |

For each field:

- Edit the label in place.
- For **Dropdown** and **Choice**, add or remove options with **Add option**.
- Toggle **Required** to force an answer. A required checkbox must be checked to submit.
- Reorder with the up/down arrows, or remove a field with the trash icon.

The **Live preview** panel on the right renders the form exactly as a submitter sees it, including the "I agree to the waiver above" checkbox for waivers.

When you are done, choose **Create form**. The form is created as a **draft** and you land on its edit page.

## Set who can submit

The **Who can submit** setting controls visibility:

| Option | Stored value | Who can submit | Public link |
| --- | --- | --- | --- |
| Members only | `members` | Signed-in members of your space | No, filled inside the app |
| Anyone signed in | `public_auth` | Any signed-in user | Yes |
| Anyone (no account) | `public_anon` | Anyone, no account needed | Yes |

You can change visibility any time from the builder. Members-only forms are never served on the public page, so their fields stay private to your space.

## Publish and share

A draft is not visible to anyone. On the form's edit page, choose **Publish** to make it live and start accepting responses.

- For a public form (`public_auth` or `public_anon`), the builder shows the public URL with a **Copy link** button. The list at [/forms](/forms) also has a copy-link action for published public forms. Share that link however you like.
- For a **Members only** form, there is no public link. Members submit it from inside the app.

Use **Close** to stop accepting responses (existing responses are kept), or **Back to draft** to hide it again. **Re-publish** a closed form to reopen it.

## Read the results

Open **Results** from [/forms](/forms) or go to `/forms/<id>/results`. You get a table of every response, newest first, with the submitter (member, email, or Anonymous) and each field answer. Use **Export CSV** to download all responses. You can delete a single response, or delete the whole form.

Deleting a form is permanent and cascades to every response, including signed waivers. Export first if you need a record.

## Immutable submissions

Every submission is an append-only snapshot. At submit time the platform stores a copy of the field schema, the waiver text, and the form version alongside the answers. Later edits to the form never alter past submissions, so a signed waiver stays valid against exactly what that signer saw. Submissions cannot be edited by anyone, only deleted.

Editing a published waiver's legal text or fields bumps its version. Existing signatures remain valid against their own snapshot; only new signers see the new version.

## Related

- [Forms](/forms), manage your forms and waivers
- [Members](/members), see a member's linked form submissions
- [Invite links](/docs/how-to/invite-links)
