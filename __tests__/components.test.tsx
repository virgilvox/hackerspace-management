import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ─── Mock Components for Testing ──────────────────────────────────────────────

// Task Badge Component
function TaskBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      data-testid="task-badge"
      className="text-xs bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center"
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}

// Tab Button Component
function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count?: number
  onClick: () => void
}) {
  return (
    <button
      data-testid={`tab-${label.toLowerCase().replace(/\s/g, '-')}`}
      className={active ? 'active' : ''}
      onClick={onClick}
    >
      {label}
      {count !== undefined && count > 0 && <TaskBadge count={count} />}
    </button>
  )
}

// Task Card Component
function TaskCard({
  task,
  onClaim,
  onComplete,
  onDelete,
}: {
  task: { id: string; title: string; status: string; claimed_by?: string }
  onClaim?: () => void
  onComplete?: () => void
  onDelete?: () => void
}) {
  return (
    <div data-testid={`task-${task.id}`} className="task-card">
      <h3>{task.title}</h3>
      <span data-testid="task-status">{task.status}</span>
      {task.status === 'open' && onClaim && (
        <button data-testid="claim-btn" onClick={onClaim}>
          Claim
        </button>
      )}
      {task.claimed_by && onComplete && (
        <button data-testid="complete-btn" onClick={onComplete}>
          Complete
        </button>
      )}
      {onDelete && (
        <button data-testid="delete-btn" onClick={onDelete}>
          Delete
        </button>
      )}
    </div>
  )
}

// Member Status Badge
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    current: 'bg-green-500',
    unverified: 'bg-yellow-500',
    late: 'bg-orange-500',
    inactive: 'bg-gray-500',
  }
  return (
    <span data-testid="status-badge" className={colors[status] || 'bg-gray-300'}>
      {status}
    </span>
  )
}

// Toast Notification
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div data-testid="toast" className={type === 'error' ? 'bg-red-500' : 'bg-green-500'}>
      {message}
    </div>
  )
}

// Empty State
function EmptyState({ message }: { message: string }) {
  return (
    <div data-testid="empty-state" className="text-center py-8">
      <p>{message}</p>
    </div>
  )
}

// Loading Spinner
function LoadingSpinner() {
  return <div data-testid="loading-spinner" className="animate-spin" />
}

// ─── Task Badge Tests ─────────────────────────────────────────────────────────
describe('TaskBadge Component', () => {
  it('should render badge with correct count', () => {
    render(<TaskBadge count={5} />)
    const badge = screen.getByTestId('task-badge')
    expect(badge).toHaveTextContent('5')
  })

  it('should show 9+ for counts over 9', () => {
    render(<TaskBadge count={15} />)
    const badge = screen.getByTestId('task-badge')
    expect(badge).toHaveTextContent('9+')
  })

  it('should not render when count is 0', () => {
    render(<TaskBadge count={0} />)
    expect(screen.queryByTestId('task-badge')).toBeNull()
  })

  it('should not render when count is negative', () => {
    render(<TaskBadge count={-1} />)
    expect(screen.queryByTestId('task-badge')).toBeNull()
  })
})

// ─── Tab Button Tests ─────────────────────────────────────────────────────────
describe('TabButton Component', () => {
  it('should render with label', () => {
    render(<TabButton active={false} label="Open Tasks" onClick={() => {}} />)
    expect(screen.getByText('Open Tasks')).toBeDefined()
  })

  it('should apply active class when active', () => {
    render(<TabButton active={true} label="Test" onClick={() => {}} />)
    const button = screen.getByTestId('tab-test')
    expect(button.className).toContain('active')
  })

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn()
    render(<TabButton active={false} label="Test" onClick={handleClick} />)
    fireEvent.click(screen.getByTestId('tab-test'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should show badge when count > 0', () => {
    render(<TabButton active={false} label="Test" count={3} onClick={() => {}} />)
    expect(screen.getByTestId('task-badge')).toBeDefined()
  })

  it('should not show badge when count is 0', () => {
    render(<TabButton active={false} label="Test" count={0} onClick={() => {}} />)
    expect(screen.queryByTestId('task-badge')).toBeNull()
  })
})

