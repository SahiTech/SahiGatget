import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { randomUUID } from 'node:crypto'

import { assistantRequestSchema } from '@/lib/assistant/contracts'
import { checkAssistantRateLimit } from '@/lib/assistant/rate-limit'
import { buildAssistantResponse, isAssistantProviderConfigured } from '@/lib/assistant/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 24_000

function errorResponse(requestId: string, status: number, code: string, message: string, retryAfterSeconds?: number) {
  const response = NextResponse.json({ requestId, error: { code, message, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) } }, { status })
  response.headers.set('Cache-Control', 'no-store')
  if (retryAfterSeconds) response.headers.set('Retry-After', String(retryAfterSeconds))
  return response
}

export async function POST(request: Request) {
  const requestId = randomUUID()
  try {
    const declaredLength = Number(request.headers.get('content-length') ?? 0)
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return errorResponse(requestId, 413, 'PAYLOAD_TOO_LARGE', 'অনুরোধটি বেশি বড়। অনুগ্রহ করে ছোট করে আবার চেষ্টা করুন।')
    }
    const rawText = await request.text()
    if (new TextEncoder().encode(rawText).byteLength > MAX_BODY_BYTES) {
      return errorResponse(requestId, 413, 'PAYLOAD_TOO_LARGE', 'অনুরোধটি বেশি বড়। অনুগ্রহ করে ছোট করে আবার চেষ্টা করুন।')
    }
    let raw: unknown
    try {
      raw = JSON.parse(rawText)
    } catch {
      return errorResponse(requestId, 400, 'INVALID_REQUEST', 'অনুরোধটি সঠিক JSON নয়। অনুগ্রহ করে আবার চেষ্টা করুন।')
    }
    const parsed = assistantRequestSchema.safeParse(raw)
    if (!parsed.success) return errorResponse(requestId, 400, 'INVALID_REQUEST', 'অনুরোধটি সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।')
    const requestHeaders = await headers()
    const forwardedFor = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
    const ip = forwardedFor || requestHeaders.get('x-real-ip') || 'unknown'
    const limit = await checkAssistantRateLimit({ ip, sessionId: parsed.data.sessionId })
    if (!limit.allowed) {
      const configured = limit.configured ? 'RATE_LIMITED' : 'RATE_LIMIT_NOT_CONFIGURED'
      const message = configured === 'RATE_LIMITED' ? 'অনেকগুলো অনুরোধ পাঠানো হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।' : 'সহকারীটি এখন সাময়িকভাবে ব্যস্ত। কিছুক্ষণ পরে আবার চেষ্টা করুন।'
      return errorResponse(requestId, configured === 'RATE_LIMITED' ? 429 : 503, configured, message, limit.retryAfterSeconds)
    }
    if (process.env.NODE_ENV === 'production' && !isAssistantProviderConfigured()) {
      return errorResponse(requestId, 503, 'UPSTREAM_UNAVAILABLE', 'সহকারীটি এখনো সম্পূর্ণভাবে সক্রিয় নয়। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।')
    }
    const response = await buildAssistantResponse(parsed.data, requestId)
    const result = NextResponse.json(response)
    result.headers.set('Cache-Control', 'no-store')
    return result
  } catch {
    return errorResponse(requestId, 500, 'INTERNAL_ERROR', 'দুঃখিত, সাময়িক সমস্যা হয়েছে। আবার চেষ্টা করুন।')
  }
}
