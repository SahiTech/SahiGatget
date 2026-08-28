import crypto from 'node:crypto'

import { NextResponse } from 'next/server'

import type { Json } from '@/lib/types/database'
import { normalizePathaoWebhook } from '@/lib/delivery/pathao-webhook'
import { processNormalizedWebhook } from '@/lib/delivery/webhook-processor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RESPONSE_HEADER = 'X-Pathao-Merchant-Webhook-Integration-Secret'

function safeJson(value: unknown): Json {
  return value as Json
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

export async function POST(request: Request) {
  const configuredSecret = process.env.PATHAO_WEBHOOK_SECRET?.trim()
  if (!configuredSecret) {
    return NextResponse.json({ ok: false, error: 'Webhook is not configured.' }, { status: 503 })
  }

  const receivedSecret = request.headers.get(RESPONSE_HEADER)?.trim() ?? ''
  if (!timingSafeEqual(receivedSecret, configuredSecret)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized webhook.' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON payload.' }, { status: 400 })
  }

  try {
    const event = normalizePathaoWebhook(safeJson(payload), request.headers)
    await processNormalizedWebhook(event)
    return new NextResponse(null, {
      status: 202,
      headers: { [RESPONSE_HEADER]: configuredSecret },
    })
  } catch (error) {
    console.error('Pathao webhook processing failed.', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ ok: false, error: 'Webhook processing failed.' }, { status: 500 })
  }
}
