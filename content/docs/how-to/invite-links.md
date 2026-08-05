Invite codes let new people join your space through a shareable code or one-click link. Each code can grant a specific role, cap how many times it is used, and expire on a date you choose — so you can hand out a permanent public code and a single-use admin link from the same screen.

## Before you start

- You need the **admin** role. In the UI, creating, editing, disabling, and deleting invites is admin-only. A **board** member can open the **Invite codes** panel — it is visible to admin and board — but sees only the read-only **Copy code** and **Copy link** buttons; the **+ New invite**, **Disable/Enable**, and **Delete** controls are hidden. (The underlying `createInvite` server action also permits board, but the panel does not expose it.)
- As the admin, you can grant any role with an invite, including **admin**.
- Invite codes live in the **Invite codes** panel on the [`/customize`](/customize) screen.

## Create an invite code

1. Go to [`/customize`](/customize) and find the **Invite codes** panel.
2. Click **+ New invite**.
3. Fill in the fields (all optional except the granted role, which defaults to **member**):

| Field | What it does |
| --- | --- |
| Code | The code people redeem. Leave blank to auto-generate an 8-character code. Typed codes are uppercased and limited to `A–Z`, `0–9`, and `-`, 4–32 characters, and must be unique across all spaces. |
| Label | A private note to remember what the code is for (for example, "Open house 2026"). |
| Expiry | A date and time after which the code stops working. Leave blank for no expiry. |
| Max uses | How many times the code may be redeemed. Leave blank for unlimited. Must be a positive number. |
| Grants | The role a member receives when they join with this code. The dropdown only lists roles you are allowed to assign. |
| Single use | Sets max uses to 1 and auto-disables the code after one join. |

4. Click **Create invite**. The new code appears at the top of the list with a `grants <role>` badge.

## Share the code or link

Each row has two buttons:

- **Copy code** — copies the raw code (for example, `K7P2R9QT`) to paste into a message.
- **Copy link** — copies a one-click join link in the form:

```
https://your-space.example/join/<space-slug>?code=<CODE>
```

The link lands new people on a space-scoped join page that carries the code into account creation. Anyone who redeems it becomes a member at the role the invite grants.

## Revoke or remove a code

These controls are admin-only.

- **Disable** turns the code off without deleting it. Redemptions stop immediately; you can **Enable** it again later. This is the quickest way to revoke a leaked or expired code.
- **Delete** removes the code permanently after a confirmation prompt.

A code also stops working on its own once it is disabled, past its expiry, or at its use cap. The list flags these with `disabled`, `expired`, and `at cap` markers, and each row shows its usage count (for example, `uses 3 / 10`).

## Notes and edge cases

- Disabling and deleting affect only future joins. Members who already joined keep their role; change it from [`/members`](/members).
- If your space requires approval, new joiners still land as unverified pending an admin's review. See [`/docs/reference/roles`](/docs/reference/roles) for what each granted role can do.
