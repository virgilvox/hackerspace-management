'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createOnboardingStep, updateOnboardingStep, deleteOnboardingStep } from '@/lib/actions'
import { Card } from './card'
import type { Step } from './types'

export function OnboardingPanel({ isAdmin, steps: initial }: { isAdmin: boolean; steps: Step[] }) {
  const [steps, setSteps] = useState<Step[]>(initial)

  return (
    <Card
      title="New member onboarding"
      blurb="These steps run, in order, the first time a new member opens the app. Reorder with the number. Disable to hide. Built-in steps cannot be deleted, only disabled. Body supports markdown and a safe subset of HTML."
      action={isAdmin ? (
        <button
          onClick={async () => {
            const result = await createOnboardingStep({ step_type: 'content', title: 'New step', body: 'Edit this content in Customize, Onboarding.', sort_order: steps.reduce((m, s) => Math.max(m, s.sort_order), 0) + 1 })
            if ('error' in result && result.error) { toast.error(result.error); return }
            toast.success('Step added')
            const id = (result as { id: string }).id
            setSteps(prev => [...prev, { id, step_key: `custom-${id.slice(0, 12)}`, step_type: 'content', title: 'New step', body: 'Edit this content in Customize, Onboarding.', config: {}, is_enabled: true, is_required: false, is_system: false, sort_order: prev.reduce((m, s) => Math.max(m, s.sort_order), 0) + 1 }])
          }}
          className="font-mono text-[10px] border border-border px-3 py-1.5 rounded hover:border-primary hover:text-primary transition whitespace-nowrap"
        >
          + Custom step
        </button>
      ) : undefined}
    >
      <ul className="space-y-3">
        {[...steps].sort((a, b) => a.sort_order - b.sort_order).map(s => (
          <li key={s.id} className="border border-border rounded p-4">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <input type="number" defaultValue={s.sort_order} disabled={!isAdmin} onBlur={async e => { const n = parseInt(e.target.value, 10); if (isNaN(n) || n === s.sort_order) return; const res = await updateOnboardingStep(s.id, { sort_order: n }); if (res.error) { toast.error(res.error); return } setSteps(prev => prev.map(x => x.id === s.id ? { ...x, sort_order: n } : x)) }} className="w-14 bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-1 focus:outline-none focus:border-primary" />
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">{s.step_type.replace(/_/g, ' ')}</span>
              <input type="text" defaultValue={s.title} disabled={!isAdmin} onBlur={async e => { const v = e.target.value.trim(); if (!v || v === s.title) return; const res = await updateOnboardingStep(s.id, { title: v }); if (res.error) { toast.error(res.error); return } setSteps(prev => prev.map(x => x.id === s.id ? { ...x, title: v } : x)) }} className="flex-1 min-w-[160px] bg-background border border-border text-foreground font-sans text-sm rounded px-2 py-1 focus:outline-none focus:border-primary" />
              {s.is_system && <span className="font-mono text-[10px] text-amber-600">built-in</span>}
            </div>
            {(s.step_type === 'welcome' || s.step_type === 'code_of_conduct' || s.step_type === 'payment' || s.step_type === 'content') && (
              <textarea defaultValue={s.body ?? ''} disabled={!isAdmin} rows={4} maxLength={50000} onBlur={async e => { const v = e.target.value; if (v === (s.body ?? '')) return; const res = await updateOnboardingStep(s.id, { body: v }); if (res.error) { toast.error(res.error); return } setSteps(prev => prev.map(x => x.id === s.id ? { ...x, body: v } : x)) }} placeholder="Markdown / safe HTML" className="w-full bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-2 focus:outline-none focus:border-primary mb-3" />
            )}
            {s.step_type === 'payment' && (
              <input type="url" defaultValue={(s.config?.payment_url as string) ?? ''} disabled={!isAdmin} placeholder="Payment link (https://...)" onBlur={async e => { const v = e.target.value.trim(); if (v === ((s.config?.payment_url as string) ?? '')) return; const res = await updateOnboardingStep(s.id, { config: { ...s.config, payment_url: v } }); if (res.error) { toast.error(res.error); return } setSteps(prev => prev.map(x => x.id === s.id ? { ...x, config: { ...x.config, payment_url: v } } : x)) }} className="w-full bg-background border border-border text-foreground font-mono text-xs rounded px-2 py-2 focus:outline-none focus:border-primary mb-3" />
            )}
            {isAdmin && (
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={s.is_enabled} onChange={async e => { const res = await updateOnboardingStep(s.id, { is_enabled: e.target.checked }); if (res.error) { toast.error(res.error); return } setSteps(prev => prev.map(x => x.id === s.id ? { ...x, is_enabled: e.target.checked } : x)) }} />
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Enabled</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={s.is_required} onChange={async e => { const res = await updateOnboardingStep(s.id, { is_required: e.target.checked }); if (res.error) { toast.error(res.error); return } setSteps(prev => prev.map(x => x.id === s.id ? { ...x, is_required: e.target.checked } : x)) }} />
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Required</span>
                </label>
                {!s.is_system && (
                  <button onClick={async () => { if (!confirm(`Delete step "${s.title}"?`)) return; const res = await deleteOnboardingStep(s.id); if (res.error) { toast.error(res.error); return } setSteps(prev => prev.filter(x => x.id !== s.id)); toast.success('Deleted') }} className="ml-auto font-mono text-[10px] border border-border px-2 py-1 rounded hover:border-red-500 hover:text-red-500 transition">Delete</button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
