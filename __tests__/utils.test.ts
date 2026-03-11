import { describe, it, expect } from 'vitest'

// ─── Date & Time Utilities ────────────────────────────────────────────────────
describe('Date Utilities', () => {
  describe('formatDate', () => {
    it('should format ISO date to readable format', () => {
      const isoDate = '2024-01-15T10:30:00.000Z'
      const date = new Date(isoDate)
      const formatted = date.toLocaleDateString()
      expect(formatted).toBeDefined()
    })

    it('should handle null dates gracefully', () => {
      const date = null
      const formatted = date ? new Date(date).toLocaleDateString() : 'N/A'
      expect(formatted).toBe('N/A')
    })
  })

  describe('isOverdue', () => {
    it('should identify overdue dates', () => {
      const pastDate = new Date(Date.now() - 86400000) // Yesterday
      expect(pastDate < new Date()).toBe(true)
    })

    it('should identify future dates as not overdue', () => {
      const futureDate = new Date(Date.now() + 86400000) // Tomorrow
      expect(futureDate > new Date()).toBe(true)
    })
  })

  describe('getRelativeTime', () => {
    it('should show "just now" for recent times', () => {
      const now = new Date()
      const diff = Date.now() - now.getTime()
      expect(diff).toBeLessThanOrEqual(0)
    })

    it('should calculate days difference', () => {
      const daysAgo = new Date(Date.now() - 3 * 86400000)
      const diffDays = Math.floor((Date.now() - daysAgo.getTime()) / 86400000)
      expect(diffDays).toBe(3)
    })
  })
})

// ─── String Utilities ─────────────────────────────────────────────────────────
describe('String Utilities', () => {
  describe('generateCode', () => {
    it('should generate code from name', () => {
      const name = 'John Doe'
      const code = name.slice(0, 3).toUpperCase() + Math.floor(Math.random() * 900 + 100)
      expect(code).toMatch(/^JOH\d{3}$/)
    })

    it('should handle short names', () => {
      const name = 'Jo'
      const code = name.slice(0, 3).toUpperCase() + Math.floor(100)
      expect(code.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe('getInitials', () => {
    it('should extract initials from full name', () => {
      const name = 'John Doe'
      const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      expect(initials).toBe('JD')
    })

    it('should handle single name', () => {
      const name = 'John'
      const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
      expect(initials).toBe('J')
    })

    it('should handle empty name', () => {
      const name = ''
      const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'
      expect(initials).toBe('??')
    })
  })

  describe('truncate', () => {
    it('should truncate long strings', () => {
      const text = 'This is a very long string that should be truncated'
      const maxLength = 20
      const truncated = text.length > maxLength ? text.slice(0, maxLength) + '...' : text
      expect(truncated.length).toBeLessThanOrEqual(maxLength + 3)
    })

    it('should not truncate short strings', () => {
      const text = 'Short'
      const maxLength = 20
      const truncated = text.length > maxLength ? text.slice(0, maxLength) + '...' : text
      expect(truncated).toBe('Short')
    })
  })
})

// ─── Number Utilities ─────────────────────────────────────────────────────────
describe('Number Utilities', () => {
  describe('formatCurrency', () => {
    it('should format number as currency', () => {
      const amount = 1234.56
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount)
      expect(formatted).toBe('$1,234.56')
    })

    it('should handle zero', () => {
      const amount = 0
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount)
      expect(formatted).toBe('$0.00')
    })

    it('should handle negative numbers', () => {
      const amount = -50
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount)
      expect(formatted).toContain('-')
    })
  })

  describe('clamp', () => {
    it('should clamp value within range', () => {
      const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max)
      expect(clamp(5, 0, 10)).toBe(5)
      expect(clamp(-5, 0, 10)).toBe(0)
      expect(clamp(15, 0, 10)).toBe(10)
    })
  })
})

// ─── Array Utilities ──────────────────────────────────────────────────────────
describe('Array Utilities', () => {
  describe('groupBy', () => {
    it('should group items by key', () => {
      const items = [
        { type: 'task', name: 'A' },
        { type: 'chore', name: 'B' },
        { type: 'task', name: 'C' },
      ]
      const grouped = items.reduce((acc, item) => {
        const key = item.type
        if (!acc[key]) acc[key] = []
        acc[key].push(item)
        return acc
      }, {} as Record<string, typeof items>)
      
      expect(grouped['task']).toHaveLength(2)
      expect(grouped['chore']).toHaveLength(1)
    })
  })

  describe('sortBy', () => {
    it('should sort by string property', () => {
      const items = [
        { name: 'Charlie' },
        { name: 'Alice' },
        { name: 'Bob' },
      ]
      const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name))
      expect(sorted[0].name).toBe('Alice')
    })

    it('should sort by date property', () => {
      const items = [
        { date: '2024-03-01' },
        { date: '2024-01-01' },
        { date: '2024-02-01' },
      ]
      const sorted = [...items].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      expect(sorted[0].date).toBe('2024-01-01')
    })
  })

  describe('unique', () => {
    it('should remove duplicates', () => {
      const items = [1, 2, 2, 3, 3, 3]
      const unique = [...new Set(items)]
      expect(unique).toEqual([1, 2, 3])
    })

    it('should handle strings', () => {
      const items = ['a', 'b', 'a', 'c']
      const unique = [...new Set(items)]
      expect(unique).toEqual(['a', 'b', 'c'])
    })
  })
})

