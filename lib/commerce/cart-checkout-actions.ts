'use server'

import { z } from 'zod'
import { getCart } from './cart'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/orders/phone'
import { loadOrderSuccessById } from '@/lib/orders/actions'
import { assessCustomerRisk } from '@/lib/risk/service'
import { getPaymentsForOrder, initiatePaymentForOrder, paymentProviderForPaymentRequirement, PaymentError, paymentRequirementForRiskAction, verifyPaymentProvider } from '@/lib/payments/service'
import { markCheckoutSession, recordCommerceEvent, recordPurchaseOnce } from '@/lib/analytics/events'
import { queueOrderConfirmationEmails } from '@/lib/email/service'

const checkoutSchema = z.object({
  checkoutRequestId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^(?:\\+?88)?01[3-9]\\d{8}$/),
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

type CartQuote = {
  itemCount: number
  subtotal: number
  discountTotal: number
  deliveryCharge: number
  grandTotal: number
  deliveryZone: 'dhaka' | 'outside_dhaka'
  items: Array<{ sku: string; name: string; variantTitle: string; price: number; quantity: number }>
}

async function buildCartQuote(division: string): Promise<CartQuote> {
  const cart = await getCart()
  if (!cart.id || !cart.items.length) throw new Error('Your cart is empty.')
  const deliveryZone = division.trim().toLowerCase() === 'dhaka' ? 'dhaka' : 'outside_dhaka'
  const deliveryCharge = Number(deliveryZone === 'dhaka' ? cart.deliveryCharges.dhakaCharge : cart.deliveryCharges.outsideDhakaCharge)
  if (!Number.isFinite(deliveryCharge) || deliveryCharge < 0) throw new Error('Delivery configuration is unavailable.')
  const items = cart.items.map((item) => {
    const price = Number(item.variant?.price ?? 0)
    if (!item.product?.name || !item.variant?.sku || !Number.isFinite(price) || price < 0) throw new Error('A cart item is no longer available.')
    if (!item.variant.is_in_stock) throw new Error(`${item.product.name} is currently out of stock.`)
    return { sku: item.variant.sku, name: item.product.name, variantTitle: item.variant.variant_title || item.variant.sku, price, quantity: item.quantity }
  })
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const discountTotal = 0
  return { itemCount: cart.itemCount, subtotal, discountTotal, deliveryCharge, grandTotal: subtotal + deliveryCharge, deliveryZone, items }
}

export async function quoteCartCheckout(input: { division: string }): Promise<{ ok: true; data: CartQuote } | { ok: false; message: string }> {
  const division = z.string().trim().min(2).max(80).safeParse(input.division)
  if (!division.success) return { ok: false, message: 'Please enter your division.' }
  try {
    return { ok: true, data: await buildCartQuote(division.data) }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unable to calculate the cart total right now.' }
  }
}

export async function saveCartCheckoutDraft(input: unknown): Promise<{ ok: boolean }> {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) return { ok: false }
  try {
    const cart = await getCart()
    if (!cart.id || !cart.items.length) return { ok: false }
    const quote = await buildCartQuote(parsed.data.division)
    const result = await markCheckoutSession({
      checkoutRequestId: parsed.data.checkoutRequestId,
      source: 'CART',
      cartId: cart.id,
      status: 'DETAILS_ENTERED',
      customerPhone: parsed.data.phone,
      customerEmail: parsed.data.email || null,
      quoteSnapshot: {
        source: 'CART',
        item_count: quote.itemCount,
        subtotal: quote.subtotal,
        delivery_charge: quote.deliveryCharge,
        grand_total: quote.grandTotal,
        delivery_zone: quote.deliveryZone,
        items: quote.items.map((item) => ({ sku: item.sku, name: item.name, variant_title: item.variantTitle, quantity: item.quantity, unit_price: item.price })),
      },
    })
    return result
  } catch {
    return { ok: false }
  }
}

