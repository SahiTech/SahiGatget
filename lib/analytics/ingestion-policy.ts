import type { CanonicalCommerceEvent, CommerceEventName } from './types'

/**
 * Event names that may originate in a public browser request.
 *
 * Order, payment, risk, shipment, refund and purchase lifecycle events must
 * only be emitted by their authoritative server-side workflow.
 */
const CLIENT_INGESTIBLE_EVENT_NAMES: ReadonlySet<string> = new Set([
  'page_view',
  'view_item',
  'view_item_list',
  'select_item',
  'search',
  'add_to_cart',
  'remove_from_cart',
  'view_cart',
  'begin_checkout',
  'add_shipping_info',
  'add_payment_info',
  'generate_lead',
  'contact',
  'support_request',
  'login',
  'sign_up',
  'whatsapp_click',
])

export function isClientIngestibleEventName(eventName: string): eventName is CommerceEventName {
  return CLIENT_INGESTIBLE_EVENT_NAMES.has(eventName)
}

export function hasAnalyticsOrMarketingConsent(event: Pick<CanonicalCommerceEvent, 'consent'>) {
  return event.consent.analytics || event.consent.marketing
}

/**
 * Public browser ingestion should not be usable as a cross-origin write target.
 * This is defense-in-depth (not authentication; non-browser clients can forge headers).
 */
export function isSameOriginAnalyticsRequest(requestUrl: string, origin: string | null, fetchSite: string | null) {
  if (origin) {
    if (origin === 'null') return false
    try {
      return new URL(origin).origin === new URL(requestUrl).origin
    } catch {
      return false
    }
  }

  // Browser requests normally include Origin on POST. If absent, accept only
  // an explicit same-origin Fetch Metadata signal; fail closed otherwise.
  return fetchSite?.toLowerCase() === 'same-origin'
}