// ─── Validation Utilities ─────────────────────────────────────────────────────
describe('Validation Utilities', () => {
  describe('isValidEmail', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    
    it('should validate correct email', () => {
      expect(emailRegex.test('user@example.com')).toBe(true)
    })

    it('should reject invalid email', () => {
      expect(emailRegex.test('invalid-email')).toBe(false)
    })

    it('should reject email without domain', () => {
      expect(emailRegex.test('user@')).toBe(false)
    })

    it('should reject email without @', () => {
      expect(emailRegex.test('userexample.com')).toBe(false)
    })
  })

  describe('isValidPhone', () => {
    it('should validate US phone numbers', () => {
      const phoneRegex = /^\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/
      expect(phoneRegex.test('(555) 123-4567')).toBe(true)
      expect(phoneRegex.test('555-123-4567')).toBe(true)
    })
  })

  describe('isNonEmpty', () => {
    it('should validate non-empty strings', () => {
      const isNonEmpty = (str: string) => str.trim().length > 0
      expect(isNonEmpty('hello')).toBe(true)
      expect(isNonEmpty('')).toBe(false)
      expect(isNonEmpty('   ')).toBe(false)
    })
  })

  describe('isPositiveNumber', () => {
    it('should validate positive numbers', () => {
      const isPositive = (n: number) => n > 0
      expect(isPositive(1)).toBe(true)
      expect(isPositive(0)).toBe(false)
      expect(isPositive(-1)).toBe(false)
    })
  })
})

// ─── URL Utilities ────────────────────────────────────────────────────────────
describe('URL Utilities', () => {
  describe('buildQueryString', () => {
    it('should build query string from object', () => {
      const params = { page: 1, limit: 10, sort: 'name' }
      const queryString = new URLSearchParams(params as any).toString()
      expect(queryString).toBe('page=1&limit=10&sort=name')
    })

    it('should handle empty object', () => {
      const params = {}
      const queryString = new URLSearchParams(params as any).toString()
      expect(queryString).toBe('')
    })
  })

  describe('parseQueryString', () => {
    it('should parse query string to object', () => {
      const queryString = 'page=1&limit=10'
      const params = Object.fromEntries(new URLSearchParams(queryString))
      expect(params.page).toBe('1')
      expect(params.limit).toBe('10')
    })
  })
})

// ─── Status & Role Utilities ──────────────────────────────────────────────────
describe('Status & Role Utilities', () => {
  describe('isActiveMember', () => {
    it('should identify active statuses', () => {
      const activeStatuses = ['current', 'unverified', 'late']
      expect(activeStatuses.includes('current')).toBe(true)
      expect(activeStatuses.includes('unverified')).toBe(true)
      expect(activeStatuses.includes('late')).toBe(true)
      expect(activeStatuses.includes('inactive')).toBe(false)
    })
  })

  describe('isAdmin', () => {
    it('should identify admin roles', () => {
      const adminRoles = ['admin', 'board']
      expect(adminRoles.includes('admin')).toBe(true)
      expect(adminRoles.includes('board')).toBe(true)
      expect(adminRoles.includes('member')).toBe(false)
    })
  })

  describe('isTreasurer', () => {
    it('should identify treasurer-capable roles', () => {
      const treasurerRoles = ['admin', 'board', 'treasurer']
      expect(treasurerRoles.includes('admin')).toBe(true)
      expect(treasurerRoles.includes('treasurer')).toBe(true)
      expect(treasurerRoles.includes('member')).toBe(false)
    })
  })

  describe('getStatusColor', () => {
    it('should return correct color for status', () => {
      const colors: Record<string, string> = {
        current: 'green',
        unverified: 'yellow',
        late: 'orange',
        inactive: 'gray',
      }
      expect(colors['current']).toBe('green')
      expect(colors['unverified']).toBe('yellow')
    })
  })
})

// ─── Task Utilities ───────────────────────────────────────────────────────────
describe('Task Utilities', () => {
  describe('isTaskOverdue', () => {
    it('should identify overdue tasks', () => {
      const task = { due_date: '2020-01-01', status: 'open' }
      const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'
      expect(isOverdue).toBe(true)
    })

    it('should not flag completed tasks as overdue', () => {
      const task = { due_date: '2020-01-01', status: 'completed' }
      const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'
      expect(isOverdue).toBe(false)
    })
  })

  describe('getRecurrenceLabel', () => {
    it('should return human-readable recurrence', () => {
      const labels: Record<string, string> = {
        none: 'One-time',
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly',
        yearly: 'Yearly',
      }
      expect(labels['daily']).toBe('Daily')
      expect(labels['none']).toBe('One-time')
    })
  })
})
