'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { Upload, CheckCircle, AlertCircle, X, ChevronDown, ArrowRight, FileText, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'
import { importPaymentsCsv } from '@/lib/actions'

// ─── Lightweight CSV parser (handles quoted fields, no external deps) ──────────
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current.trimEnd())
      current = ''
    } else if (ch === '\r' && !inQuotes) {
      // skip
    } else {
      current += ch
    }
  }
  if (current.trim()) lines.push(current.trimEnd())

  function splitRow(row: string): string[] {
    const fields: string[] = []
    let field = ''
    let inQ = false
    for (let i = 0; i < row.length; i++) {
      const c = row[i]
      if (c === '"') {
        if (inQ && row[i + 1] === '"') { field += '"'; i++ }
        else inQ = !inQ
      } else if (c === ',' && !inQ) {
        fields.push(field.trim())
        field = ''
      } else {
        field += c
      }
    }
    fields.push(field.trim())
    return fields
  }

  const nonEmpty = lines.filter(l => l.trim())
  if (nonEmpty.length === 0) return { headers: [], rows: [] }
  const headers = splitRow(nonEmpty[0]).map(h => h.replace(/^"|"$/g, ''))
  const rows = nonEmpty.slice(1).map(l => splitRow(l).map(v => v.replace(/^"|"$/g, '')))
  return { headers, rows }
}

// ─── Import types ─────────────────────────────────────────────────────────────
type ImportMode = 'members' | 'payments'

type MemberFieldKey = 'display_name' | 'email' | 'phone' | 'handle' | 'tier' | 'joined_at' | 'last_paid_at' | 'has_card_access' | 'skip'
type PaymentFieldKey = 'amount' | 'from_identifier' | 'from_note' | 'transaction_date' | 'platform' | 'skip'

const MEMBER_FIELDS: { key: MemberFieldKey; label: string; required?: boolean }[] = [
  { key: 'display_name', label: 'Display Name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Phone' },
  { key: 'handle', label: 'Handle / Username' },
  { key: 'tier', label: 'Tier / Membership Type' },
  { key: 'joined_at', label: 'Join Date' },
  { key: 'last_paid_at', label: 'Last Paid Date' },
  { key: 'has_card_access', label: 'Card Access' },
  { key: 'skip', label: 'Skip this column' },
]

const PAYMENT_FIELDS: { key: PaymentFieldKey; label: string; required?: boolean }[] = [
  { key: 'amount', label: 'Amount', required: true },
  { key: 'from_identifier', label: 'Sender / From Name', required: true },
  { key: 'transaction_date', label: 'Date', required: true },
  { key: 'platform', label: 'Platform (venmo/paypal/cash)' },
  { key: 'from_note', label: 'Note / Memo' },
  { key: 'skip', label: 'Skip this column' },
]

// Auto-detect column mapping from header names
function autoMap(headers: string[], mode: ImportMode): Record<string, string> {
  const map: Record<string, string> = {}
  const memberPatterns: [RegExp, MemberFieldKey][] = [
    [/name|full.?name|display/i, 'display_name'],
    [/email/i, 'email'],
    [/phone|mobile/i, 'phone'],
    [/handle|username|slack|discord/i, 'handle'],
    [/tier|type|member.?type|plan|level/i, 'tier'],
    [/join|joined|start/i, 'joined_at'],
    [/paid|dues|last.?paid/i, 'last_paid_at'],
    [/card|access|fob|keyfob/i, 'has_card_access'],
  ]
  const paymentPatterns: [RegExp, PaymentFieldKey][] = [
    [/amount|sum|total|\$/i, 'amount'],
    [/from|sender|name|payer/i, 'from_identifier'],
    [/note|memo|desc/i, 'from_note'],
    [/date|time|when/i, 'transaction_date'],
    [/platform|source|via/i, 'platform'],
  ]

  const patterns = mode === 'members' ? memberPatterns : paymentPatterns
  headers.forEach(h => {
    const match = patterns.find(([re]) => re.test(h))
    map[h] = match ? match[1] : 'skip'
  })
  return map
}

