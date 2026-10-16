import 'server-only'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAnalyticsPersistenceAdapter } from './persistence'
import { COMMERCE_EVENT_NAMES as COMMERCE_EVENTS, type CanonicalCommerceEvent, type CommerceEventName } from './types'

export { COMMERCE_EVENT_NAMES as COMMERCE_EVENTS } from './types'
export type { CanonicalCommerceEvent, CommerceEventName } from './types'

const EMAIL_VALUE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const BANGLADESH_PHONE_PATTERN = /(?:\+?88)?01[3-9]\d{8}/

function scrubSensitiveAnalyticsText(value: string, maxLength = 500) {
  const sanitized = value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength)
  // Do not send obvious customer contact details embedded in otherwise allowed
  // analytics fields such as search terms, UTM values, or product labels.
  if (EMAIL_VALUE_PATTERN.test(sanitized) || BANGLADESH_PHONE_PATTERN.test(sanitized)) return '[redacted]'
  return sanitized
}

function sanitizeAnalyticsPath(value: string | null | undefined) {
  if (!value) return null
  const path = value.split(/[?#]/, 1)[0].slice(0, 500)
  // Order verification URLs contain a private token in the path segment.
  return path.replace(/(^|\/)verify-order\/[^/]+/i, '$1verify-order/[redacted]')
}

function scrubMetadata(input: Record<string, unknown> = {}) {
  const denied = /phone|email|address|password|token|secret|authorization|payment|notes?|message|cookie|ip|user.?agent/i
  return Object.fromEntries(Object.entries(input).filter(([key]) => !denied.test(key)).map(([key, value]) => [key, typeof value === 'string' ? scrubSensitiveAnalyticsText(value) : value]).filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value))) as Record<string, string | number | boolean | null>
}

function sanitizeUrl(value: string | null | undefined, maxLength: number) {
  if (!value) return null
  try {
    const url = new URL(value)
    url.search = ''
    url.hash = ''
    url.pathname = sanitizeAnalyticsPath(url.pathname) || '/'
    return url.toString().slice(0, maxLength)
  } catch {
    return sanitizeAnalyticsPath(value)
  }
}

const COMMERCE_ALLOWED_KEYS = new Set([
  'transaction_id', 'value', 'currency', 'tax', 'shipping', 'items',
  'item_id', 'item_name', 'item_brand', 'item_category', 'price', 'quantity',
  'content_ids', 'contents', 'content_type', 'search_term', 'list_name',
  'item_count', 'source', 'status', 'error_category', 'test_mode',
])

const ITEM_ALLOWED_KEYS = new Set([
  'item_id', 'item_name', 'item_brand', 'item_category', 'price', 'quantity',
  'item_list_name', 'item_variant', 'item_category2', 'item_category3',
  'item_category4', 'item_category5', 'index', 'discount', 'coupon',
])

const CONTENT_ALLOWED_KEYS = new Set(['id', 'quantity', 'item_price', 'price'])

function scalar(value: unknown) {
  return value === null || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean'
}

function scrubRecordArray(value: unknown, allowed: Set<string>) {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 50)
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => allowed.has(key) && scalar(item[key])).map(([key, itemValue]) => [key, typeof itemValue === 'string' ? scrubSensitiveAnalyticsText(itemValue, 200) : itemValue])))
}

export function sanitizeCommerceEvent(input: CanonicalCommerceEvent): CanonicalCommerceEvent {
  return {
    ...input,
    pageUrl: sanitizeUrl(input.pageUrl, 1000),
    pagePath: sanitizeAnalyticsPath(input.pagePath),
    referrer: sanitizeUrl(input.referrer, 1000),
    source: input.source ? scrubSensitiveAnalyticsText(input.source, 100) : null,
    medium: input.medium ? scrubSensitiveAnalyticsText(input.medium, 100) : null,
    campaign: input.campaign ? scrubSensitiveAnalyticsText(input.campaign, 200) : null,
    metadata: scrubMetadata(input.metadata),
    commerce: input.commerce ? scrubCommerce(input.commerce) : undefined,
  }
}

