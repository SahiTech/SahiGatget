import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export const COMMERCE_EVENTS = ['CART_CREATED', 'CART_ITEM_ADDED', 'CART_ITEM_UPDATED', 'CART_ITEM_REMOVED', 'CHECKOUT_STARTED', 'CHECKOUT_QUOTED', 'CHECKOUT_ABANDONED', 'ORDER_COMPLETED', 'PAYMENT_INITIATED', 'PAYMENT_VERIFIED', 'PAYMENT_FAILED', 'RISK_ASSESSED', 'SHIPMENT_CREATED', 'SHIPMENT_TRACKED', 'RETURN_REQUESTED'] as const
export type CommerceEventName = (typeof COMMERCE_EVENTS)[number]

export async function recordCommerceEvent(input: { eventId?: string; eventName: CommerceEventName; sessionId?: string | null; orderId?: string | null; cartId?: string | null; metadata?: Record<string, string | number | boolean | null> }) {
  const db = createAdminClient()
  const { error } = await db.from('commerce_events').insert({ event_id: input.eventId ?? crypto.randomUUID(), event_name: input.eventName, session_id: input.sessionId ?? null, order_id: input.orderId ?? null, cart_id: input.cartId ?? null, metadata: input.metadata ?? {} })
  if (error?.code === '23505') return { ok: true, duplicate: true }
  if (error) return { ok: false, duplicate: false }
  return { ok: true, duplicate: false }
}

export async function markCheckoutSession(input: { checkoutRequestId: string; source: 'QUICK_ORDER' | 'CART' | 'LANDING_PAGE'; cartId?: string | null; status: 'STARTED' | 'DETAILS_ENTERED' | 'QUOTED' | 'PAYMENT_INITIATED' | 'ABANDONED' | 'COMPLETED'; customerPhone?: string | null; customerEmail?: string | null; quoteSnapshot?: Record<string, unknown>; completedOrderId?: string | null }) {
  const db = createAdminClient()
  const payload = { checkout_request_id: input.checkoutRequestId, source: input.source, cart_id: input.cartId ?? null, status: input.status, customer_phone: input.customerPhone ?? null, customer_email: input.customerEmail ?? null, quote_snapshot: input.quoteSnapshot ?? {}, completed_order_id: input.completedOrderId ?? null, last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  const { error } = await db.from('checkout_sessions').upsert(payload, { onConflict: 'checkout_request_id' })
  return { ok: !error }
}
