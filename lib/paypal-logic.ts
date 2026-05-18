// Pure PayPal Transaction Search -> payments mapping + sync dedupe. No I/O,
// no Supabase, no network: the route does the OAuth + fetch + DB; this module
// owns "which transactions become rows and which are new" so the money
// mapping is unit-tested (it was previously inline + untested).

// Structural shape of a PayPal transaction_detail (only the fields we read).
type PayPalTxn = {
  transaction_info?: {
    transaction_id?: string
    transaction_amount?: { value?: string }
    transaction_note?: string | null
    transaction_subject?: string | null
    transaction_initiation_date?: string
    transaction_updated_date?: string
  }
  payer_info?: {
    email_address?: string
    payer_name?: { alternate_full_name?: string }
  }
}

export type PayPalPaymentRow = {
  space_id: string
  platform: 'paypal'
  amount: number
  from_identifier: string
  from_note: string | null
  transaction_date: string
  link_status: 'unlinked'
  external_id: string | null
}

function safeIso(value: string | undefined, fallbackIso: string): string {
  if (!value) return fallbackIso
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? fallbackIso : d.toISOString()
}

// Incoming payments only (amount > 0), mapped to ledger rows. nowIso is the
// fallback when a transaction has no/invalid date (PayPal occasionally omits
// it) so a bad date can't throw and abort the whole sync.
export function mapPayPalTransactions(
  transactions: PayPalTxn[],
  spaceId: string,
  nowIso: string,
): PayPalPaymentRow[] {
  const rows: PayPalPaymentRow[] = []
  for (const tx of transactions ?? []) {
    const info = tx.transaction_info
    const amount = parseFloat(info?.transaction_amount?.value ?? '0')
    if (!(amount > 0)) continue
    const payer = tx.payer_info
    rows.push({
      space_id: spaceId,
      platform: 'paypal',
      amount,
      from_identifier:
        payer?.email_address ?? payer?.payer_name?.alternate_full_name ?? 'PayPal User',
      from_note: info?.transaction_note ?? info?.transaction_subject ?? null,
      transaction_date: safeIso(
        info?.transaction_initiation_date ?? info?.transaction_updated_date,
        nowIso,
      ),
      link_status: 'unlinked',
      external_id: info?.transaction_id ?? null,
    })
  }
  return rows
}

// payments has no unique constraint on external_id, so dedupe is explicit:
// keep rows whose external_id is not already present in this space. Rows with
// no external_id are kept (can't be matched; better a possible dup than a
// dropped payment).
export function filterUnseenByExternalId(
  rows: PayPalPaymentRow[],
  seenExternalIds: Set<string>,
): PayPalPaymentRow[] {
  return rows.filter(r => !r.external_id || !seenExternalIds.has(r.external_id))
}

// External ids present in a batch, for the "already in this space?" query.
export function externalIdsOf(rows: PayPalPaymentRow[]): string[] {
  return rows.map(r => r.external_id).filter((x): x is string => !!x)
}
