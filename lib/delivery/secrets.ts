import 'server-only'

import { createDecipheriv, createCipheriv, randomBytes } from 'node:crypto'

const algorithm = 'aes-256-gcm'
const version = 'v1'

function getKey() {
  const raw = process.env.PATHAO_TOKEN_ENCRYPTION_KEY
  if (!raw) throw new Error('PATHAO_TOKEN_ENCRYPTION_KEY is not configured.')
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('PATHAO_TOKEN_ENCRYPTION_KEY must decode to 32 bytes.')
  return key
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(algorithm, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [version, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptSecret(value: string) {
  const [storedVersion, ivEncoded, tagEncoded, ciphertextEncoded] = value.split('.')
  if (storedVersion !== version || !ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error('Unsupported encrypted secret format.')
  const decipher = createDecipheriv(algorithm, getKey(), Buffer.from(ivEncoded, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, 'base64url')), decipher.final()]).toString('utf8')
}
