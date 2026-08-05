Projects are how your space tracks shop builds and multi-step work on a shared board: backlog, in progress, review, and done. Any member can create a project and move it across the board; only board members and admins can delete one. This recipe covers creating a project, setting its details, and reading progress on the board.

## Before you start

- **View the board, create a project, change a project's status:** any current member of the space.
- **Delete a project:** `board` or `admin` role. The board's delete control is offered to everyone, but the database rejects the delete unless you hold one of those roles, so a non-privileged member will see an error.
- Projects are scoped to your space. You only ever see and edit projects that belong to the space you are a member of.

## Create a project

1. Go to [/projects](/projects) and click **New Project**. You can also use **+ Add project** at the foot of any column, or the button on the empty state.
2. Enter a **Title** (required, up to 200 characters).
3. Optionally add a **Description** (up to 2000 characters).
4. Choose an **Area** from the dropdown. The list comes from your space's configured areas (Woodshop, Electronics, Laser, and so on); if none are set up, a default list is shown. Leave it on **No area** to skip. See [Customize your space](/docs/how-to/customize-space) to define areas.
5. Optionally set a **Due Date** and add **Tags** as a comma-separated list (for example `electronics, hardware, cnc`), up to 20 tags.
6. Click **Create Project**.

New projects always start in the **Backlog** column. Status and lead cannot be chosen at creation time (status defaults to `backlog`).

## Set status on the board

The board groups projects into four columns by status: **Backlog**, **In Progress**, **Review**, and **Done**. Each column header shows a count of the projects in it.

To move a project, open the status dropdown on its card and pick the new column. The card moves immediately and the change is saved.

Note one edge case: the underlying status field also has a `blocked` value, but the board has no `blocked` column and the dropdown does not offer it. A project set to `blocked` outside this screen will not appear in any column here.

## Read progress and details

Each card shows the title, an optional description, the area and due date, any tags, and a thin progress bar. The bar reflects the project's stored progress value (0 to 100 percent), which is driven by the project's linked tasks rather than edited by hand on this screen. See [/tasks](/tasks) to add work items to a project.

## Members and leads

The projects schema keeps a **lead** and **assignee** fields, but the board screen does not expose controls to set them. Creating and moving projects here does not assign a lead or members; those fields stay empty unless populated elsewhere.

## Delete a project

Hover a card and click the small **x** in its top-right corner, then confirm. Deletion is permanent. If you lack the `board` or `admin` role, the action returns an error and the project stays put.

## Related

- [Customize your space](/docs/how-to/customize-space) - define the areas that tag projects.
- [Permissions model](/docs/explanation/permissions-model) - how role gates like delete are enforced.
