'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadOrderSuccessById } from '@/lib/orders/actions'
import { normalizePhone } from '@/lib/orders/phone'
import { getCart } from './cart'
import { assessCustomerRisk } from '@/lib/risk/service'
import { markCheckoutSession, recordCommerceEvent } from '@/lib/analytics/events'

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
})

export async function createCartCodOrder(input: unknown) {
  const parsed = cartOrderSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Please complete the delivery details before placing your order.' }
  const cart = await getCart()
  if (!cart.id || !cart.items.length) return { ok: false, message: 'Your cart is empty.' }
  const normalizedPhone = normalizePhone(parsed.data.phone)
  const risk = await assessCustomerRisk({ phone: normalizedPhone })
  if (risk.action === 'MANUAL_REVIEW' || risk.action === 'BLOCK') return { ok: false, message: 'This order needs a quick verification before it can be placed. Please contact support.' }
  const db = createAdminClient()
  const { data, error } = await db.rpc('create_guest_cod_cart_order', {
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
  if (error || !data?.[0]) return { ok: false, message: 'We could not place this cart order. No payment was collected. Please try again.' }
  const row = data[0] as { order_id: string; order_number: string; created_new: boolean }
  const summary = await loadOrderSuccessById(row.order_id)
  await markCheckoutSession({ checkoutRequestId: parsed.data.checkoutRequestId, source: 'CART', cartId: cart.id, status: 'COMPLETED', customerPhone: normalizedPhone, customerEmail: parsed.data.email || null, completedOrderId: row.order_id })
  await recordCommerceEvent({ eventId: `${parsed.data.checkoutRequestId}:completed`, eventName: 'ORDER_COMPLETED', sessionId: parsed.data.checkoutRequestId, orderId: row.order_id, cartId: cart.id, metadata: { source: 'CART', createdNew: row.created_new } })
  return { ok: true, data: summary }
}
