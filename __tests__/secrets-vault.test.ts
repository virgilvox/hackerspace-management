import { describe, it, expect } from 'vitest'
import { isSecretConfigField } from '@/lib/secrets/vault'

describe('isSecretConfigField', () => {
  it('treats credential-named fields as secrets to vault', () => {
    for (const k of ['client_secret', 'api_key', 'secret_key', 'webhook_secret', 'signing_secret']) {
      expect(isSecretConfigField(k)).toBe(true)
    }
  })

  it('leaves non-secret config fields in plaintext config', () => {
    for (const k of ['client_id', 'sandbox', 'mode', 'publishable_key', 'username']) {
      expect(isSecretConfigField(k)).toBe(false)
    }
  })

  it('never vaults derived flag/ref keys (no recursion on re-save)', () => {
    expect(isSecretConfigField('client_secret_set')).toBe(false)
    expect(isSecretConfigField('client_secret_ref')).toBe(false)
    expect(isSecretConfigField('api_key_ref')).toBe(false)
  })
})
