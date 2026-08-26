import 'server-only'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

export const COMMERCE_EVENTS = [
  'CART_CREATED', 'CART_ITEM_ADDED', 'CART_ITEM_UPDATED', 'CART_ITEM_REMOVED', 'CHECKOUT_STARTED', 'CHECKOUT_QUOTED', 'CHECKOUT_ABANDONED', 'ORDER_COMPLETED', 'PAYMENT_INITIATED', 'PAYMENT_VERIFIED', 'PAYMENT_FAILED', 'RISK_ASSESSED', 'SHIPMENT_CREATED', 'SHIPMENT_TRACKED', 'RETURN_REQUESTED',
  'page_view', 'view_item', 'view_item_list', 'search', 'select_item', 'add_to_cart', 'remove_from_cart', 'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase', 'refund', 'checkout_error', 'login', 'sign_up', 'generate_lead', 'contact', 'support_request', 'whatsapp_click', 'cart_created', 'cart_updated', 'cart_abandoned', 'cart_recovered', 'order_created', 'order_confirmed', 'order_cancelled', 'order_status_changed', 'checkout_started', 'checkout_progress', 'checkout_abandoned', 'checkout_recovered',
] as const
export type CommerceEventName = (typeof COMMERCE_EVENTS)[number]

export type CanonicalCommerceEvent = {
  eventId: string
  eventName: CommerceEventName
  eventVersion: '1.0'
  occurredAt: string
  sessionId: string | null
  anonymousId: string | null
  pageUrl: string | null
  pagePath: string | null
  referrer: string | null
  source: string | null
  medium: string | null
  campaign: string | null
  device: { type?: string; language?: string } | null
  consent: { necessary: true; analytics: boolean; marketing: boolean }
  commerce?: Record<string, unknown>
  metadata?: Record<string, string | number | boolean | null>
  testMode?: boolean
}

function scrubMetadata(input: Record<string, unknown> = {}) {
  const denied = /phone|email|address|password|token|secret|authorization|payment|notes?|message|cookie|ip|user.?agent/i
  return Object.fromEntries(Object.entries(input).filter(([key]) => !denied.test(key)).map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 500) : value]).filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value))) as Record<string, string | number | boolean | null>
}

export function sanitizeCommerceEvent(input: CanonicalCommerceEvent): CanonicalCommerceEvent {
  return { ...input, pageUrl: input.pageUrl?.slice(0, 1000) ?? null, pagePath: input.pagePath?.slice(0, 500) ?? null, referrer: input.referrer?.slice(0, 1000) ?? null, source: input.source?.slice(0, 100) ?? null, medium: input.medium?.slice(0, 100) ?? null, campaign: input.campaign?.slice(0, 200) ?? null, metadata: scrubMetadata(input.metadata), commerce: input.commerce ? scrubCommerce(input.commerce) : undefined }
}

function scrubCommerce(input: Record<string, unknown>) {
  const allowed = ['transaction_id', 'value', 'currency', 'tax', 'shipping', 'items', 'item_id', 'item_name', 'item_brand', 'item_category', 'price', 'quantity', 'content_ids', 'contents', 'content_type', 'search_term', 'list_name', 'item_count', 'source', 'status', 'error_category', 'test_mode']
  return Object.fromEntries(Object.entries(input).filter(([key]) => allowed.includes(key)).map(([key, value]) => [key, Array.isArray(value) ? value.slice(0, 50) : value]))
}

export async function recordCommerceEvent(input: { eventId?: string; eventName: CommerceEventName; sessionId?: string | null; orderId?: string | null; cartId?: string | null; metadata?: Record<string, unknown> }) {
  const db = createAdminClient()
  const metadata = scrubMetadata(input.metadata)
  const { error } = await db.from('commerce_events').insert({ event_id: input.eventId ?? crypto.randomUUID(), event_name: input.eventName, session_id: input.sessionId ?? null, order_id: input.orderId ?? null, cart_id: input.cartId ?? null, metadata })
  if (error?.code === '23505') return { ok: true, duplicate: true }
  if (error) return { ok: false, duplicate: false }
  return { ok: true, duplicate: false }
}

