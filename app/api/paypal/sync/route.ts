import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).eq('status', 'current').single()
  if (!member || !['admin', 'board', 'treasurer'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

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

  const { client_id, client_secret, sandbox } = integration.config as Record<string, string>
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

    // Map PayPal transactions to our schema
    const rows = transactions
      .filter(tx => {
        const info = tx.transaction_info
        const amount = parseFloat(info?.transaction_amount?.value ?? '0')
        return amount > 0 // Only incoming payments
      })
      .map(tx => {
        const info = tx.transaction_info
        const payer = tx.payer_info
        const amount = parseFloat(info.transaction_amount?.value ?? '0')
        const txDate = info.transaction_initiation_date ?? info.transaction_updated_date

        return {
          space_id: member.space_id,
          platform: 'paypal' as const,
          amount,
          from_identifier: payer?.email_address ?? payer?.payer_name?.alternate_full_name ?? 'PayPal User',
          from_note: info.transaction_note ?? info.transaction_subject ?? null,
          transaction_date: new Date(txDate).toISOString(),
          link_status: 'unlinked' as const,
          external_id: info.transaction_id,
        }
      })

    if (rows.length === 0) {
      return NextResponse.json({ imported: 0, message: 'No incoming payments found' })
    }

    // Upsert — skip rows that already exist by external_id
    const { data: imported, error: insertError } = await supabase
      .from('payments')
      .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: true })
      .select()

    if (insertError) {
      // If external_id column doesn't exist yet, fall back to plain insert
      const { data: fallback, error: fallbackError } = await supabase
        .from('payments')
        .insert(rows.map(({ external_id, ...rest }) => rest))
        .select()
      if (fallbackError) throw new Error(fallbackError.message)
      return NextResponse.json({ imported: fallback?.length ?? 0 })
    }

    return NextResponse.json({ imported: imported?.length ?? rows.length })
  } catch (err: any) {
    console.error('[PayPal sync error]', err)
    return NextResponse.json({ error: err.message ?? 'Sync failed' }, { status: 500 })
  }
}
