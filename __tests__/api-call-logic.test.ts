import { describe, it, expect } from 'vitest'
import { buildApiRequest } from '@/lib/api-call-logic'

describe('buildApiRequest', () => {
  it('injects a query secret with the right separator', () => {
    const a = buildApiRequest({ baseUrl: 'https://h/x', method: 'GET', authMode: 'query', authParam: 'key', secret: 's3cret' })
    expect(a.url).toBe('https://h/x?key=s3cret')
    const b = buildApiRequest({ baseUrl: 'https://h/x?a=1', method: 'GET', authMode: 'query', authParam: 'key', secret: 's3cret' })
    expect(b.url).toBe('https://h/x?a=1&key=s3cret')
  })

  it('url-encodes the query secret', () => {
    const r = buildApiRequest({ baseUrl: 'https://h/x', method: 'GET', authMode: 'query', authParam: 'k', secret: 'a b&c' })
    expect(r.url).toBe('https://h/x?k=a%20b%26c')
  })

  it('injects a bearer secret as an Authorization header', () => {
    const r = buildApiRequest({ baseUrl: 'https://h', method: 'POST', authMode: 'bearer', secret: 'tok' })
    expect(r.headers['authorization']).toBe('Bearer tok')
    expect(r.url).toBe('https://h')
  })

  it('injects a custom-header secret under the named (lower-cased) header', () => {
    const r = buildApiRequest({ baseUrl: 'https://h', method: 'POST', authMode: 'header', authParam: 'X-Api-Key', secret: 'k' })
    expect(r.headers['x-api-key']).toBe('k')
  })

  it('injects nothing for auth_mode none, or when secret is absent', () => {
    const none = buildApiRequest({ baseUrl: 'https://h', method: 'GET', authMode: 'none', secret: 'ignored-no-param' })
    expect(none.url).toBe('https://h')
    expect(Object.keys(none.headers)).not.toContain('authorization')
    const noSecret = buildApiRequest({ baseUrl: 'https://h', method: 'GET', authMode: 'bearer', secret: null })
    expect(noSecret.headers['authorization']).toBeUndefined()
  })

  it('drops a caller-supplied host header (executor forces the pinned host)', () => {
    const r = buildApiRequest({ baseUrl: 'https://h', method: 'POST', authMode: 'none', headers: { Host: 'evil.example', 'X-Other': 'ok' } })
    expect(r.headers['host']).toBeUndefined()
    expect(r.headers['x-other']).toBe('ok')
  })

  it('appends url_template to the base url', () => {
    const r = buildApiRequest({ baseUrl: 'https://h', urlTemplate: '/toggle?id=5', method: 'GET', authMode: 'none' })
    expect(r.url).toBe('https://h/toggle?id=5')
  })

  it('carries a body only for body-bearing verbs', () => {
    expect(buildApiRequest({ baseUrl: 'https://h', method: 'GET', authMode: 'none', body: '{"a":1}' }).body).toBeNull()
    expect(buildApiRequest({ baseUrl: 'https://h', method: 'POST', authMode: 'none', body: '{"a":1}' }).body).toBe('{"a":1}')
    expect(buildApiRequest({ baseUrl: 'https://h', method: 'delete', authMode: 'none', body: 'x' }).body).toBe('x')
  })

  it('uppercases the method', () => {
    expect(buildApiRequest({ baseUrl: 'https://h', method: 'post', authMode: 'none' }).method).toBe('POST')
  })
})