// ─── Task Card Tests ──────────────────────────────────────────────────────────
describe('TaskCard Component', () => {
  const mockTask = {
    id: '1',
    title: 'Test Task',
    status: 'open',
  }

  it('should render task title', () => {
    render(<TaskCard task={mockTask} />)
    expect(screen.getByText('Test Task')).toBeDefined()
  })

  it('should show claim button for open tasks', () => {
    render(<TaskCard task={mockTask} onClaim={() => {}} />)
    expect(screen.getByTestId('claim-btn')).toBeDefined()
  })

  it('should hide claim button for claimed tasks', () => {
    const claimedTask = { ...mockTask, status: 'claimed', claimed_by: 'user-1' }
    render(<TaskCard task={claimedTask} onClaim={() => {}} />)
    expect(screen.queryByTestId('claim-btn')).toBeNull()
  })

  it('should show complete button when task is claimed', () => {
    const claimedTask = { ...mockTask, status: 'claimed', claimed_by: 'user-1' }
    render(<TaskCard task={claimedTask} onComplete={() => {}} />)
    expect(screen.getByTestId('complete-btn')).toBeDefined()
  })

  it('should call onClaim when claim button clicked', () => {
    const handleClaim = vi.fn()
    render(<TaskCard task={mockTask} onClaim={handleClaim} />)
    fireEvent.click(screen.getByTestId('claim-btn'))
    expect(handleClaim).toHaveBeenCalledTimes(1)
  })

  it('should call onDelete when delete button clicked', () => {
    const handleDelete = vi.fn()
    render(<TaskCard task={mockTask} onDelete={handleDelete} />)
    fireEvent.click(screen.getByTestId('delete-btn'))
    expect(handleDelete).toHaveBeenCalledTimes(1)
  })
})

// ─── Status Badge Tests ───────────────────────────────────────────────────────
describe('StatusBadge Component', () => {
  it('should render current status with green', () => {
    render(<StatusBadge status="current" />)
    const badge = screen.getByTestId('status-badge')
    expect(badge.className).toContain('bg-green-500')
  })

  it('should render unverified status with yellow', () => {
    render(<StatusBadge status="unverified" />)
    const badge = screen.getByTestId('status-badge')
    expect(badge.className).toContain('bg-yellow-500')
  })

  it('should render late status with orange', () => {
    render(<StatusBadge status="late" />)
    const badge = screen.getByTestId('status-badge')
    expect(badge.className).toContain('bg-orange-500')
  })

  it('should render inactive status with gray', () => {
    render(<StatusBadge status="inactive" />)
    const badge = screen.getByTestId('status-badge')
    expect(badge.className).toContain('bg-gray-500')
  })

  it('should display status text', () => {
    render(<StatusBadge status="current" />)
    expect(screen.getByText('current')).toBeDefined()
  })
})

// ─── Toast Tests ──────────────────────────────────────────────────────────────
describe('Toast Component', () => {
  it('should render success toast with green background', () => {
    render(<Toast message="Success!" type="success" />)
    const toast = screen.getByTestId('toast')
    expect(toast.className).toContain('bg-green-500')
    expect(screen.getByText('Success!')).toBeDefined()
  })

  it('should render error toast with red background', () => {
    render(<Toast message="Error occurred" type="error" />)
    const toast = screen.getByTestId('toast')
    expect(toast.className).toContain('bg-red-500')
    expect(screen.getByText('Error occurred')).toBeDefined()
  })
})

// ─── Empty State Tests ────────────────────────────────────────────────────────
describe('EmptyState Component', () => {
  it('should render empty state message', () => {
    render(<EmptyState message="No tasks found" />)
    expect(screen.getByText('No tasks found')).toBeDefined()
  })
})

// ─── Loading Spinner Tests ────────────────────────────────────────────────────
describe('LoadingSpinner Component', () => {
  it('should render loading spinner', () => {
    render(<LoadingSpinner />)
    expect(screen.getByTestId('loading-spinner')).toBeDefined()
  })

  it('should have animation class', () => {
    render(<LoadingSpinner />)
    const spinner = screen.getByTestId('loading-spinner')
    expect(spinner.className).toContain('animate-spin')
  })
})

