import { after } from 'next/server'
import { NextResponse } from 'next/server'
import {
  canonicalCommerceEventSchema,
  recordCanonicalEvent,
  sanitizeCommerceEvent,
} from '@/lib/analytics/events'
import { hasAnalyticsOrMarketingConsent, isClientIngestibleEventName, isSameOriginAnalyticsRequest } from '@/lib/analytics/ingestion-policy'
import { dispatchAnalyticsEvent } from '@/lib/analytics/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_EVENT_BYTES = 48 * 1024
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(request: Request) {
  try {
    if (!isSameOriginAnalyticsRequest(
      request.url,
      request.headers.get('origin'),
      request.headers.get('sec-fetch-site'),
    )) {
      return NextResponse.json({ ok: false, message: 'Cross-origin analytics request rejected.' }, { status: 403, headers: NO_STORE })
    }

    const declaredLength = Number(request.headers.get('content-length') || 0)
    if (Number.isFinite(declaredLength) && declaredLength > MAX_EVENT_BYTES) {
      return NextResponse.json({ ok: false, message: 'Analytics event is too large.' }, { status: 413, headers: NO_STORE })
    }

    const raw = await request.text()
    if (new TextEncoder().encode(raw).byteLength > MAX_EVENT_BYTES) {
      return NextResponse.json({ ok: false, message: 'Analytics event is too large.' }, { status: 413, headers: NO_STORE })
    }

    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch {
      return NextResponse.json({ ok: false, message: 'Invalid analytics event JSON.' }, { status: 400, headers: NO_STORE })
    }

    const parsed = canonicalCommerceEventSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: 'Invalid analytics event.' }, { status: 400, headers: NO_STORE })
    }

    // This endpoint is public and accepts browser-generated events only.
    // Order/payment/risk/refund lifecycle events must come from trusted server workflows.
    if (!isClientIngestibleEventName(parsed.data.eventName) || parsed.data.testMode === true) {
      return NextResponse.json({ ok: false, message: 'Event is not accepted from the browser.' }, { status: 400, headers: NO_STORE })
    }

    // Never persist or forward browser analytics without an explicit consent choice.
    if (!hasAnalyticsOrMarketingConsent(parsed.data)) {
      return NextResponse.json({ ok: true, accepted: false, reason: 'consent_required' }, { status: 202, headers: NO_STORE })
    }

    // Use the exact same sanitized payload for persistence and provider dispatch.
    const event = sanitizeCommerceEvent(parsed.data)
    const persisted = await recordCanonicalEvent(event)
    if (!persisted.ok) {
      return NextResponse.json({ ok: false, accepted: false, message: 'Analytics event could not be recorded.' }, { status: 503, headers: NO_STORE })
    }
    if (persisted.duplicate) {
      return NextResponse.json({ ok: true, accepted: true, duplicate: true, delivery: 'already-recorded' }, { headers: NO_STORE })
    }

    after(() => dispatchAnalyticsEvent(event).then((result) => {
      const deliveries = 'deliveries' in result && Array.isArray(result.deliveries) ? result.deliveries : []
      console.log(JSON.stringify({
        level: result.ok ? 'info' : 'warn',
        msg: 'analytics_dispatch_result',
        eventName: event.eventName,
        destinations: deliveries.map((delivery) => ({
          destination: delivery.destination,
          ok: delivery.ok,
          status: delivery.status ?? null,
          category: delivery.category ?? null,
          latency: delivery.latency,
          attempts: delivery.attempts,
        })),
        skipped: result.skipped,
      }))
    }).catch((error) => {
      console.error(JSON.stringify({
        level: 'error',
        msg: 'analytics_dispatch_failed',
        eventName: event.eventName,
        error: error instanceof Error ? error.name : 'UnknownError',
      }))
    }))

    return NextResponse.json(
      { ok: true, accepted: true, duplicate: false, delivery: 'queued' },
      { headers: NO_STORE },
    )
  } catch {
    // Analytics failures must never affect checkout or other commerce behavior.
    return NextResponse.json({ ok: false, accepted: false, message: 'Analytics ingestion failed.' }, { status: 500, headers: NO_STORE })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'analytics', version: '1.2' }, { headers: NO_STORE })
}
