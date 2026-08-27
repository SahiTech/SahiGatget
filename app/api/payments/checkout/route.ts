import { z } from 'zod'
import { NextResponse } from 'next/server'

import { initiatePaymentForOrder } from '@/lib/payments/service'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const inputSchema = z.object({ orderId: z.string().uuid(), checkoutRequestId: z.string().uuid() })

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ ok: false, message: 'The payment request could not be verified.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    const db = createAdminClient()
    const { data: order, error } = await db.from('orders').select('id,checkout_request_id,grand_total,payment_method,payment_status,payment_requirement,customer_name_snapshot,customer_email_snapshot,customer_phone_snapshot').eq('id', parsed.data.orderId).eq('checkout_request_id', parsed.data.checkoutRequestId).maybeSingle()
    if (error || !order) return NextResponse.json({ ok: false, message: 'We could not verify this order for payment.' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
    const paymentRequirement = String(order.payment_requirement)
    if (paymentRequirement === 'COD' || String(order.payment_method).toUpperCase() === 'COD') return NextResponse.json({ ok: false, message: 'Cash on Delivery does not require online payment.' }, { status: 409, headers: { 'Cache-Control': 'private, no-store' } })
    if (paymentRequirement !== 'FULL_ADVANCE' && paymentRequirement !== 'PARTIAL_ADVANCE') return NextResponse.json({ ok: false, message: 'This order requires review before online payment.' }, { status: 409, headers: { 'Cache-Control': 'private, no-store' } })
    if (String(order.payment_status).toLowerCase() === 'paid') return NextResponse.json({ ok: false, message: 'This order has already been paid.' }, { status: 409, headers: { 'Cache-Control': 'private, no-store' } })
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sahigadget.shop'
    const payment = await initiatePaymentForOrder({ orderId: String(order.id), amount: Number(order.grand_total), paymentRequirement, idempotencyKey: `checkout:${order.id}:${order.checkout_request_id}`, customerName: String(order.customer_name_snapshot), customerEmail: order.customer_email_snapshot ? String(order.customer_email_snapshot) : null, customerPhone: order.customer_phone_snapshot ? String(order.customer_phone_snapshot) : null, successUrl: `${siteUrl}/payment/status?orderId=${order.id}&checkoutRequestId=${order.checkout_request_id}`, failUrl: `${siteUrl}/payment/status?orderId=${order.id}&checkoutRequestId=${order.checkout_request_id}&state=failed`, cancelUrl: `${siteUrl}/payment/status?orderId=${order.id}&checkoutRequestId=${order.checkout_request_id}&state=cancelled` })
    return NextResponse.json({ ok: true, data: { paymentId: payment.id, provider: payment.provider, status: payment.status, paymentUrl: payment.paymentUrl, expiresAt: payment.expiresAt } }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const message = error instanceof Error && ['PAYMENT_PROVIDER_NOT_CONFIGURED', 'No enabled online payment provider is configured.', 'No verified payment provider is configured.'].includes(error.message) ? 'Online payment is not available right now. Please choose Cash on Delivery or contact support.' : 'We could not start the secure payment session. Please try again.'
    return NextResponse.json({ ok: false, message }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
