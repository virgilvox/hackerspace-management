Register your tools and machines, let members book time on them without double-booking, and optionally require a certification before a tool can be reserved. This recipe covers the manager side (the registry) and the member side (browsing and reserving).

## Before you start

Managing the registry requires the `equipment.manage` permission. By default the **board** role holds it; a space can grant it to other roles under [/customize](/customize). Reserving a tool needs no special permission — any member in good standing (status `current`, `unverified`, or `late`) can book from the catalog.

If you plan to gate a tool behind a certification, create that certification first at [/certifications](/certifications) so it appears in the requirement dropdown.

## Register a piece of equipment

1. Go to [/equipment/manage](/equipment/manage) and choose **New equipment**.
2. Give it a **Name** (required, up to 200 characters, e.g. `Laser Cutter #1`).
3. Optionally fill in **Description**, **Location**, and **Asset tag**.
4. Set the operational **status**. New items default to **Available**.
5. Optionally pick a required certification (see below), then choose **Add equipment**.

The item appears immediately in the manager list and, once it is available, in the member-facing catalog at [/equipment](/equipment).

### Equipment status

Status controls whether a tool can be booked at all. Only `available` equipment accepts reservations.

| Status | Label | Reservable? |
| --- | --- | --- |
| `available` | Available | Yes |
| `maintenance` | Under maintenance | No |
| `retired` | Retired | No |

To take a machine offline temporarily, edit it and switch the status to **Under maintenance**; switch it back to **Available** when repairs are done. Use **Retired** for equipment that is permanently out of service.

## Gate a tool behind a certification

To require that a member hold a certification before they can reserve or use a tool:

1. Edit the equipment (or set this while creating it) on [/equipment/manage](/equipment/manage).
2. In the certification dropdown, choose **Requires: `<certification>`** instead of **No required certification**.
3. Save.

The certification must belong to your space or the save is rejected. Once set, members who do not hold an active certification see a **Requires `<name>`** badge on [/equipment](/equipment) and the **Reserve** button is disabled for them. Members who hold it see a **Certified: `<name>`** badge and can book normally.

A revoked or expired certification does not count as active, so it will not satisfy the gate. An `equipment.manage` holder can override the certification gate — including booking on another member's behalf — but the override never bypasses an operational status block (a `maintenance` or `retired` tool still cannot be reserved).

## Reserve a tool (member view)

1. From [/equipment](/equipment), find the tool and choose **Reserve**.
2. Pick a **Starts** and **Ends** time. The end must be after the start, and the start cannot be in the past.
3. Optionally add **Notes**, then choose **Confirm reservation**.

Members can review their own bookings on [/me](/me). A member can cancel their own reservation; an `equipment.manage` holder can cancel anyone's.

## How overlaps are prevented

Two reservations for the same tool cannot overlap. Time windows are half-open, so a booking that ends exactly when the next one begins is allowed (they touch but do not conflict). Only active (`reserved`) reservations block a slot — `cancelled` and `completed` ones never do.

This is enforced two ways: the action checks for conflicts before inserting, and a database exclusion constraint (`equipment_reservations_no_overlap`) is the final arbiter, so two people booking the same slot at the same instant cannot both succeed. The losing request sees `That time overlaps an existing reservation.`

## Edit, archive, or delete

On [/equipment/manage](/equipment/manage) each item offers:

- **Reservations** — view the booking list for that tool.
- **Edit** — change any field, including status and the required certification.
- **Archive** / **Restore** — archived items are hidden from the member catalog but keep their history. Use this instead of deleting once a tool has bookings.
- **Delete** — permanently removes the item. This is blocked if the tool has any reservations; archive it instead.
