import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock component for testing
function TaskBadge({ count }: { count: number }) {
  return <span data-testid="task-badge">{count}</span>
}

describe('UI Components', () => {
  it('should render task badge with correct count', () => {
    render(<TaskBadge count={2} />)
    const badge = screen.getByTestId('task-badge')
    expect(badge).toHaveTextContent('2')
  })

  it('should display zero when no tasks', () => {
    render(<TaskBadge count={0} />)
    const badge = screen.getByTestId('task-badge')
    expect(badge).toHaveTextContent('0')
  })
})

describe('Task Filtering Logic', () => {
  it('should correctly identify open vs done tasks', () => {
    const tasks = [
      { id: 1, status: 'open', title: 'Task 1' },
      { id: 2, status: 'completed', title: 'Task 2' },
      { id: 3, status: 'done', title: 'Task 3' },
    ]

    const isDone = (t: any) => t.status === 'done' || t.status === 'completed'
    const openTasks = tasks.filter(t => !isDone(t))
    const doneTasks = tasks.filter(isDone)

    expect(openTasks).toHaveLength(1)
    expect(doneTasks).toHaveLength(2)
  })

  it('should separate ongoing tasks (recurring) from regular tasks', () => {
    const tasks = [
      { id: 1, type: 'task', recurrence: 'none' },
      { id: 2, type: 'chore', recurrence: 'weekly' },
      { id: 3, type: 'task', recurrence: 'daily' },
    ]

    const ongoing = tasks.filter(t => t.recurrence && t.recurrence !== 'none')
    const regular = tasks.filter(t => !t.recurrence || t.recurrence === 'none')

    expect(ongoing).toHaveLength(2)
    expect(regular).toHaveLength(1)
  })
})
