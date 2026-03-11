'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { createProject, updateProjectStatus, deleteProject } from '@/lib/actions'
import type { Tables } from '@/types/database'

type Project = Tables<'projects'>

const STATUS_COLS = [
  { key: 'backlog', label: 'BACKLOG', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  { key: 'in_progress', label: 'IN PROGRESS', color: 'text-primary', dot: 'bg-primary' },
  { key: 'review', label: 'REVIEW', color: 'text-blue-600', dot: 'bg-blue-500' },
  { key: 'done', label: 'DONE', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
]

const AREAS = ['3D Printing', 'Electronics', 'Woodshop', 'Laser', 'Metal Shop', 'Facilities', 'Admin', 'Software', 'General']

export function ProjectsClient({ projects: initialProjects, spaceId }: { projects: Project[], spaceId: string }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', area: '', tags: '', due_date: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const columns: Record<string, Project[]> = {}
  STATUS_COLS.forEach(col => { columns[col.key] = projects.filter(p => p.status === col.key) })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    const result = await createProject({
      title: form.title,
      description: form.description,
      area: form.area,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      due_date: form.due_date,
    })
    if (result.error) { setFormError(result.error); setFormLoading(false); return }
    if (result.data) setProjects(prev => [result.data as Project, ...prev])
    setShowCreate(false)
    setForm({ title: '', description: '', area: '', tags: '', due_date: '' })
    setFormLoading(false)
  }

  async function handleStatusChange(projectId: string, newStatus: string) {
    const result = await updateProjectStatus(projectId, newStatus)
    if (!result.error) {
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p))
    }
  }

  async function handleDelete(projectId: string) {
    if (!confirm('Delete this project?')) return
    const result = await deleteProject(projectId)
    if (!result.error) setProjects(prev => prev.filter(p => p.id !== projectId))
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
        <h1 className="text-white font-sans text-lg font-semibold">Projects</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition"
        >
          <Plus className="w-3.5 h-3.5" /> New Project
        </button>
      </div>

      <div className="p-4 md:p-6">
        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
        <div className="grid grid-cols-4 gap-4 min-w-[640px]">
          {STATUS_COLS.map(col => {
            const items = columns[col.key] ?? []
            return (
              <div key={col.key} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <p className={`font-mono text-[10px] tracking-widest ${col.color}`}>{col.label}</p>
                  <span className="font-mono text-[10px] text-muted-foreground ml-auto">{items.length}</span>
                </div>

                {items.map(project => (
                  <div key={project.id} className="bg-card rounded border border-border p-4 hover:border-primary/30 transition group">
                    <div className="flex items-start justify-between mb-1 gap-2">
                      <p className="font-sans text-sm font-medium text-foreground leading-tight">{project.title}</p>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition flex-shrink-0"
                        aria-label="Delete project"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {project.description && (
                      <p className="font-sans text-xs text-muted-foreground mb-2 line-clamp-2">{project.description}</p>
                    )}
                    <p className="font-mono text-[10px] text-muted-foreground mb-3">
                      {[project.area, project.due_date ? `due ${new Date(project.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : null].filter(Boolean).join(' · ')}
                    </p>
                    {project.progress !== undefined && project.progress !== null && (
                      <div className="h-1 bg-border rounded-full overflow-hidden mb-3">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${project.progress}%` }} />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {project.tags?.map((tag: string) => (
                        <span key={tag} className="font-mono text-[10px] px-1.5 py-0.5 border border-border rounded text-muted-foreground">
                          {tag.toUpperCase()}
                        </span>
                      ))}
                    </div>
                    {/* Status change */}
                    <select
                      value={project.status}
                      onChange={e => handleStatusChange(project.id, e.target.value)}
                      className="w-full bg-muted border border-border rounded px-2 py-1 font-mono text-[10px] text-foreground focus:outline-none focus:border-primary cursor-pointer"
                    >
                      {STATUS_COLS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                ))}

                <button
                  onClick={() => setShowCreate(true)}
                  className="border-2 border-dashed border-border rounded p-3 text-center hover:border-primary/40 transition group"
                >
                  <p className="font-sans text-xs text-muted-foreground group-hover:text-primary transition">+ Add project</p>
                </button>
              </div>
            )
          })}
        </div>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-sans text-base font-semibold text-foreground">New Project</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Title *</label>
                <input type="text" required autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="CNC Controller Upgrade"
                  className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition" />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Area</label>
                  <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                    className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary">
                    <option value="">No area</option>
                    {AREAS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Tags (comma-separated)</label>
                <input type="text" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="electronics, hardware, cnc"
                  className="w-full bg-background border border-border rounded px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition" />
              </div>
              {formError && <p className="font-mono text-xs text-red-500">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-border text-foreground font-sans text-sm py-2 rounded hover:border-primary/50 transition">Cancel</button>
                <button type="submit" disabled={formLoading} className="flex-1 bg-primary text-white font-sans text-sm py-2 rounded hover:bg-primary/90 transition disabled:opacity-60">
                  {formLoading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