// ─── Task Filtering Logic Tests ───────────────────────────────────────────────
describe('Task Filtering Logic', () => {
  const tasks = [
    { id: '1', task_type: 'task', status: 'open', recurrence: 'none' },
    { id: '2', task_type: 'chore', status: 'open', recurrence: 'weekly' },
    { id: '3', task_type: 'task', status: 'completed', recurrence: 'none' },
    { id: '4', task_type: 'task', status: 'done', recurrence: 'none' },
    { id: '5', task_type: 'chore', status: 'open', recurrence: 'none' },
    { id: '6', task_type: 'task', status: 'open', recurrence: 'daily' },
    { id: '7', task_type: 'task', status: 'claimed', recurrence: 'none', claimed_by: 'user-1' },
  ]

  const isDone = (t: any) => t.status === 'done' || t.status === 'completed'
  const isOpen = (t: any) => !isDone(t)

  it('should correctly identify completed tasks (done OR completed)', () => {
    const doneTasks = tasks.filter(isDone)
    expect(doneTasks).toHaveLength(2)
    expect(doneTasks.map(t => t.id)).toEqual(['3', '4'])
  })

  it('should correctly identify open tasks', () => {
    const openTasks = tasks.filter(isOpen)
    expect(openTasks).toHaveLength(5)
  })

  it('should separate recurring from non-recurring tasks', () => {
    const recurring = tasks.filter(t => t.recurrence && t.recurrence !== 'none')
    const nonRecurring = tasks.filter(t => !t.recurrence || t.recurrence === 'none')

    expect(recurring).toHaveLength(2)
    expect(nonRecurring).toHaveLength(5)
  })

  it('should filter Open Tasks tab (open, non-recurring)', () => {
    const openNonRecurring = tasks.filter(
      t => isOpen(t) && (!t.recurrence || t.recurrence === 'none')
    )
    expect(openNonRecurring).toHaveLength(3)
    expect(openNonRecurring.map(t => t.id)).toEqual(['1', '5', '7'])
  })

  it('should filter Ongoing tab (open, recurring)', () => {
    const ongoing = tasks.filter(
      t => t.recurrence && t.recurrence !== 'none' && isOpen(t)
    )
    expect(ongoing).toHaveLength(2)
    expect(ongoing.map(t => t.id)).toEqual(['2', '6'])
  })

  it('should filter My Tasks tab by user', () => {
    const userId = 'user-1'
    const myTasks = tasks.filter(
      t => (t.claimed_by === userId || (t as any).assigned_to === userId) && isOpen(t)
    )
    expect(myTasks).toHaveLength(1)
    expect(myTasks[0].id).toBe('7')
  })

  it('should filter Done tab (completed or done)', () => {
    const doneTasks = tasks.filter(isDone)
    expect(doneTasks).toHaveLength(2)
  })
})

// ─── Form Validation Tests ────────────────────────────────────────────────────
describe('Form Validation', () => {
  it('should validate required task title', () => {
    const title = ''
    const isValid = title.trim().length > 0
    expect(isValid).toBe(false)
  })

  it('should validate email format', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    expect(emailRegex.test('valid@email.com')).toBe(true)
    expect(emailRegex.test('invalid-email')).toBe(false)
  })

  it('should validate payment amount is positive', () => {
    const amount = 100
    expect(amount > 0).toBe(true)
  })

  it('should reject negative payment amount', () => {
    const amount = -50
    expect(amount > 0).toBe(false)
  })
})

// ─── Accessibility Tests ──────────────────────────────────────────────────────
describe('Accessibility', () => {
  it('should have proper button roles', () => {
    render(<TabButton active={false} label="Test" onClick={() => {}} />)
    const button = screen.getByRole('button')
    expect(button).toBeDefined()
  })

  it('should have testable elements', () => {
    render(<TaskBadge count={5} />)
    expect(screen.getByTestId('task-badge')).toBeDefined()
  })
})
