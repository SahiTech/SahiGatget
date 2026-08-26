import { z } from 'zod'
import { NextResponse } from 'next/server'

import { refreshPaymentStatus } from '@/lib/payments/service'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const inputSchema = z.object({ paymentId: z.string().uuid().optional(), orderId: z.string().uuid(), checkoutRequestId: z.string().uuid() })

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ ok: false, message: 'The payment verification request could not be validated.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    const db = createAdminClient()
    const { data: order, error } = await db.from('orders').select('id,grand_total,checkout_request_id').eq('id', parsed.data.orderId).eq('checkout_request_id', parsed.data.checkoutRequestId).maybeSingle()
    if (error || !order) return NextResponse.json({ ok: false, message: 'We could not verify this order for payment status.' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    const paymentId = parsed.data.paymentId ?? (await db.from('payment_transactions').select('id').eq('order_id', parsed.data.orderId).order('created_at', { ascending: false }).limit(1).maybeSingle()).data?.id
    if (!paymentId) return NextResponse.json({ ok: false, message: 'Payment verification is still pending. Please try again shortly.' }, { status: 202, headers: { 'Cache-Control': 'private, no-store' } })
    const payment = await refreshPaymentStatus({ paymentId: String(paymentId), orderId: parsed.data.orderId, expectedAmount: Number(order.grand_total) })
    return NextResponse.json({ ok: true, data: { paymentId: payment.id, status: payment.status, provider: payment.provider, expiresAt: payment.expiresAt } }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ ok: false, message: 'Payment verification is still pending. Please try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
