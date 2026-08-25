import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { randomUUID } from 'node:crypto'

import { assistantRequestSchema } from '@/lib/assistant/contracts'
import { checkAssistantRateLimit } from '@/lib/assistant/rate-limit'
import { buildAssistantResponse, isAssistantProviderConfigured } from '@/lib/assistant/service'
import { loadAssistantControlConfig } from '@/lib/assistant/config'
import { recordAssistantAnalytics } from '@/lib/assistant/analytics'
import { classifyIntent } from '@/lib/assistant/retrieval'

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
    const assistantConfig = await loadAssistantControlConfig()
    if (!assistantConfig.enabled) return errorResponse(requestId, 503, 'ASSISTANT_DISABLED', 'সহকারীটি বর্তমানে বন্ধ আছে।')
    if (assistantConfig.maintenanceMode) return errorResponse(requestId, 503, 'ASSISTANT_MAINTENANCE', assistantConfig.maintenanceMessage || 'সহকারীটি বর্তমানে সাময়িকভাবে বন্ধ আছে।')
    const requestStartedAt = Date.now()
    const requestHeaders = await headers()
    const forwardedFor = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
    const ip = forwardedFor || requestHeaders.get('x-real-ip') || 'unknown'
    const limit = await checkAssistantRateLimit({ ip, sessionId: parsed.data.sessionId }, { maxRequestsPerWindow: assistantConfig.maxRequestsPerWindow, rateLimitWindowSeconds: assistantConfig.rateLimitWindowSeconds, dailyRequestBudget: assistantConfig.dailyRequestBudget })
    if (!limit.allowed) {
      const configured = limit.configured ? 'RATE_LIMITED' : 'RATE_LIMIT_NOT_CONFIGURED'
      void recordAssistantAnalytics(configured === 'RATE_LIMITED' ? 'ASSISTANT_RATE_LIMITED' : 'ASSISTANT_ERROR', { reason: configured, latencyMs: Date.now() - requestStartedAt })
      const message = configured === 'RATE_LIMITED' ? 'অনেকগুলো অনুরোধ পাঠানো হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।' : 'সহকারীটি এখন সাময়িকভাবে ব্যস্ত। কিছুক্ষণ পরে আবার চেষ্টা করুন।'
      return errorResponse(requestId, configured === 'RATE_LIMITED' ? 429 : 503, configured, message, limit.retryAfterSeconds)
    }
    if (process.env.NODE_ENV === 'production' && !(await isAssistantProviderConfigured())) {
      void recordAssistantAnalytics('ASSISTANT_ERROR', { reason: 'provider_not_configured', latencyMs: Date.now() - requestStartedAt })
      return errorResponse(requestId, 503, 'UPSTREAM_UNAVAILABLE', 'সহকারীটি এখনো সম্পূর্ণভাবে সক্রিয় নয়। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।')
    }
    const response = await buildAssistantResponse(parsed.data, requestId)
    void recordAssistantAnalytics('ASSISTANT_REQUEST', { intent: response.intent, evidenceStatus: response.evidence.status, productCount: response.products.length, latencyMs: Date.now() - requestStartedAt })
    if (response.evidence.status === 'no_evidence') void recordAssistantAnalytics('ASSISTANT_UNANSWERED', { pattern: `intent:${classifyIntent(parsed.data.message)}`, intent: response.intent })
    const result = NextResponse.json(response)
    result.headers.set('Cache-Control', 'no-store')
    return result
  } catch {
    void recordAssistantAnalytics('ASSISTANT_ERROR', { reason: 'internal_error' })
    return errorResponse(requestId, 500, 'INTERNAL_ERROR', 'দুঃখিত, সাময়িক সমস্যা হয়েছে। আবার চেষ্টা করুন।')
  }
}
