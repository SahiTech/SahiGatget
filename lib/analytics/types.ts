export const COMMERCE_EVENT_NAMES = [
  'CART_CREATED', 'CART_ITEM_ADDED', 'CART_ITEM_UPDATED', 'CART_ITEM_REMOVED', 'CHECKOUT_STARTED', 'CHECKOUT_QUOTED', 'CHECKOUT_ABANDONED', 'ORDER_COMPLETED', 'PAYMENT_INITIATED', 'PAYMENT_VERIFIED', 'PAYMENT_FAILED', 'RISK_ASSESSED', 'SHIPMENT_CREATED', 'SHIPMENT_TRACKED', 'RETURN_REQUESTED',
  'page_view', 'view_item', 'view_item_list', 'search', 'select_item', 'add_to_cart', 'remove_from_cart', 'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase', 'refund', 'checkout_error', 'login', 'sign_up', 'generate_lead', 'contact', 'support_request', 'whatsapp_click', 'cart_created', 'cart_updated', 'cart_abandoned', 'cart_recovered', 'order_created', 'order_confirmed', 'order_cancelled', 'order_status_changed', 'checkout_started', 'checkout_progress', 'checkout_abandoned', 'checkout_recovered',
] as const

export type CommerceEventName = (typeof COMMERCE_EVENT_NAMES)[number]

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