export async function createCartOrderWithRisk(input: unknown) {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, message: 'Please complete the delivery details before continuing.' }
  const payload = { ...parsed.data, phone: normalizePhone(parsed.data.phone), email: parsed.data.email || '' }
  try {
    const cart = await getCart()
    if (!cart.id || !cart.items.length) return { ok: false as const, message: 'Your cart is empty.' }
    const quote = await buildCartQuote(payload.division)
    const risk = await assessCustomerRisk({ phone: payload.phone })
    const paymentRequirement = paymentRequirementForRiskAction(risk.action)
    if (paymentRequirement === 'MANUAL_REVIEW') return { ok: false as const, message: 'We need to verify a few details before accepting this order. Please contact support for help.' }

    const db = createAdminClient()
    const rpcName = paymentRequirement === 'COD' ? 'create_guest_cod_cart_order' : 'create_guest_advance_cart_order'
    if (paymentRequirement !== 'COD') {
      const provider = await paymentProviderForPaymentRequirement(paymentRequirement)
      verifyPaymentProvider(provider)
    }
    const { data, error } = await db.rpc(rpcName, {
      p_cart_id: cart.id,
      p_checkout_request_id: parsed.data.checkoutRequestId,
      p_customer_name: parsed.data.fullName,
      p_customer_phone: payload.phone,
      p_customer_email: payload.email,
      p_division: payload.division,
      p_district: payload.district,
      p_area: payload.area,
      p_address: payload.address,
      p_postal_code: parsed.data.postalCode || '',
      p_notes: parsed.data.notes || '',
    })
    if (error || !Array.isArray(data) || !data[0]?.order_id) {
      const message = error?.message ?? 'Unable to create the order.'
      if (message.includes('INSUFFICIENT_STOCK')) return { ok: false as const, message: 'One or more cart items are no longer available in the requested quantity.' }
      if (message.includes('PRODUCT_UNAVAILABLE')) return { ok: false as const, message: 'One or more cart items are no longer available.' }
      return { ok: false as const, message: 'We could not prepare your order securely. No payment was collected. Please try again.' }
    }
    const row = data[0] as { order_id: string; order_number: string; created_new: boolean }

    if (paymentRequirement === 'COD') {
      const summary = await loadOrderSuccessById(row.order_id)
      await markCheckoutSession({ checkoutRequestId: parsed.data.checkoutRequestId, source: 'CART', cartId: cart.id, status: 'COMPLETED', customerPhone: payload.phone, customerEmail: payload.email || null, completedOrderId: row.order_id })
      await recordCommerceEvent({ eventId: `${parsed.data.checkoutRequestId}:completed`, eventName: 'ORDER_COMPLETED', sessionId: parsed.data.checkoutRequestId, orderId: row.order_id, cartId: cart.id, metadata: { source: 'CART', createdNew: row.created_new } })
      await recordPurchaseOnce({ orderId: summary.orderId, orderNumber: summary.orderNumber, value: summary.grandTotal, cartId: cart.id, sessionId: parsed.data.checkoutRequestId, consent: { analytics: parsed.data.analyticsConsent, marketing: parsed.data.marketingConsent }, items: summary.items.map((item) => ({ item_id: item.sku, item_name: item.productName, price: item.unitPrice, quantity: item.quantity })) })
      try { await queueOrderConfirmationEmails(summary) } catch (error) { console.error('[email] cart order confirmation failed', error instanceof Error ? error.message : error) }
      return { ok: true as const, data: summary }
    }

    if (!row.created_new) {
      const existing = (await getPaymentsForOrder(row.order_id)).find((payment) => payment.paymentUrl)
      if (existing?.paymentUrl) return { ok: true as const, data: { paymentRequired: true as const, orderId: row.order_id, orderNumber: row.order_number, paymentId: existing.id, redirectUrl: existing.paymentUrl } }
      return { ok: false as const, message: 'This checkout request has already been submitted. Please use the existing payment link or contact support.' }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sahigadget.shop'
    let payment
    try {
      payment = await initiatePaymentForOrder({
        orderId: row.order_id,
        amount: quote.grandTotal,
        paymentRequirement,
        idempotencyKey: `checkout:${row.order_id}:${parsed.data.checkoutRequestId}`,
        customerName: parsed.data.fullName,
        customerEmail: payload.email || null,
        customerPhone: payload.phone,
        successUrl: `${siteUrl}/payment/status?orderId=${row.order_id}&checkoutRequestId=${parsed.data.checkoutRequestId}`,
        failUrl: `${siteUrl}/payment/status?orderId=${row.order_id}&checkoutRequestId=${parsed.data.checkoutRequestId}&state=failed`,
        cancelUrl: `${siteUrl}/payment/status?orderId=${row.order_id}&checkoutRequestId=${parsed.data.checkoutRequestId}&state=cancelled`,
      })
    } catch (error) {
      if (error instanceof PaymentError) return { ok: false as const, message: 'Secure online payment is temporarily unavailable. No payment was collected. Please try again or contact support.' }
      return { ok: false as const, message: 'Secure online payment could not be started. No payment was collected. Please try again.' }
    }
    if (!payment.paymentUrl) return { ok: false as const, message: 'Secure online payment could not be started. No payment was collected. Please try again.' }
    await markCheckoutSession({ checkoutRequestId: parsed.data.checkoutRequestId, source: 'CART', cartId: cart.id, status: 'PAYMENT_INITIATED', customerPhone: payload.phone, customerEmail: payload.email || null, completedOrderId: null })
    await recordCommerceEvent({ eventId: `${parsed.data.checkoutRequestId}:payment-initiated`, eventName: 'PAYMENT_INITIATED', sessionId: parsed.data.checkoutRequestId, orderId: row.order_id, cartId: cart.id, metadata: { source: 'CART', provider: 'BDGATE' } })
    return { ok: true as const, data: { paymentRequired: true as const, orderId: row.order_id, orderNumber: row.order_number, paymentId: payment.id, redirectUrl: payment.paymentUrl } }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'We could not prepare your order securely. No payment was collected. Please try again.' }
  }
}
