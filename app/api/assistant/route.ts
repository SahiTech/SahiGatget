import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { randomUUID } from 'node:crypto'

import { assistantRequestSchema } from '@/lib/assistant/contracts'
import { checkAssistantRateLimit } from '@/lib/assistant/rate-limit'
import { buildAssistantResponse, isAssistantProviderConfigured } from '@/lib/assistant/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function errorResponse(requestId: string, status: number, code: string, message: string, retryAfterSeconds?: number) {
  const response = NextResponse.json({ requestId, error: { code, message, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) } }, { status })
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function POST(request: Request) {
  const requestId = randomUUID()
  try {
    const raw = await request.json()
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
