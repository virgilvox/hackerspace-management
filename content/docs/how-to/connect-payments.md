Dues that arrive off-platform — PayPal, Venmo, Zeffy, or cash handed to the treasurer — land in the [/payments](/payments) ledger as transactions, where you match each one to the member who paid. This recipe covers getting those transactions in and reconciling them by hand.

If you want dues that reconcile themselves, set up recurring Stripe billing instead — see [Dues end to end](/docs/tutorials/dues-end-to-end). This page is for everything that is *not* an automatic Stripe subscription.

## Roles you need

| Task | Where | Required role |
| --- | --- | --- |
| Connect a platform, add pay-here links | [/settings](/settings) | `admin` |
| Log cash, import CSV, sync, link a payment | [/payments](/payments), [/import](/import) | `admin`, `board`, `treasurer` |

## Add a pay-here link (optional)

Give members a button to pay you directly. In [/settings](/settings) open the **Dues** tab, find **Other ways to pay dues**, and add a link per platform:

1. Paste an `https://` payment URL for **PayPal**, **Zeffy**, or **Venmo**.
2. Add optional instructions, e.g. "put your member name in the note."
3. Leave the toggle on **shown** and click **Save**.

Members see active links on their [/me](/me) page. These links do not record anything — money paid through them still has to be reconciled in [/payments](/payments) later.

## Connect PayPal to sync transactions

To pull PayPal transactions automatically, connect the API credentials once. In [/settings](/settings), open the **Integrations** tab, click **Connect** on **PayPal**, and enter your Client ID, Client Secret, and mode (`sandbox` or `live`). Zeffy and Venmo have their own credential fields on the same tab.

Once PayPal shows **LIVE** on the [/payments](/payments) summary card, a **Sync Now** button appears. Click it to import incoming transactions as **unlinked** payments. The sync deduplicates on the PayPal transaction id, so re-syncing will not create duplicates.

## Import transactions from a CSV

For any platform, upload a spreadsheet export at [/import](/import):

1. Choose **payments** as the import type.
2. Drop your CSV file. Columns auto-map by header name.
3. Confirm the mapping. Required fields: **Amount**, **Sender / From Name**, **Date**. Optional: **Platform** (`venmo`/`paypal`/`cash`) and **Note / Memo**.
4. Click **Preview Import**, then **Import**.

Rows with a bad amount, date, or platform are skipped and counted in the results — they are not silently dropped. Imported rows land **unlinked**.

## Log a cash payment

For cash handed over in person, click **Log Cash** on [/payments](/payments). Enter the amount, a note (e.g. "John Smith — March dues"), an optional date, and optionally pick the member from **Link to Member** to link it immediately.

## Reconcile: match payments to members

New transactions arrive **unlinked**; the header shows an `N unlinked` count. To clear them:

1. Use the **Platform** and **Status** filters to narrow to **Unlinked**.
2. For each row, read the **From / Note** column. Synced PayPal rows carry the payer's email there, which you can compare against the member emails shown in the picker.
3. Click **+ Link member**, then choose the member. The picker lists each member's display name and email.

Linking sets the payment to **linked** and advances that member's dues. Reconciliation is *advance-only*: linking a payment moves the member's last-paid date forward and marks them `current` only if it is their most recent payment. A backdated payment older than what is already on file will not push a member's status backward.

### Notes

- Linking is one payment to one member; there is no bulk or automatic email match. Work down the unlinked list by hand.
- Only `current` and `late` members appear in the picker.
- The ledger shows the 100 most recent transactions across `paypal`, `zeffy`, `venmo`, and `cash`.