export async function recordCanonicalEvent(input: CanonicalCommerceEvent & { orderId?: string | null; cartId?: string | null }) {
  const event = sanitizeCommerceEvent(input)
  return recordCommerceEvent({ eventId: event.eventId, eventName: event.eventName, sessionId: event.sessionId, orderId: input.orderId, cartId: input.cartId, metadata: { event_version: event.eventVersion, occurred_at: event.occurredAt, anonymous_id: event.anonymousId, page_path: event.pagePath, source: event.source, medium: event.medium, campaign: event.campaign, consent_analytics: event.consent.analytics, consent_marketing: event.consent.marketing, test_mode: Boolean(event.testMode), ...event.commerce, ...event.metadata } })
}

export async function recordPurchaseOnce(input: { orderId: string; orderNumber: string; value: number; items: Array<{ item_id: string; item_name: string; item_brand?: string; item_category?: string; price: number; quantity: number }>; sessionId?: string | null; cartId?: string | null; attribution?: Record<string, unknown>; consent?: { analytics: boolean; marketing: boolean } }) {
  try {
    const event: CanonicalCommerceEvent & { orderId: string; cartId?: string | null } = { eventId: `purchase:${input.orderId}`, eventName: 'purchase', eventVersion: '1.0', occurredAt: new Date().toISOString(), sessionId: input.sessionId ?? null, anonymousId: null, pageUrl: null, pagePath: null, referrer: null, source: null, medium: null, campaign: null, device: null, consent: { necessary: true, analytics: input.consent?.analytics ?? false, marketing: input.consent?.marketing ?? false }, commerce: { transaction_id: input.orderNumber, value: input.value, currency: 'BDT', items: input.items, ...input.attribution }, orderId: input.orderId, cartId: input.cartId }
    const persisted = await recordCanonicalEvent(event)
    if (!persisted.ok || persisted.duplicate) return persisted
    const { dispatchAnalyticsEvent } = await import('./server')
    return { ...persisted, ...(await dispatchAnalyticsEvent(event)) }
  } catch {
    return { ok: true, skipped: true, duplicate: false }
  }
}

export async function markCheckoutSession(input: { checkoutRequestId: string; source: 'QUICK_ORDER' | 'CART' | 'LANDING_PAGE'; cartId?: string | null; status: 'STARTED' | 'DETAILS_ENTERED' | 'QUOTED' | 'PAYMENT_INITIATED' | 'ABANDONED' | 'COMPLETED'; customerPhone?: string | null; customerEmail?: string | null; quoteSnapshot?: Record<string, unknown>; completedOrderId?: string | null }) {
  const db = createAdminClient()
  const payload = { checkout_request_id: input.checkoutRequestId, source: input.source, cart_id: input.cartId ?? null, status: input.status, customer_phone: input.customerPhone ?? null, customer_email: input.customerEmail ?? null, quote_snapshot: input.quoteSnapshot ?? {}, completed_order_id: input.completedOrderId ?? null, last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  const { error } = await db.from('checkout_sessions').upsert(payload, { onConflict: 'checkout_request_id' })
  return { ok: !error }
}

export const canonicalCommerceEventSchema = z.object({ eventId: z.string().uuid(), eventName: z.enum(COMMERCE_EVENTS), eventVersion: z.literal('1.0'), occurredAt: z.string(), sessionId: z.string().nullable(), anonymousId: z.string().nullable(), pageUrl: z.string().nullable(), pagePath: z.string().nullable(), referrer: z.string().nullable(), source: z.string().nullable(), medium: z.string().nullable(), campaign: z.string().nullable(), consent: z.object({ necessary: z.literal(true), analytics: z.boolean(), marketing: z.boolean() }), testMode: z.boolean().optional() }).passthrough()