// ─── Step indicators ──────────────────────────────────────────────────────────
function Steps({ current }: { current: number }) {
  const steps = ['Upload File', 'Map Columns', 'Preview', 'Import']
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 ${i <= current ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
              i < current ? 'bg-primary text-white' : i === current ? 'bg-primary text-white ring-2 ring-primary/30' : 'border-2 border-border'
            }`}>
              {i < current ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className="font-sans text-sm">{label}</span>
          </div>
          {i < 3 && <span className="text-border font-mono">—</span>}
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  spaceId: string
  role: string
}

type ImportResult = { success: number; failed: number; errors: string[] }

export default function ImportClient({ spaceId, role }: Props) {
  const [mode, setMode] = useState<ImportMode>('members')
  const [step, setStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const platform = mode === 'payments' ? 'csv' : undefined

  function handleFile(f: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { headers: h, rows: r } = parseCSV(text)
      if (h.length === 0) { toast.error('Could not parse file — check that it is a valid CSV'); return }
      setFile(f)
      setHeaders(h)
      setRows(r)
      setColumnMap(autoMap(h, mode))
      setStep(1)
    }
    reader.readAsText(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const previewRows = useMemo(() => {
    return rows.slice(0, 5).map(row => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => {
        if (columnMap[h] && columnMap[h] !== 'skip') {
          obj[columnMap[h]] = row[i] ?? ''
        }
      })
      return obj
    })
  }, [rows, headers, columnMap])

  const requiredFields = mode === 'members'
    ? MEMBER_FIELDS.filter(f => f.required).map(f => f.key)
    : PAYMENT_FIELDS.filter(f => f.required).map(f => f.key)

  const mappedFields = Object.values(columnMap).filter(v => v !== 'skip')
  const missingRequired = requiredFields.filter(r => !mappedFields.includes(r))

  async function runImport() {
    setImporting(true)
    const errors: string[] = []
    let success = 0

    if (mode === 'payments') {
      const paymentRows = rows.map((row, i) => {
        const obj: Record<string, string> = {}
        headers.forEach((h, j) => {
          if (columnMap[h] && columnMap[h] !== 'skip') obj[columnMap[h]] = row[j] ?? ''
        })
        const amount = parseFloat((obj.amount ?? '').replace(/[$,\s]/g, ''))
        if (isNaN(amount) || !obj.from_identifier || !obj.transaction_date) {
          errors.push(`Row ${i + 2}: missing required fields`)
          return null
        }
        return {
          platform: (obj.platform || 'csv') as any,
          amount,
          from_identifier: obj.from_identifier,
          from_note: obj.from_note,
          transaction_date: new Date(obj.transaction_date).toISOString(),
        }
      }).filter(Boolean) as any[]

      const result = await importPaymentsCsv(paymentRows)
      if ('error' in result && result.error) {
        toast.error(result.error)
        setImporting(false)
        return
      }
      success = (result as any).count ?? paymentRows.length

    } else {
      // Members import — call supabase directly since there's no existing action for bulk member import
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const obj: Record<string, string> = {}
        headers.forEach((h, j) => {
          if (columnMap[h] && columnMap[h] !== 'skip') obj[columnMap[h]] = row[j] ?? ''
        })

        if (!obj.display_name || !obj.email) {
          errors.push(`Row ${i + 2}: missing name or email`)
          continue
        }

        const joined_at = obj.joined_at ? new Date(obj.joined_at).toISOString() : new Date().toISOString()
        const last_paid_at = obj.last_paid_at ? new Date(obj.last_paid_at).toISOString() : null
        const has_card_access = /yes|true|1|y/i.test(obj.has_card_access ?? '')

        // Map tier value to valid enum or default to 'basic'
        const tierMap: Record<string, 'plus' | 'basic' | 'associate'> = {
          plus: 'plus', premium: 'plus', full: 'plus',
          basic: 'basic', member: 'basic', standard: 'basic',
          associate: 'associate', visitor: 'associate', guest: 'associate',
        }
        const tier = tierMap[(obj.tier || '').toLowerCase()] || 'basic'

        const { error } = await supabase.from('space_members').insert({
          space_id: spaceId,
          user_id: crypto.randomUUID(),
          display_name: obj.display_name,
          email: obj.email,
          phone: obj.phone || null,
          handle: obj.handle || null,
          tier,
          role: 'member',
          status: 'current',
          approved: true,
          joined_at,
          last_paid_at,
          has_card_access,
        })

        if (error) errors.push(`Row ${i + 2} (${obj.email}): ${error.message}`)
        else success++
      }
    }

    setImporting(false)
    setResult({ success, failed: errors.length, errors })
    setStep(3)
    if (success > 0) toast.success(`Imported ${success} ${mode === 'members' ? 'members' : 'payments'}`)
    if (errors.length > 0) toast.error(`${errors.length} rows failed`)
  }

  function reset() {
    setStep(0)
    setFile(null)
    setHeaders([])
    setRows([])
    setColumnMap({})
    setResult(null)
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Mode selector */}
      <div className="flex items-center gap-3 mb-6">
        <p className="font-sans text-sm text-muted-foreground">Import type:</p>
        {(['members', 'payments'] as ImportMode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); reset() }}
            className={`font-sans text-sm px-3 py-1.5 rounded border transition capitalize ${
              mode === m ? 'bg-primary text-white border-primary' : 'border-border text-foreground hover:border-primary/50'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <Steps current={step} />

      {/* ─── Step 0: Upload ─── */}
      {step === 0 && (
        <div className="bg-card rounded border border-border p-6">
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition cursor-pointer"
          >
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-sans text-sm text-foreground mb-1">Drop your CSV file here</p>
            <p className="font-mono text-xs text-muted-foreground/60">or click to browse · CSV format</p>
          </div>
          <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

          <div className="mt-4 p-4 bg-muted/30 rounded border border-border">
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase mb-2">
              Expected columns for {mode} import
            </p>
            <p className="font-sans text-xs text-muted-foreground leading-relaxed">
              {mode === 'members'
                ? 'Required: display_name/Full Name, email. Optional: phone, handle, tier, joined_at, last_paid_at, has_card_access'
                : 'Required: amount, from_identifier/name, transaction_date. Optional: platform, note/memo'}
            </p>
          </div>
        </div>
      )}

      {/* ─── Step 1: Map Columns ─── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-card rounded border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Map Columns to App Fields</p>
                <p className="font-sans text-xs text-muted-foreground mt-0.5">{file?.name} · {rows.length} rows</p>
              </div>
              <button onClick={reset} className="text-muted-foreground hover:text-foreground transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="divide-y divide-border">
              {headers.map(header => (
                <div key={header} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
                  <div className="bg-muted/50 border border-border rounded px-3 py-2 font-mono text-xs text-foreground">
                    {header}
                    {rows[0] && (
                      <span className="text-muted-foreground ml-2">— e.g. {rows[0][headers.indexOf(header)] || '(empty)'}</span>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
                  <select
                    value={columnMap[header] ?? 'skip'}
                    onChange={e => setColumnMap(prev => ({ ...prev, [header]: e.target.value }))}
                    className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:border-primary transition"
                  >
                    {(mode === 'members' ? MEMBER_FIELDS : PAYMENT_FIELDS).map(f => (
                      <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {missingRequired.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="font-sans text-xs text-amber-800">
                Required fields not yet mapped: {missingRequired.join(', ')}
              </p>
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={reset} className="border border-border bg-card text-foreground font-sans text-sm px-4 py-2 rounded hover:border-primary/50 transition">Back</button>
            <button
              onClick={() => setStep(2)}
              disabled={missingRequired.length > 0}
              className="bg-primary text-white font-sans text-sm px-4 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50"
            >
              Preview Import →
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 2: Preview ─── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-card rounded border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Preview (first 5 of {rows.length} rows)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {Object.keys(previewRows[0] ?? {}).map(k => (
                      <th key={k} className="px-3 py-2 font-mono text-[10px] text-muted-foreground text-left">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewRows.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/10">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-3 py-2 font-sans text-foreground truncate max-w-[160px]">{v || <span className="text-muted-foreground/40">—</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-card border border-border rounded p-4 flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="font-sans text-sm font-medium text-foreground">{rows.length} rows ready to import</p>
              <p className="font-sans text-xs text-muted-foreground">into {mode === 'members' ? 'Space Members' : 'Payments'} table</p>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="border border-border bg-card text-foreground font-sans text-sm px-4 py-2 rounded hover:border-primary/50 transition">Back</button>
            <button
              onClick={runImport}
              disabled={importing}
              className="bg-primary text-white font-sans text-sm px-6 py-2 rounded hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {importing && <RefreshCcw className="w-4 h-4 animate-spin" />}
              {importing ? 'Importing...' : `Import ${rows.length} rows →`}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Results ─── */}
      {step === 3 && result && (
        <div className="space-y-4">
          <div className={`rounded border p-5 flex items-start gap-3 ${result.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            {result.failed === 0
              ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            }
            <div>
              <p className="font-sans text-sm font-medium text-foreground">
                {result.success} imported successfully{result.failed > 0 ? `, ${result.failed} failed` : ''}
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i} className="font-mono text-[11px] text-amber-800">{e}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li className="font-mono text-[11px] text-amber-800">...and {result.errors.length - 10} more</li>
                  )}
                </ul>
              )}
            </div>
          </div>
          <button onClick={reset} className="bg-primary text-white font-sans text-sm px-4 py-2 rounded hover:bg-primary/90 transition">
            Import Another File
          </button>
        </div>
      )}
    </div>
  )
}
