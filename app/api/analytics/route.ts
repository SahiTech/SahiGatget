import { NextResponse } from 'next/server'
import { canonicalCommerceEventSchema, recordCanonicalEvent } from '@/lib/analytics/events'
import { dispatchAnalyticsEvent } from '@/lib/analytics/server'

export async function POST(request: Request) { try { const body = await request.json(); const parsed = canonicalCommerceEventSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ ok: false, message: 'Invalid analytics event.' }, { status: 400 }); const event = parsed.data as Parameters<typeof recordCanonicalEvent>[0]; const persisted = await recordCanonicalEvent(event); if (!persisted.ok) return NextResponse.json({ ok: true, accepted: false }); const delivery = await dispatchAnalyticsEvent(event); return NextResponse.json({ ok: true, accepted: true, duplicate: persisted.duplicate, delivery: delivery.ok ? 'ok' : 'best_effort' }) } catch { return NextResponse.json({ ok: true, accepted: false }) } }
export async function GET() { return NextResponse.json({ ok: true, service: 'analytics', version: '1.0' }) }