function scrubCommerce(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => COMMERCE_ALLOWED_KEYS.has(key))
      .map(([key, value]) => {
        if (key === 'items') return [key, scrubRecordArray(value, ITEM_ALLOWED_KEYS)]
        if (key === 'contents') return [key, scrubRecordArray(value, CONTENT_ALLOWED_KEYS)]
        if (key === 'content_ids' && Array.isArray(value)) return [key, value.slice(0, 50).filter((item) => typeof item === 'string').map((item) => scrubSensitiveAnalyticsText(item, 200))]
        if (scalar(value)) return [key, typeof value === 'string' ? scrubSensitiveAnalyticsText(value, 500) : value]
        return [key, undefined]
      })
      .filter(([, value]) => value !== undefined),
  )
}

export async function recordCommerceEvent(input: { eventId?: string; eventName: CommerceEventName; sessionId?: string | null; orderId?: string | null; cartId?: string | null; metadata?: Record<string, unknown> }) {
  const eventId = input.eventId ?? crypto.randomUUID()
  const metadata = scrubMetadata(input.metadata)
  return getAnalyticsPersistenceAdapter().recordEvent({
    eventId,
    eventName: input.eventName,
    sessionId: input.sessionId,
    orderId: input.orderId,
    cartId: input.cartId,
    metadata,
  })
}

export async function recordCanonicalEvent(input: CanonicalCommerceEvent & { orderId?: string | null; cartId?: string | null }) {
  const event = sanitizeCommerceEvent(input)
  return recordCommerceEvent({ eventId: event.eventId, eventName: event.eventName, sessionId: event.sessionId, orderId: input.orderId, cartId: input.cartId, metadata: { event_version: event.eventVersion, occurred_at: event.occurredAt, anonymous_id: event.anonymousId, page_path: event.pagePath, source: event.source, medium: event.medium, campaign: event.campaign, consent_analytics: event.consent.analytics, consent_marketing: event.consent.marketing, test_mode: Boolean(event.testMode), ...event.commerce, ...event.metadata } })
}

export async function recordPurchaseOnce(input: { orderId: string; orderNumber: string; value: number; items: Array<{ item_id: string; item_name: string; item_brand?: string; item_category?: string; price: number; quantity: number }>; sessionId?: string | null; cartId?: string | null; attribution?: Record<string, unknown>; consent?: { analytics: boolean; marketing: boolean } }) {
  try {
    const itemValue = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const { getAnalyticsConfig } = await import('./server')
    const analyticsConfig = await getAnalyticsConfig()
    const shipping = Math.max(input.value - itemValue, 0)
    const event: CanonicalCommerceEvent & { orderId: string; cartId?: string | null } = { eventId: `purchase:${input.orderId}`, eventName: 'purchase', eventVersion: '1.0', occurredAt: new Date().toISOString(), sessionId: input.sessionId ?? null, anonymousId: null, pageUrl: null, pagePath: null, referrer: null, source: null, medium: null, campaign: null, device: null, consent: { necessary: true, analytics: input.consent?.analytics ?? false, marketing: input.consent?.marketing ?? false }, commerce: { transaction_id: input.orderNumber, value: input.value, shipping, currency: analyticsConfig.currency, items: input.items, ...input.attribution }, orderId: input.orderId, cartId: input.cartId }
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

const analyticsRecordSchema = z.record(z.string(), z.unknown())

export const canonicalCommerceEventSchema = z.object({
  eventId: z.string().uuid(),
  eventName: z.enum(COMMERCE_EVENTS),
  eventVersion: z.literal('1.0'),
  occurredAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), 'Invalid event timestamp.'),
  sessionId: z.string().uuid().nullable(),
  anonymousId: z.string().uuid().nullable(),
  pageUrl: z.string().max(1000).nullable(),
  pagePath: z.string().max(500).nullable(),
  referrer: z.string().max(1000).nullable(),
  source: z.string().max(100).nullable(),
  medium: z.string().max(100).nullable(),
  campaign: z.string().max(200).nullable(),
  device: z.object({ type: z.string().max(32).optional(), language: z.string().max(32).optional() }).nullable(),
  consent: z.object({ necessary: z.literal(true), analytics: z.boolean(), marketing: z.boolean() }),
  commerce: analyticsRecordSchema.optional(),
  metadata: z.record(z.string(), z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()])).optional(),
  testMode: z.boolean().optional(),
}).strict()
