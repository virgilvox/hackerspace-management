/**
 * Security utilities for input sanitization and validation
 */

/**
 * Sanitize a string by removing potentially dangerous characters
 * Prevents XSS and injection attacks when displaying user input
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
}

/**
 * Sanitize HTML content - strips all HTML tags
 * Use when you need plain text from user input
 */
export function stripHtml(input: string): string {
  if (typeof input !== 'string') return ''
  return input.replace(/<[^>]*>/g, '').trim()
}

/**
 * Escape HTML entities for safe display
 * Use when you need to display user input in HTML context
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') return ''
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }
  return input.replace(/[&<>"'/]/g, char => htmlEntities[char] || char)
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== 'string') return null
  const sanitized = email.toLowerCase().trim()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(sanitized) ? sanitized : null
}

/**
 * Sanitize URL - only allow http/https protocols
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== 'string') return null
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.href
  } catch {
    return null
  }
}

/**
 * Sanitize slug - only allow lowercase alphanumeric and hyphens
 */
export function sanitizeSlug(input: string): string {
  if (typeof input !== 'string') return ''
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

/**
 * Check if input contains potential SQL injection patterns
 * Note: Always use parameterized queries - this is an additional safety layer
 */
export function hasSqlInjectionPatterns(input: string): boolean {
  if (typeof input !== 'string') return false
  const patterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
    /(--|;|\/\*|\*\/)/,
    /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
  ]
  return patterns.some(pattern => pattern.test(input))
}

/**
 * Validate UUID format
 */
export function isValidUuid(id: string): boolean {
  if (typeof id !== 'string') return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

/**
 * Truncate string to max length with ellipsis
 */
export function truncate(input: string, maxLength: number): string {
  if (typeof input !== 'string') return ''
  if (input.length <= maxLength) return input
  return input.slice(0, maxLength - 3) + '...'
}

/**
 * Simple in-memory rate limiter for server actions
 * For production, use Redis-based rate limiting
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now }
  }

  entry.count++
  return { allowed: true, remaining: maxRequests - entry.count, resetIn: entry.resetTime - now }
}

/**
 * Validate content length
 */
export function validateContentLength(
  content: string,
  minLength: number = 0,
  maxLength: number = 10000
): { valid: boolean; error?: string } {
  if (typeof content !== 'string') {
    return { valid: false, error: 'Content must be a string' }
  }
  if (content.length < minLength) {
    return { valid: false, error: `Content must be at least ${minLength} characters` }
  }
  if (content.length > maxLength) {
    return { valid: false, error: `Content must be less than ${maxLength} characters` }
  }
  return { valid: true }
}
