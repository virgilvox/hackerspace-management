import { describe, it, expect, beforeEach } from 'vitest'
import {
  sanitizeString,
  stripHtml,
  escapeHtml,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeSlug,
  hasSqlInjectionPatterns,
  isValidUuid,
  truncate,
  checkRateLimit,
  validateContentLength,
} from '@/lib/security'

describe('sanitizeString', () => {
  it('strips HTML brackets', () => {
    expect(sanitizeString('<script>alert(1)</script>')).toBe('scriptalert(1)/script')
  })
  it('strips javascript: protocol', () => {
    expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)')
  })
  it('strips event handlers', () => {
    expect(sanitizeString('onclick="x"')).toBe('"x"')
  })
  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })
  it('returns empty string for non-strings', () => {
    expect(sanitizeString(null as unknown as string)).toBe('')
    expect(sanitizeString(undefined as unknown as string)).toBe('')
    expect(sanitizeString(42 as unknown as string)).toBe('')
  })
})

describe('escapeHtml', () => {
  it('escapes the six dangerous characters', () => {
    expect(escapeHtml(`<>&"'/`)).toBe('&lt;&gt;&amp;&quot;&#x27;&#x2F;')
  })
})

describe('stripHtml', () => {
  it('removes tags but keeps content', () => {
    expect(stripHtml('<p>hello <b>world</b></p>')).toBe('hello world')
  })
})

describe('sanitizeEmail', () => {
  it('lowercases and validates', () => {
    expect(sanitizeEmail('Foo@Bar.com')).toBe('foo@bar.com')
  })
  it('rejects malformed addresses', () => {
    expect(sanitizeEmail('not-an-email')).toBeNull()
    expect(sanitizeEmail('foo@')).toBeNull()
  })
})

describe('sanitizeUrl', () => {
  it('passes through https', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com/')
  })
  it('rejects javascript: and file:', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizeUrl('file:///etc/passwd')).toBeNull()
  })
})

describe('sanitizeSlug', () => {
  it('lowercases and collapses to alphanumeric+hyphen', () => {
    expect(sanitizeSlug('Hello World!')).toBe('helloworld')
    expect(sanitizeSlug('hello---world')).toBe('hello-world')
  })
  it('caps length at 50', () => {
    const result = sanitizeSlug('a'.repeat(100))
    expect(result.length).toBeLessThanOrEqual(50)
  })
})

describe('hasSqlInjectionPatterns', () => {
  it('flags common keywords', () => {
    expect(hasSqlInjectionPatterns("'; DROP TABLE users; --")).toBe(true)
    expect(hasSqlInjectionPatterns('OR 1=1')).toBe(true)
  })
  it('does not flag normal text', () => {
    expect(hasSqlInjectionPatterns('Hello, world')).toBe(false)
  })
})

describe('isValidUuid', () => {
  it('accepts a v4 UUID', () => {
    expect(isValidUuid('11111111-2222-4333-8444-555555555555')).toBe(true)
  })
  it('rejects garbage', () => {
    expect(isValidUuid('hello')).toBe(false)
  })
})

describe('truncate', () => {
  it('shortens and appends ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello...')
  })
  it('returns the original if under the limit', () => {
    expect(truncate('hello', 50)).toBe('hello')
  })
})

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Reset the in-memory map between tests by churning fresh identifiers.
  })

  it('allows requests under the limit', () => {
    const id = `t1-${Date.now()}`
    expect(checkRateLimit(id, 3, 60000).allowed).toBe(true)
    expect(checkRateLimit(id, 3, 60000).allowed).toBe(true)
    expect(checkRateLimit(id, 3, 60000).allowed).toBe(true)
  })

  it('blocks once the limit is hit', () => {
    const id = `t2-${Date.now()}`
    checkRateLimit(id, 2, 60000)
    checkRateLimit(id, 2, 60000)
    expect(checkRateLimit(id, 2, 60000).allowed).toBe(false)
  })

  it('reports remaining count', () => {
    const id = `t3-${Date.now()}`
    expect(checkRateLimit(id, 3, 60000).remaining).toBe(2)
    expect(checkRateLimit(id, 3, 60000).remaining).toBe(1)
  })
})

describe('validateContentLength', () => {
  it('passes when length is in range', () => {
    expect(validateContentLength('hello', 1, 10).valid).toBe(true)
  })
  it('fails when too short', () => {
    expect(validateContentLength('', 1, 10).valid).toBe(false)
  })
  it('fails when too long', () => {
    expect(validateContentLength('x'.repeat(11), 1, 10).valid).toBe(false)
  })
})
