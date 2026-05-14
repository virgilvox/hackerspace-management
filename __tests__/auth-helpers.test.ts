import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { parseInput } from '@/lib/auth-helpers'

describe('parseInput', () => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required').max(10, 'Name is too long'),
    age: z.number().int().nonnegative(),
  })

  it('returns parsed data on success', () => {
    const r = parseInput(schema, { name: 'Alice', age: 30 })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data).toEqual({ name: 'Alice', age: 30 })
    }
  })

  it('returns the first validation message on failure', () => {
    const r = parseInput(schema, { name: '', age: 30 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBe('Name is required')
    }
  })

  it('returns an error for completely invalid input', () => {
    const r = parseInput(schema, null)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBeDefined()
    }
  })

  it('returns a fallback message when zod has no error message', () => {
    const minimal = z.string()
    const r = parseInput(minimal, 42)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBeDefined()
    }
  })
})
