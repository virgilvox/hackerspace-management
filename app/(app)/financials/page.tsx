import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { FinancialVisibility, Payment, Space } from '@/lib/types'
import { Receipt } from 'lucide-react'
import { PageTitle } from '@/components/ui/page-title'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'

export const dynamic = 'force-dynamic'

const DOLLAR = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function isVisible(viz: FinancialVisibility, role: string | null): boolean {
  if (viz === 'all_members_visible') return true
  if (viz === 'board_visible') return role === 'admin' || role === 'board' || role === 'treasurer'
  // treasurer_only
  return role === 'admin' || role === 'board' || role === 'treasurer'
}

export default async function FinancialsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('space_members')
    .select('space_id, role')
    .eq('user_id', user.id)
    .in('status', ['current', 'unverified', 'late'])
    .maybeSingle()
  if (!member?.space_id) redirect('/signup')

  const { data: spaceRaw } = await supabase
    .from('spaces')
    .select('id, name, financial_visibility')
    .eq('id', member.space_id)
    .maybeSingle()
  const space = spaceRaw as unknown as Pick<Space, 'id' | 'name'> & { financial_visibility: FinancialVisibility } | null

  if (!space) {
    return <PageShell title="Financials"><p className="font-sans text-sm">Space not found.</p></PageShell>
  }

  if (!isVisible(space.financial_visibility, member.role)) {
    return (
      <PageShell title="Financials">
        <div className="bg-card rounded border border-border p-6 text-center">
          <p className="font-sans text-sm text-foreground mb-2">Financial data is not visible to your role.</p>
          <p className="font-mono text-[10px] text-muted-foreground">
            Visibility is currently set to <strong>{space.financial_visibility.replace(/_/g, ' ')}</strong>.
            Ask an admin to change it from Settings if your space wants broader transparency.
          </p>
        </div>
      </PageShell>
    )
  }

  const { data: paymentsRaw } = await supabase
    .from('payments')
    .select('*')
    .eq('space_id', member.space_id)
    .order('transaction_date', { ascending: false })

  const payments = (paymentsRaw ?? []) as unknown as Payment[]

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  let lifetime = 0
  let thisYear = 0
  let thisMonth = 0
  let linked = 0
  let unlinked = 0
  const byPlatform: Record<string, number> = {}
  const byMonth: Record<string, number> = {}

  for (const p of payments) {
    const amount = Number(p.amount ?? 0)
    lifetime += amount
    const tx = p.transaction_date ? new Date(p.transaction_date) : null
    if (tx) {
      if (tx >= startOfYear) thisYear += amount
      if (tx >= startOfMonth) thisMonth += amount
      const key = `${tx.getFullYear()}-${String(tx.getMonth() + 1).padStart(2, '0')}`
      byMonth[key] = (byMonth[key] ?? 0) + amount
    }
    if (p.link_status === 'linked') linked++
    else unlinked++
    const platform = String(p.platform ?? 'unknown')
    byPlatform[platform] = (byPlatform[platform] ?? 0) + amount
  }

  const monthlyRows = Object.entries(byMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)

  const platformRows = Object.entries(byPlatform).sort(([, a], [, b]) => b - a)
  const maxPlatform = Math.max(1, ...platformRows.map(([, v]) => v))

  return (
    <PageShell title={`Financials — ${space.name}`}>
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
        Visibility: {space.financial_visibility.replace(/_/g, ' ')}
        {member.role === 'admin' && (
          <>
            {' · '}
            <Link href="/settings" className="text-primary hover:underline normal-case tracking-normal">
              change in Settings
            </Link>
          </>
        )}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="This Month" value={DOLLAR.format(thisMonth)} sub="received" />
        <StatCard label="This Year" value={DOLLAR.format(thisYear)} sub={`${now.getFullYear()}`} />
        <StatCard label="Lifetime" value={DOLLAR.format(lifetime)} sub="all payments" />
        <StatCard
          label="Reconciliation"
          value={`${linked}/${linked + unlinked}`}
          sub={`${unlinked} unlinked`}
          warn={unlinked > 0}
        />
      </div>

      <section className="bg-card rounded border border-border p-5">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
          By platform
        </p>
        {platformRows.length === 0 ? (
          <Empty className="border-0 p-0 md:p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
              <EmptyTitle>No payments yet</EmptyTitle>
              <EmptyDescription>Platform totals appear here once payments are recorded.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-2">
            {platformRows.map(([platform, total]) => {
              const pct = Math.round((total / maxPlatform) * 100)
              return (
                <li key={platform}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans text-sm capitalize text-foreground">{platform}</span>
                    <span className="font-mono text-xs text-muted-foreground">{DOLLAR.format(total)}</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="bg-card rounded border border-border p-5">
        <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
          Last 12 months
        </p>
        {monthlyRows.length === 0 ? (
          <p className="font-sans text-sm text-muted-foreground">No monthly breakdown yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {monthlyRows.map(([month, total]) => {
              const [y, m] = month.split('-')
              const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
              return (
                <div key={month} className="flex items-center justify-between bg-background rounded border border-border px-3 py-2">
                  <span className="font-sans text-sm text-foreground">{label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{DOLLAR.format(total)}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </PageShell>
  )
}

function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3">
        <PageTitle>{title}</PageTitle>
      </div>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl">{children}</div>
    </div>
  )
}

function StatCard({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="bg-card rounded border border-border p-4 md:p-5">
      <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">{label}</p>
      <p className={`text-2xl font-sans font-bold ${warn ? 'text-orange-500' : 'text-primary'}`}>{value}</p>
      <p className="font-sans text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  )
}
