// AES-256-GCM encryption for the Secrets vault.
//
// Key handling:
//   The master key comes from process.env.SECRETS_ENCRYPTION_KEY (64 hex chars).
//   It MUST NOT be reachable from the browser; this module is server-only.
//
// Storage layout (encryption_version = 1):
//   ciphertext field bytes = iv (12) || ciphertext (N) || authTag (16)
//
// A per-secret IV is generated on every encrypt. Decryption rejects any payload
// shorter than 28 bytes (12 IV + 16 tag) before touching the crypto primitive.

import crypto from 'node:crypto'

const VERSION = 1
const IV_LEN = 12
const TAG_LEN = 16

function readKey(): Buffer {
  const hex = process.env.SECRETS_ENCRYPTION_KEY
  if (!hex) {
    throw new Error('SECRETS_ENCRYPTION_KEY is not set. Generate with `openssl rand -hex 32` and add to your environment.')
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('SECRETS_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptionAvailable(): boolean {
  const hex = process.env.SECRETS_ENCRYPTION_KEY
  return !!hex && /^[0-9a-fA-F]{64}$/.test(hex)
}

export function encryptSecret(plaintext: string): { ciphertext: Buffer; version: number } {
  const key = readKey()
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return { ciphertext: Buffer.concat([iv, ct, tag]), version: VERSION }
}

export function decryptSecret(buf: Buffer | Uint8Array | null | undefined, version: number): string {
  if (!buf) throw new Error('No ciphertext')
  const data = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
  if (version !== VERSION) throw new Error(`Unknown ciphertext version ${version}`)
  if (data.length < IV_LEN + TAG_LEN + 1) throw new Error('Ciphertext too short')
  const iv = data.subarray(0, IV_LEN)
  const tag = data.subarray(data.length - TAG_LEN)
  const ct = data.subarray(IV_LEN, data.length - TAG_LEN)
  const key = readKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}
