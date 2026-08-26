import 'server-only'

import { getCart } from './cart'
import { markCheckoutSession, recordCommerceEvent } from '@/lib/analytics/events'
import { assessCustomerRisk, type RiskAssessment } from '@/lib/risk/service'
import { getStorefrontSettings } from '@/lib/services/storefront'

export type CheckoutSource = 'QUICK_ORDER' | 'CART' | 'LANDING_PAGE'
export type CheckoutQuote = { checkoutRequestId: string; source: CheckoutSource; items: Array<{ productId: string; variantId: string; name: string; variantTitle: string; sku: string; quantity: number; unitPrice: number; lineTotal: number; available: boolean }>; subtotal: number; deliveryCharge: number; grandTotal: number; risk: Pick<RiskAssessment, 'level' | 'action'> }

export async function quoteCartCheckout(input: { checkoutRequestId: string; division: string; phone: string; source?: CheckoutSource }): Promise<{ ok: true; data: CheckoutQuote } | { ok: false; message: string }> {
  const requestId = input.checkoutRequestId.trim()
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { ok: false, message: 'Unable to verify this checkout request.' }
  const cart = await getCart()
  if (!cart.items.length) return { ok: false, message: 'Your cart is empty.' }
  const settings = await getStorefrontSettings()
  const items = cart.items.map((item) => ({ productId: item.product_id, variantId: item.variant_id, name: item.product?.name ?? 'Product', variantTitle: item.variant?.variant_title ?? '', sku: item.variant?.sku ?? '', quantity: item.quantity, unitPrice: Number(item.variant?.price ?? 0), lineTotal: Number(item.variant?.price ?? 0) * item.quantity, available: Boolean(item.variant?.is_in_stock) }))
  if (items.some((item) => !item.available)) return { ok: false, message: 'One or more selected options are no longer available.' }
  const deliveryCharge = input.division.trim().toLowerCase() === 'dhaka' ? settings.delivery.dhakaCharge : settings.delivery.outsideDhakaCharge
  const risk = await assessCustomerRisk({ phone: input.phone })
  const data: CheckoutQuote = { checkoutRequestId: requestId, source: input.source ?? 'CART', items, subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0), deliveryCharge, grandTotal: items.reduce((sum, item) => sum + item.lineTotal, 0) + deliveryCharge, risk: { level: risk.level, action: risk.action } }
  await markCheckoutSession({ checkoutRequestId: requestId, source: data.source, cartId: cart.id, status: 'QUOTED', customerPhone: input.phone, quoteSnapshot: { itemCount: cart.itemCount, subtotal: data.subtotal, deliveryCharge: data.deliveryCharge, grandTotal: data.grandTotal } })
  await recordCommerceEvent({ eventId: `${requestId}:quoted`, eventName: 'CHECKOUT_QUOTED', sessionId: requestId, cartId: cart.id, metadata: { source: data.source, itemCount: cart.itemCount, grandTotal: data.grandTotal } })
  return { ok: true, data }
}
