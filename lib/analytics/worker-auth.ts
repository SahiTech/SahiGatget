import { createHash, timingSafeEqual } from 'node:crypto'

export function matchesBearerSecret(
  authorization: string | null,
  expectedSecret: string | null | undefined,
): boolean {
  if (!authorization?.startsWith('Bearer ')) return false

  const presentedSecret = authorization.slice('Bearer '.length)
  const expected = expectedSecret?.trim()
  if (!presentedSecret || !expected) return false

  const presentedHash = createHash('sha256').update(presentedSecret, 'utf8').digest()
  const expectedHash = createHash('sha256').update(expected, 'utf8').digest()

  return timingSafeEqual(presentedHash, expectedHash) && presentedSecret.length === expected.length
}
