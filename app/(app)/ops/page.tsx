import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Lock } from 'lucide-react'

export default async function OpsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user.id).eq('status', 'current').single()
  if (!member) return null

  const [{ data: kbEntries }, { data: areaLeads }, { data: secrets }] = await Promise.all([
    supabase.from('knowledge_base').select('*').eq('space_id', member!.space_id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(20),
    supabase.from('area_leads').select('*').eq('space_id', member!.space_id).order('area_name'),
    member?.role === 'admin' || member?.role === 'board'
      ? supabase.from('secrets').select('id, title, area').eq('space_id', member!.space_id)
      : Promise.resolve({ data: [] }),
  ])

  const pinned = kbEntries?.filter(e => e.is_pinned) ?? []
  const byArea = kbEntries?.filter(e => !e.is_pinned) ?? []

  const accessColors: Record<string, string> = {
    admin_only: 'text-red-600 bg-red-50 border-red-200',
    board: 'text-amber-600 bg-amber-50 border-amber-200',
    all_members: 'text-primary bg-primary/5 border-primary/20',
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-6 py-3 flex items-center justify-between">
        <h1 className="text-white font-sans text-lg font-semibold">Ops & Facilities</h1>
        <Link href="/ops/new" className="flex items-center gap-1.5 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition">
          <Plus className="w-3.5 h-3.5" /> Add Entry
        </Link>
      </div>

      {/* Tabs */}
      <div className="bg-card border-b border-border px-6 flex gap-6">
        {['Knowledge Base', 'Processes', 'Secrets & Credentials', 'Area Leads'].map((tab, i) => (
          <button key={tab} className={`font-sans text-sm py-3 border-b-2 transition ${
            i === 0 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="p-6 grid lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-6">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search knowledge base..."
              className="w-full bg-card border border-border rounded pl-9 pr-4 py-2.5 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition"
            />
          </div>

          {/* Pinned / Critical */}
          {pinned.length > 0 && (
            <div>
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
                Pinned / Critical
              </p>
              <div className="bg-card rounded border border-border divide-y divide-border">
                {pinned.map(entry => (
                  <Link key={entry.id} href={`/ops/${entry.id}`}>
                    <div className={`flex items-start gap-3 px-4 py-4 hover:bg-muted/30 transition border-l-4 ${
                      entry.visibility === 'admin_only' ? 'border-l-red-400' :
                      entry.visibility === 'board' ? 'border-l-amber-400' : 'border-l-primary'
                    }`}>
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        {entry.icon || <Lock className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-sm font-medium text-foreground">{entry.title}</p>
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{entry.content?.slice(0, 100)}</p>
                        <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                          updated {new Date(entry.updated_at).toLocaleDateString()} by {entry.updated_by_name}
                        </p>
                      </div>
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded border whitespace-nowrap flex-shrink-0 ${
                        accessColors[entry.visibility] ?? 'text-muted-foreground bg-muted border-border'
                      }`}>
                        {entry.visibility?.toUpperCase().replace('_', ' ') ?? 'ALL MEMBERS'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* By Area */}
          {byArea.length > 0 && (
            <div>
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">By Area</p>
              <div className="bg-card rounded border border-border divide-y divide-border">
                {byArea.map(entry => (
                  <Link key={entry.id} href={`/ops/${entry.id}`}>
                    <div className="flex items-start gap-3 px-4 py-4 hover:bg-muted/30 transition">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-sm font-medium text-foreground">{entry.title}</p>
                        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{entry.content?.slice(0, 100)}</p>
                        <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                          {entry.area} · updated {new Date(entry.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {kbEntries?.length === 0 && (
            <div className="bg-card rounded border border-dashed border-border p-12 text-center">
              <p className="font-sans text-sm text-muted-foreground">No knowledge base entries yet</p>
              <Link href="/ops/new" className="font-mono text-xs text-primary mt-2 block hover:underline">+ Add first entry</Link>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Area Leads</p>
              <button className="font-mono text-[10px] border border-border px-2 py-0.5 rounded hover:border-primary hover:text-primary transition">
                Manage
              </button>
            </div>
            <div className="bg-card rounded border border-border divide-y divide-border">
              {areaLeads && areaLeads.length > 0 ? areaLeads.map(lead => (
                <div key={lead.id} className="flex items-center gap-3 px-3 py-3">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-[10px] font-mono font-bold text-primary flex-shrink-0">
                    {lead.area_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-xs font-medium text-foreground truncate">{lead.area_name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground truncate">
                      {lead.lead_handle ? `lead: ${lead.lead_handle}` : 'unassigned'}
                    </p>
                  </div>
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${
                    lead.status === 'active' ? 'text-primary border-primary/30 bg-primary/5' :
                    lead.status === 'vacant' ? 'text-muted-foreground border-border bg-muted' :
                    'text-amber-600 border-amber-300 bg-amber-50'
                  }`}>
                    {lead.status?.toUpperCase()}
                  </span>
                </div>
              )) : (
                <div className="px-3 py-6 text-center text-muted-foreground font-sans text-xs">No area leads configured</div>
              )}
            </div>
          </div>

          {/* Secrets Vault */}
          <div>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-3">Secrets Vault</p>
            <div className="bg-card rounded border border-border p-4">
              <p className="font-sans text-xs text-muted-foreground mb-3 leading-relaxed">
                Credentials are encrypted and role-scoped. Only designated leads can access their area.
              </p>
              {secrets && secrets.length > 0 ? (
                <div className="space-y-2">
                  {secrets.map(s => (
                    <div key={s.id} className="flex items-center gap-2">
                      <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="font-mono text-xs text-foreground truncate">{s.title}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-mono text-xs text-muted-foreground">No secrets stored yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
