import { NextResponse } from 'next/server'
import type { Json } from '@/lib/types/database'
import { normalizeSteadfastWebhook } from '@/lib/delivery/steadfast'
import { processNormalizedWebhook } from '@/lib/delivery/webhook-processor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Json
    const event = await normalizeSteadfastWebhook(payload, request.headers)
    await processNormalizedWebhook(event)
    return NextResponse.json({ status: 'success', message: 'Webhook received successfully.' }, { status: 200 })
  } catch (error) {
    console.error('Steadfast webhook processing failed.', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ status: 'error', message: 'Webhook processing failed.' }, { status: 401 })
  }
}
