'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadOrderSuccessById } from '@/lib/orders/actions'
import { normalizePhone } from '@/lib/orders/phone'
import { getCart } from './cart'
import { quoteCartCheckout } from './checkout'
import { assessCustomerRisk } from '@/lib/risk/service'
import { markCheckoutSession, recordCommerceEvent, recordPurchaseOnce } from '@/lib/analytics/events'
import { getPaymentsForOrder, initiatePaymentForOrder, paymentRequirementForRiskAction, PaymentError } from '@/lib/payments/service'

const cartOrderSchema = z.object({
  checkoutRequestId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^(?:\+?88)?01[3-9]\d{8}$/),
  email: z.union([z.literal(''), z.string().trim().email()]).optional(),
  division: z.string().trim().min(2).max(80),
  district: z.string().trim().min(2).max(80),
  area: z.string().trim().min(2).max(100),
  address: z.string().trim().min(8).max(500),
  postalCode: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(500).optional(),
  analyticsConsent: z.boolean().optional().default(false),
  marketingConsent: z.boolean().optional().default(false),
})

export async function saveCartCheckoutDraft(input: unknown) {
  const parsed = cartOrderSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const }
  const cart = await getCart()
  if (!cart.id || !cart.items.length) return { ok: false as const }
  await markCheckoutSession({ checkoutRequestId: parsed.data.checkoutRequestId, source: 'CART', cartId: cart.id, status: 'DETAILS_ENTERED', customerPhone: normalizePhone(parsed.data.phone), customerEmail: parsed.data.email || null, quoteSnapshot: { itemCount: cart.itemCount } })
  return { ok: true as const }
}

export async function quoteCartOrder(input: unknown) {
  const parsed = cartOrderSchema.pick({ checkoutRequestId: true, phone: true, division: true }).safeParse(input)
  if (!parsed.success) return { ok: false as const, message: 'Please enter a valid mobile number and division to calculate your secure quote.' }
  return quoteCartCheckout({ checkoutRequestId: parsed.data.checkoutRequestId, phone: normalizePhone(parsed.data.phone), division: parsed.data.division, source: 'CART' })
}

export async function createCartOrder(input: unknown) {
  const parsed = cartOrderSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, message: 'Please complete the delivery details before placing your order.' }
  const cart = await getCart()
  if (!cart.id || !cart.items.length) return { ok: false as const, message: 'Your cart is empty.' }
  const normalizedPhone = normalizePhone(parsed.data.phone)
  const risk = await assessCustomerRisk({ phone: normalizedPhone })
  const paymentRequirement = paymentRequirementForRiskAction(risk.action)
  if (paymentRequirement === 'MANUAL_REVIEW') return { ok: false as const, message: 'We need to verify a few details before accepting this order. Please contact support for help.' }

  const quote = await quoteCartCheckout({ checkoutRequestId: parsed.data.checkoutRequestId, phone: normalizedPhone, division: parsed.data.division, source: 'CART' })
  if (!quote.ok) return quote
  const db = createAdminClient()
  const rpcName = paymentRequirement === 'COD' ? 'create_guest_cod_cart_order' : 'create_guest_advance_cart_order'
  const { data, error } = await db.rpc(rpcName, {
    p_cart_id: cart.id,
    p_checkout_request_id: parsed.data.checkoutRequestId,
    p_customer_name: parsed.data.fullName,
    p_customer_phone: normalizedPhone,
    p_customer_email: parsed.data.email || '',
    p_division: parsed.data.division,
    p_district: parsed.data.district,
    p_area: parsed.data.area,
    p_address: parsed.data.address,
    p_postal_code: parsed.data.postalCode || '',
    p_notes: parsed.data.notes || '',
  })
  if (error || !data?.[0]) return { ok: false as const, message: 'We could not prepare this order securely. No payment was collected. Please try again.' }
  const row = data[0] as { order_id: string; order_number: string; created_new: boolean }

  if (paymentRequirement !== 'COD') {
    if (!row.created_new) {
      const existing = (await getPaymentsForOrder(row.order_id)).find((payment) => payment.paymentUrl)
      if (existing?.paymentUrl) return { ok: true as const, data: { paymentRequired: true as const, orderId: row.order_id, orderNumber: row.order_number, paymentId: existing.id, redirectUrl: existing.paymentUrl } }
      return { ok: false as const, message: 'This checkout request has already been submitted. Please use your existing payment link or contact support.' }
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sahigadget.shop'
    let payment
    try {
      payment = await initiatePaymentForOrder({
        orderId: row.order_id,
        amount: quote.data.grandTotal,
        paymentRequirement,
        idempotencyKey: `checkout:${row.order_id}:${parsed.data.checkoutRequestId}`,
        customerName: parsed.data.fullName,
        customerEmail: parsed.data.email || null,
        customerPhone: normalizedPhone,
        successUrl: `${siteUrl}/payment/status?orderId=${row.order_id}&checkoutRequestId=${parsed.data.checkoutRequestId}`,
        failUrl: `${siteUrl}/payment/status?orderId=${row.order_id}&checkoutRequestId=${parsed.data.checkoutRequestId}&state=failed`,
        cancelUrl: `${siteUrl}/payment/status?orderId=${row.order_id}&checkoutRequestId=${parsed.data.checkoutRequestId}&state=cancelled`,
      })
    } catch (error) {
      if (error instanceof PaymentError) return { ok: false as const, message: 'Secure online payment is temporarily unavailable. No payment was collected. Please try again or contact support.' }
      return { ok: false as const, message: 'Secure online payment could not be started. No payment was collected. Please try again.' }
    }
    if (!payment.paymentUrl) return { ok: false as const, message: 'Secure online payment could not be started. No payment was collected. Please try again.' }
    await markCheckoutSession({ checkoutRequestId: parsed.data.checkoutRequestId, source: 'CART', cartId: cart.id, status: 'PAYMENT_INITIATED', customerPhone: normalizedPhone, customerEmail: parsed.data.email || null, completedOrderId: null })
    await recordCommerceEvent({ eventId: `${parsed.data.checkoutRequestId}:payment-initiated`, eventName: 'PAYMENT_INITIATED', sessionId: parsed.data.checkoutRequestId, orderId: row.order_id, cartId: cart.id, metadata: { source: 'CART', provider: 'BDGATE' } })
    return { ok: true as const, data: { paymentRequired: true as const, orderId: row.order_id, orderNumber: row.order_number, paymentId: payment.id, redirectUrl: payment.paymentUrl } }
  }

  const summary = await loadOrderSuccessById(row.order_id)
  await markCheckoutSession({ checkoutRequestId: parsed.data.checkoutRequestId, source: 'CART', cartId: cart.id, status: 'COMPLETED', customerPhone: normalizedPhone, customerEmail: parsed.data.email || null, completedOrderId: row.order_id })
  await recordCommerceEvent({ eventId: `${parsed.data.checkoutRequestId}:completed`, eventName: 'ORDER_COMPLETED', sessionId: parsed.data.checkoutRequestId, orderId: row.order_id, cartId: cart.id, metadata: { source: 'CART', createdNew: row.created_new } })
  await recordPurchaseOnce({ orderId: summary.orderId, orderNumber: summary.orderNumber, value: summary.grandTotal, cartId: cart.id, sessionId: parsed.data.checkoutRequestId, consent: { analytics: parsed.data.analyticsConsent, marketing: parsed.data.marketingConsent }, items: summary.items.map((item) => ({ item_id: item.sku, item_name: item.productName, price: item.unitPrice, quantity: item.quantity })) })
  return { ok: true as const, data: summary }
}

export const createCartCodOrder = createCartOrder
