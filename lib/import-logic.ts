// Pure parse/validate for one column-mapped CSV payment row, shared by the
// import wizard's payments path. Extracted so the date guard is unit-testable:
// a non-empty but unparseable transaction_date (e.g. 'N/A') must surface as a
// per-row error, never throw. A thrown RangeError from `new Date(str).toISOString()`
// mid-map aborts the entire import — nothing gets sent, no toast fires, and the
// wizard's 'Importing...' button stays wedged. Validation here mirrors the
// server's Zod row schema loosely (presence + a real date); the server remains
// the source of truth and re-validates every row.

export interface ParsedPaymentRow {
  platform: string
  amount: number
  from_identifier: string
  from_note: string | undefined
  transaction_date: string
}

export type PaymentRowResult =
  | { ok: true; value: ParsedPaymentRow }
  | { ok: false; error: string }

// `mapped` is the app-field-keyed row (field key -> raw cell string). `rowNumber`
// is the 1-based spreadsheet row (header = row 1) used only for error messages.
export function parsePaymentRow(
  mapped: Record<string, string>,
  rowNumber: number,
): PaymentRowResult {
  const amount = parseFloat((mapped.amount ?? '').replace(/[$,\s]/g, ''))
  if (isNaN(amount) || !mapped.from_identifier || !mapped.transaction_date) {
    return { ok: false, error: `Row ${rowNumber}: missing required fields` }
  }
  const parsed = new Date(mapped.transaction_date)
  if (isNaN(parsed.getTime())) {
    return { ok: false, error: `Row ${rowNumber}: unparseable date "${mapped.transaction_date}"` }
  }
  return {
    ok: true,
    value: {
      platform: mapped.platform || 'csv',
      amount,
      from_identifier: mapped.from_identifier,
      from_note: mapped.from_note,
      transaction_date: parsed.toISOString(),
    },
  }
}
