'use client'

import { useState, useTransition } from 'react'
import { Plus, X, CheckCircle2 } from 'lucide-react'
import { createTask, claimTask, completeTask, deleteTask } from '@/lib/actions'

interface Task {
  id: string
  title: string
  description?: string
  type?: string
  task_type?: string
  status: string
  area?: string
  recurrence?: string
  due_date?: string
  claimed_by?: string
  claimed_by_name?: string
  assigned_to?: string
  assigned_to_name?: string
  progress?: number
  subtask_completed?: number
  subtask_total?: number
  created_at: string
}

interface Props {
  tasks: Task[]
  members: { id: string; display_name: string; user_id: string }[]
  currentUserId: string
  spaceId: string
}

const AREAS = ['3D Printing', 'Electronics', 'Woodshop', 'Laser', 'Metal Shop', 'Facilities', 'Admin', 'Kitchen', 'General']
const RECURRENCES = ['none', 'daily', 'weekly', 'biweekly', 'monthly']

export function TasksClient({ tasks: initialTasks, members, currentUserId, spaceId }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [activeTab, setActiveTab] = useState<'chores' | 'ongoing' | 'mine' | 'done'>('chores')
  const [filterArea, setFilterArea] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Create form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'task',
    area: '',
    recurrence: 'none',
    due_date: '',
  })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Ongoing = tasks with a recurrence (not 'none')
  const isDone = (t: any) => t.status === 'done' || t.status === 'completed'
  const isOpen = (t: any) => !isDone(t)
  const chores = tasks.filter(t => (t.type === 'chore' || t.task_type === 'chore') && isOpen(t) && (!t.recurrence || t.recurrence === 'none'))
  const ongoing = tasks.filter(t => t.recurrence && t.recurrence !== 'none' && isOpen(t))
  const mine = tasks.filter(t => (t.claimed_by === currentUserId || t.assigned_to === currentUserId) && isOpen(t))
  const done = tasks.filter(isDone)

  const filtered = (list: Task[]) => filterArea ? list.filter(t => t.area === filterArea) : list

  const tabData = { chores: filtered(chores), ongoing: filtered(ongoing), mine: filtered(mine), done: filtered(done) }
  const currentList = tabData[activeTab]

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setFormLoading(true)
    setFormError('')

    const result = await createTask(form)
    if (result.error) {
      setFormError(result.error)
      setFormLoading(false)
      return
    }

    if (result.data) {
      setTasks(prev => [result.data as Task, ...prev])
    }
    setShowCreate(false)
    setForm({ title: '', description: '', type: 'task', area: '', recurrence: 'none', due_date: '' })
    setFormLoading(false)
  }

  async function handleClaim(taskId: string) {
    const result = await claimTask(taskId)
    if (!result.error) {
      const member = members.find(m => m.user_id === currentUserId)
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: 'claimed', claimed_by: currentUserId, claimed_by_name: member?.display_name }
          : t
      ))
    }
  }

  async function handleComplete(taskId: string) {
    const result = await completeTask(taskId)
    if (!result.error) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed' } : t))
    }
  }

  async function handleDelete(taskId: string) {
    const result = await deleteTask(taskId)
    if (!result.error) {
      setTasks(prev => prev.filter(t => t.id !== taskId))
    }
  }

  const tabCounts = {
    chores: filtered(chores).length,
    ongoing: filtered(ongoing).length,
    mine: filtered(mine).length,
    done: filtered(done).length,
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-white font-sans text-lg font-semibold">Tasks & Chores</h1>
            <span className="font-mono text-xs text-white/50">{tasks.filter(t => !isDone(t)).length} open</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterArea}
            onChange={e => setFilterArea(e.target.value)}
            className="hidden sm:block bg-sidebar-accent border border-sidebar-border text-sidebar-foreground text-xs font-sans rounded px-2 py-1.5"
          >
            <option value="">All Areas</option>
            {AREAS.map(a => <option key={a}>{a}</option>)}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-primary text-white text-xs font-sans px-3 py-1.5 rounded hover:bg-primary/90 transition"
          >
            <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">New Task</span>
          </button>
        </div>
      </div>

      <div className="bg-card border-b border-border px-4 md:px-6 flex gap-4 md:gap-6 overflow-x-auto">
        {(['chores', 'ongoing', 'mine', 'done'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`font-sans text-sm py-3 border-b-2 transition capitalize ${
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'mine' ? 'My Tasks' : tab.charAt(0).toUpperCase() + tab.slice(1)}{' '}
            {tabCounts[tab] > 0 && (
              <span className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                activeTab === tab ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6">
        <div className="bg-card rounded border border-border divide-y divide-border">
          {currentList.length > 0 ? currentList.map(task => (
            <div key={task.id} className={`flex items-center gap-3 px-4 py-3 ${
              task.status === 'done' || task.status === 'completed' ? 'opacity-60' : ''
            }`}>
              <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center ${
                isDone(task) ? 'bg-primary' : 'border-2 border-border'
              }`}>
                {isDone(task) && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-sans text-sm ${isDone(task) ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {task.title}
                </p>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  {[
                    task.area,
                    task.recurrence && task.recurrence !== 'none' ? `${task.recurrence} recurring` : null,
                    task.claimed_by_name ? `claimed by ${task.claimed_by_name}` : null,
                    task.assigned_to_name ? `assigned to ${task.assigned_to_name}` : null,
                    task.due_date ? `due ${new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>

              <span className={`font-mono text-[10px] px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${
                task.status === 'claimed' ? 'text-primary bg-primary/10' :
                task.status === 'in_progress' ? 'text-blue-600 bg-blue-50' :
                task.status === 'blocked' ? 'text-orange-600 bg-orange-50' :
                isDone(task) ? 'text-muted-foreground bg-muted' :
                'text-muted-foreground bg-muted'
              }`}>
                {task.status.toUpperCase().replace('_', ' ')}
              </span>

              {task.status === 'open' && (
                <button
                  onClick={() => handleClaim(task.id)}
                  className="font-mono text-[10px] border border-border px-2 py-0.5 rounded hover:border-primary hover:text-primary transition whitespace-nowrap"
                >
                  CLAIM
                </button>
              )}

              {(task.status === 'claimed' || task.status === 'in_progress') && task.claimed_by === currentUserId && (
                <button
                  onClick={() => handleComplete(task.id)}
                  className="font-mono text-[10px] border border-green-200 text-green-700 px-2 py-0.5 rounded hover:bg-green-50 transition whitespace-nowrap"
                >
                  DONE
                </button>
              )}

              <button
                onClick={() => handleDelete(task.id)}
                className="text-muted-foreground hover:text-destructive transition flex-shrink-0"
                aria-label="Delete task"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )) : (
            <div className="px-4 py-10 text-center">
              <p className="font-sans text-sm text-muted-foreground">No {activeTab === 'done' ? 'completed' : 'open'} tasks in this view</p>
              <button
                onClick={() => setShowCreate(true)}
                className="font-mono text-xs text-primary mt-2 hover:underline"
              >
                + Add first task
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-sans text-base font-semibold text-foreground">New Task</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Clean the laser cutters"
                  required
                  autoFocus
                  className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition"
                />
              </div>

              <div>
                <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional details..."
                  rows={2}
                  className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="task">Task</option>
                    <option value="chore">Chore</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Area</label>
                  <select
                    value={form.area}
                    onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                    className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">No area</option>
                    {AREAS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Recurrence</label>
                  <select
                    value={form.recurrence}
                    onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}
                    className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    {RECURRENCES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full bg-background border border-border rounded px-3 py-2 font-sans text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {formError && <p className="font-mono text-xs text-red-500">{formError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border border-border text-foreground font-sans text-sm py-2 rounded hover:border-primary/50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading || !form.title.trim()}
                  className="flex-1 bg-primary text-white font-sans text-sm py-2 rounded hover:bg-primary/90 transition disabled:opacity-60"
                >
                  {formLoading ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
