import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readSecret } from '@/lib/secrets/vault'
import { requireMemberWithRole } from '@/lib/auth-helpers'
import {
  mapPayPalTransactions,
  filterUnseenByExternalId,
  externalIdsOf,
} from '@/lib/paypal-logic'

// PayPal Transaction Search API (v1)
// Docs: https://developer.paypal.com/docs/api/transaction-search/v1/

async function getPayPalToken(clientId: string, clientSecret: string, sandbox = false): Promise<string> {
  const baseUrl = sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal auth failed: ${res.status} ${text}`)
  }
  const data = await res.json()
  return data.access_token as string
}

async function fetchPayPalTransactions(
  token: string,
  startDate: string,
  endDate: string,
  sandbox = false,
): Promise<any[]> {
  const baseUrl = sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    transaction_status: 'S', // S = Success
    fields: 'transaction_info,payer_info,shipping_info',
    page_size: '500',
    page: '1',
  })

  const res = await fetch(`${baseUrl}/v1/reporting/transactions?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal API error: ${res.status} ${text}`)
  }
  const data = await res.json()
  return (data.transaction_details ?? []) as any[]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const auth = await requireMemberWithRole(
    supabase,
    ['admin', 'board', 'treasurer'],
    'Insufficient permissions',
  )
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 403 })
  const { member } = auth

  // Get PayPal integration config for this space
  const { data: integration } = await supabase
    .from('integrations')
    .select('config, is_connected')
    .eq('space_id', member.space_id)
    .eq('platform', 'paypal')
    .single()

  if (!integration?.is_connected || !integration.config) {
    return NextResponse.json({ error: 'PayPal not connected' }, { status: 400 })
  }

  const cfg = integration.config as Record<string, string>
  const { client_id, sandbox } = cfg
  // client_secret lives in the AES-256-GCM vault (referenced by client_secret_ref).
  // Legacy fallback: integrations saved before vaulting still have a plaintext
  // client_secret; it is auto-migrated on the next save in Settings.
  const client_secret = cfg.client_secret_ref
    ? await readSecret(createAdminClient(), member.space_id, cfg.client_secret_ref)
    : (cfg.client_secret ?? null)
  if (!client_id || !client_secret) {
    return NextResponse.json({ error: 'PayPal credentials incomplete' }, { status: 400 })
  }

  try {
    const isSandbox = sandbox === 'true'
    const token = await getPayPalToken(client_id, client_secret, isSandbox)

    // Sync last 30 days
    const endDate = new Date().toISOString()
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const transactions = await fetchPayPalTransactions(token, startDate, endDate, isSandbox)

    if (transactions.length === 0) {
      return NextResponse.json({ imported: 0, message: 'No transactions found in the last 30 days' })
    }

    const rows = mapPayPalTransactions(transactions, member.space_id, new Date().toISOString())

    if (rows.length === 0) {
      return NextResponse.json({ imported: 0, message: 'No incoming payments found' })
    }

    // Idempotent + tenant-scoped: there is no unique constraint on
    // payments.external_id, so an `ON CONFLICT (external_id)` upsert is not
    // reliable. Instead, look up which PayPal transaction ids already exist
    // *in this space* and insert only the genuinely new ones (keeping
    // external_id so a later re-sync stays idempotent).
    const externalIds = externalIdsOf(rows)
    const { data: existing } = await supabase
      .from('payments')
      .select('external_id')
      .eq('space_id', member.space_id)
      .in('external_id', externalIds.length > 0 ? externalIds : ['__none__'])
    const seen = new Set((existing ?? []).map(e => e.external_id as string))
    const newRows = filterUnseenByExternalId(rows, seen)

    if (newRows.length === 0) {
      return NextResponse.json({ imported: 0, message: 'Already up to date' })
    }

    const { data: imported, error: insertError } = await supabase
      .from('payments')
      .insert(newRows)
      .select()
    if (insertError) throw new Error(insertError.message)

    return NextResponse.json({ imported: imported?.length ?? newRows.length, rows: imported ?? [] })
  } catch (err: any) {
    console.error('[PayPal sync error]', err)
    return NextResponse.json({ error: err.message ?? 'Sync failed' }, { status: 500 })
  }
}
