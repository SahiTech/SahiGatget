import { NextResponse } from 'next/server'
import type { Json } from '@/lib/types/database'
import { normalizeRedxWebhook } from '@/lib/delivery/redx'
import { processNormalizedWebhook } from '@/lib/delivery/webhook-processor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Json
    const headers = new Headers(request.headers)
    headers.set('x-redx-webhook-url', request.url)
    const event = await normalizeRedxWebhook(payload, request.url)
    await processNormalizedWebhook(event)
    return NextResponse.json({ status: 'success', message: 'Webhook received successfully.' }, { status: 200 })
  } catch (error) {
    console.error('REDX webhook processing failed.', error instanceof Error ? error.message : 'Unknown error')
    const message = error instanceof Error ? error.message : 'Webhook processing failed.'
    const status = message.includes('webhook token') ? 401 : 500
    return NextResponse.json({ status: 'error', message: status === 401 ? 'Unauthorized webhook.' : 'Webhook processing failed.' }, { status })
  }
}
