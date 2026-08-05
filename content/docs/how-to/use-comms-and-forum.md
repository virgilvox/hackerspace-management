Your space has two ways to talk: **Comms** at [/comms](/comms) for fast, real-time chat in channels, and the **Forum** at [/forum](/forum) for longer threaded discussion that sticks around. This recipe covers posting to channels, starting and moderating threads, and who is allowed to do what.

## Before you start

- **Post messages, create channels, start threads, comment:** any current member of the space.
- **Pin or lock a thread:** the `admin` or `board` role. The `forum.moderate` permission carries this and is granted to `board` by default (see [Roles and permissions](/docs/reference/roles-and-permissions)).
- **Delete a thread:** its author, or an admin.
- **Delete a comment:** its author, an admin, or a board member.
- Comms and Forum are space-wide. Every member sees every channel and every thread. There is no per-tier, per-role, or visibility gate on channels or threads, so treat them as open to your whole membership.

## Post to a comms channel

1. Open [/comms](/comms) and pick a channel from the sidebar. New spaces start with three: `general`, `announcements` (both `general` type), and `ops`.
2. Type in the message box and press **Enter** to send (up to 4000 characters).
3. Your message appears instantly and is delivered to everyone viewing the channel in real time.

Messages are read on the browser client through a realtime subscription, but sending goes through the `sendMessage` server action. Your sender identity (display name, handle, and space) is derived server-side from your session, never from the browser, so you cannot post as someone else or into another space's channel.

### Channel types

Channels carry one of four types: `general`, `area`, `ops`, or `project`. The sidebar groups them under General, Areas, and Projects. When you create a channel the picker offers general, area, and project; `ops` is used by the seeded operations channel.

### Create a channel

1. In the [/comms](/comms) sidebar, click **New channel**.
2. Enter a name (lowercase letters, numbers, and hyphens only, up to 50 characters, unique within your space).
3. Optionally add a description, choose a type, and click **Create**.

Any member can create a channel. The creator or an admin or board member can rename it; a non-default channel can be deleted by its creator or an admin or board member. The default `general` channel cannot be deleted.

## Start a forum thread

1. Go to [/forum](/forum) and click **New thread** (or open [/forum/new](/forum/new)).
2. Enter a **Title** (up to 200 characters).
3. Pick a **Category**: General, Announcements, Projects, Help, Feedback, or Off topic.
4. Write the **Body** in Markdown (headings, lists, code blocks, and links are supported), then click **Post thread**. You land on the new thread page.

### Comment on a thread

Open any thread at [/forum/[id]](/forum) and add a comment (up to 10000 characters). Reply to an existing comment to nest the discussion. You can edit or delete your own comments; admins and board members can remove any comment. If a thread is **locked**, new comments are rejected.

## Moderate the forum

Admins and board members see extra controls on a thread:

- **Pin** keeps a thread at the top of the list.
- **Lock** stops new comments while keeping the thread readable.
- **Delete** removes the thread and all of its comments. This cannot be undone.

Pinning and locking are restricted to the `admin` and `board` roles. Deleting a thread is restricted to its author or an admin (board members cannot delete a thread they did not write, though they can delete comments).

## Related

- [Roles and permissions](/docs/reference/roles-and-permissions) for what each role can do.
- [Customize your space](/docs/how-to/customize-space) to set up the areas your channels and threads reference.
