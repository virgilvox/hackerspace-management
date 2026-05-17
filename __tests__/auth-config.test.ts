import { describe, it, expect } from 'vitest'
import { resolveOAuthProviders, anyOAuthProvider } from '@/lib/auth-config'

describe('resolveOAuthProviders', () => {
  it('enables a provider only when its flag is exactly "true"', () => {
    expect(resolveOAuthProviders({ github: 'true', google: 'true' })).toEqual({
      github: true,
      google: true,
    })
  })

  it('treats unset / empty / other values as disabled', () => {
    expect(resolveOAuthProviders({})).toEqual({ github: false, google: false })
    expect(resolveOAuthProviders({ github: '', google: 'false' })).toEqual({
      github: false,
      google: false,
    })
    expect(resolveOAuthProviders({ github: 'TRUE', google: '1' })).toEqual({
      github: false,
      google: false,
    })
  })

  it('resolves each provider independently', () => {
    expect(resolveOAuthProviders({ github: 'true' })).toEqual({
      github: true,
      google: false,
    })
  })
})

describe('anyOAuthProvider', () => {
  it('is false when no provider is enabled', () => {
    expect(anyOAuthProvider({ github: false, google: false })).toBe(false)
  })

  it('is true when at least one provider is enabled', () => {
    expect(anyOAuthProvider({ github: true, google: false })).toBe(true)
    expect(anyOAuthProvider({ github: false, google: true })).toBe(true)
  })
})
