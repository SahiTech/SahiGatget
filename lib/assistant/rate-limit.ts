import 'server-only'

const WINDOW_SECONDS = 300
const MAX_REQUESTS = 12
const DAILY_BUDGET = 1000
const localBuckets = new Map<string, { count: number; resetAt: number }>()

type RateLimitResult = { allowed: boolean; retryAfterSeconds?: number; configured: boolean }

function envValue(name: string) {
  return process.env[name]?.trim() || ''
}

function localCheck(key: string, maxRequests = MAX_REQUESTS, windowSeconds = WINDOW_SECONDS): RateLimitResult {
  const now = Date.now()
  const existing = localBuckets.get(key)
  if (!existing || existing.resetAt <= now) {
    localBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 })
    return { allowed: true, configured: false }
  }
  if (existing.count >= maxRequests) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)), configured: false }
  }
  existing.count += 1
  return { allowed: true, configured: false }
}

async function upstashIncrement(key: string, windowSeconds: number) {
  const url = envValue('UPSTASH_REDIS_REST_URL').replace(/\/$/, '')
  const token = envValue('UPSTASH_REDIS_REST_TOKEN')
  const response = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('RATE_LIMIT_STORE_UNAVAILABLE')
  const count = Number(await response.json())
  if (count === 1) {
          await fetch(`${url}/expire/${encodeURIComponent(key)}/${windowSeconds}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
  }
  return count
}

export async function checkAssistantRateLimit(identity: { ip: string; sessionId: string }, controls?: { maxRequestsPerWindow: number; rateLimitWindowSeconds: number; dailyRequestBudget: number }): Promise<RateLimitResult> {
  const maxRequests = controls?.maxRequestsPerWindow ?? MAX_REQUESTS
  const windowSeconds = controls?.rateLimitWindowSeconds ?? WINDOW_SECONDS
  const dailyBudget = controls?.dailyRequestBudget ?? DAILY_BUDGET
  const ipKey = `sahigadget:assistant:ip:${identity.ip.slice(0, 80)}`
  const sessionKey = `sahigadget:assistant:session:${identity.sessionId.slice(0, 128)}`
  const budgetKey = `sahigadget:assistant:budget:${new Date().toISOString().slice(0, 10)}`
  const url = envValue('UPSTASH_REDIS_REST_URL')
  const token = envValue('UPSTASH_REDIS_REST_TOKEN')
  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') return { allowed: false, configured: false, retryAfterSeconds: 3600 }
    const ipLimit = localCheck(ipKey, maxRequests, windowSeconds)
    if (!ipLimit.allowed) return ipLimit
    return localCheck(sessionKey, maxRequests, windowSeconds)
  }
  try {
    const ipCount = await upstashIncrement(ipKey, windowSeconds)
    const sessionCount = await upstashIncrement(sessionKey, windowSeconds)
    const dailyCount = await upstashIncrement(budgetKey, 86400)
    if (ipCount > maxRequests || sessionCount > maxRequests) return { allowed: false, configured: true, retryAfterSeconds: windowSeconds }
    if (dailyCount > dailyBudget) return { allowed: false, configured: true, retryAfterSeconds: 86400 }
    return { allowed: true, configured: true }
  } catch {
    return { allowed: false, configured: true, retryAfterSeconds: 60 }
  }
}
