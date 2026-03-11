import { createClient } from '@/lib/supabase/server'

export default async function ImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: member } = await supabase
    .from('space_members').select('space_id, role').eq('user_id', user!.id).eq('status', 'current').single()

  const isAdmin = member?.role === 'admin' || member?.role === 'board'

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-sans text-sm text-muted-foreground">Admin access required</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-6 py-3">
        <h1 className="text-white font-sans text-lg font-semibold">Import & Sync</h1>
      </div>

      {/* Tabs */}
      <div className="bg-card border-b border-border px-6 flex gap-6">
        {['CSV / Excel', 'Database Connect', 'Webhooks & API', 'Integrations'].map((tab, i) => (
          <button key={tab} className={`font-sans text-sm py-3 border-b-2 transition ${
            i === 0 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="p-6 max-w-3xl">
        {/* Steps */}
        <div className="flex items-center gap-2 mb-8">
          {[{ n: 1, label: 'Upload File', done: false }, { n: 2, label: 'Map Columns', active: false }, { n: 3, label: 'Preview' }, { n: 4, label: 'Import' }].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                  i === 0 ? 'bg-primary text-white' : 'border-2 border-border'
                }`}>
                  {i + 1}
                </div>
                <span className="font-sans text-sm">{step.label}</span>
              </div>
              {i < 3 && <span className="text-border">—</span>}
            </div>
          ))}
        </div>

        {/* Upload area */}
        <div className="bg-card rounded border border-border p-8 mb-6">
          <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition cursor-pointer">
            <svg className="w-10 h-10 text-muted-foreground mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="font-sans text-sm text-muted-foreground mb-1">Drop your CSV or Excel file here</p>
            <p className="font-mono text-xs text-muted-foreground/60">or click to browse</p>
          </div>
        </div>

        {/* Column mapping preview */}
        <div className="bg-card rounded border border-border overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              Map Columns to App Fields
            </p>
            <p className="font-mono text-[10px] text-muted-foreground">Upload a file to begin mapping</p>
          </div>
          <div className="divide-y divide-border">
            {[
              ['Full Name', 'display_name'],
              ['Email Address', 'email'],
              ['MemberType', 'tier'],
              ['JoinDate', 'joined_at'],
              ['PhoneNumber', 'phone'],
              ['LastDuesDate', 'last_paid_at'],
              ['CardAccess', 'has_card_access'],
            ].map(([col, field]) => (
              <div key={col} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
                <div className="bg-muted/50 border border-border rounded px-3 py-2 font-mono text-xs text-muted-foreground">
                  {col}
                </div>
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <div className="bg-background border border-border rounded px-3 py-2 font-mono text-xs text-foreground">
                  {field}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-4 flex justify-end gap-3 border-t border-border">
            <button className="bg-card border border-border text-foreground font-sans text-sm px-4 py-2 rounded hover:border-primary/50 transition">
              Back
            </button>
            <button className="bg-primary text-white font-sans text-sm px-4 py-2 rounded hover:bg-primary/90 transition">
              Preview Import →
            </button>
          </div>
        </div>

        {/* Database Connector */}
        <div className="bg-card rounded border border-border p-6">
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-4">
            Database Connector (Advanced)
          </p>
          <p className="font-sans text-sm text-muted-foreground mb-4 leading-relaxed">
            Connect directly to your existing member database. Supports PostgreSQL, MySQL, SQLite, and MongoDB.
            Credentials are stored encrypted and never shared.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="font-sans text-sm text-foreground block mb-2">Database Type</label>
              <select className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary">
                <option>PostgreSQL (Ruby on Rails)</option>
                <option>MySQL</option>
                <option>SQLite</option>
                <option>MongoDB</option>
              </select>
            </div>
            <div>
              <label className="font-sans text-sm text-foreground block mb-2">Connection String</label>
              <input
                type="text"
                placeholder="postgres://user:pass@host:5432/db"
                className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button className="border border-border bg-card text-foreground font-sans text-sm px-4 py-2 rounded hover:border-primary/50 transition">
              Test Connection
            </button>
            <button className="bg-primary text-white font-sans text-sm px-4 py-2 rounded hover:bg-primary/90 transition">
              Connect & Map Schema →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
