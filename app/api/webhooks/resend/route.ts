import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'

import { getNotificationByProviderMessageId, updateNotificationDelivery } from '@/lib/email/service'

export const runtime = 'nodejs'

function verifySignature(payload: string, headers: Headers, secret: string) {
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signature = headers.get('svix-signature')
  if (!id || !timestamp || !signature) return false
  const timestampNumber = Number(timestamp)
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signedContent = `${id}.${timestamp}.${payload}`
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest('base64')
  return signature.split(' ').some((candidate) => {
    const value = candidate.startsWith('v1,') ? candidate.slice(3) : candidate
    const left = Buffer.from(value)
    const right = Buffer.from(expected)
    return left.length === right.length && timingSafeEqual(left, right)
  })
}

function statusForEvent(type: string) {
  if (type === 'email.sent') return 'SENT' as const
  if (type === 'email.delivered') return 'DELIVERED' as const
  if (type === 'email.failed') return 'FAILED' as const
  if (type === 'email.bounced') return 'BOUNCED' as const
  return null
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!secret) return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 404 })
  const payload = await request.text()
  if (!verifySignature(payload, request.headers, secret)) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 })

  try {
    const event = JSON.parse(payload) as { type?: string; data?: { email_id?: string; id?: string } }
    const status = statusForEvent(event.type ?? '')
    const providerMessageId = event.data?.email_id ?? event.data?.id
    if (!status || !providerMessageId) return NextResponse.json({ ok: true, ignored: true })
    const notification = await getNotificationByProviderMessageId(providerMessageId)
    if (!notification) return NextResponse.json({ ok: true, ignored: true })
    await updateNotificationDelivery(notification.id, status)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[email] webhook processing failed', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }
}
