import type { CommerceEventName } from './events'

export type AnalyticsEventDefinition = { name: CommerceEventName; category: 'page' | 'catalogue' | 'search' | 'cart' | 'checkout' | 'purchase' | 'lead' | 'support' | 'order' | 'recovery' | 'diagnostic'; required: boolean; marketing: boolean; description: string; providers: string[] }

export const ANALYTICS_EVENT_REGISTRY: AnalyticsEventDefinition[] = [
  { name: 'page_view', category: 'page', required: false, marketing: false, description: 'A public page was viewed.', providers: ['GA4', 'GTM', 'META_PIXEL'] },
  { name: 'view_item', category: 'catalogue', required: false, marketing: false, description: 'A product detail was viewed.', providers: ['GA4', 'GTM', 'META_PIXEL'] },
  { name: 'view_item_list', category: 'catalogue', required: false, marketing: false, description: 'A product list was viewed.', providers: ['GA4', 'GTM'] },
  { name: 'search', category: 'search', required: false, marketing: false, description: 'A catalogue search was submitted.', providers: ['GA4', 'GTM', 'META_PIXEL'] },
  { name: 'add_to_cart', category: 'cart', required: false, marketing: false, description: 'An item was added after server acceptance.', providers: ['GA4', 'GTM', 'META_PIXEL'] },
  { name: 'remove_from_cart', category: 'cart', required: false, marketing: false, description: 'An item was removed from the cart.', providers: ['GA4', 'GTM'] },
  { name: 'view_cart', category: 'cart', required: false, marketing: false, description: 'The cart was viewed.', providers: ['GA4', 'GTM'] },
  { name: 'begin_checkout', category: 'checkout', required: false, marketing: false, description: 'Checkout was initiated.', providers: ['GA4', 'GTM', 'META_PIXEL'] },
  { name: 'add_shipping_info', category: 'checkout', required: false, marketing: false, description: 'Shipping details were added to checkout.', providers: ['GA4', 'GTM'] },
  { name: 'add_payment_info', category: 'checkout', required: false, marketing: false, description: 'Payment method details were added to checkout.', providers: ['GA4', 'GTM'] },
  { name: 'purchase', category: 'purchase', required: true, marketing: false, description: 'A successful order was recorded from authoritative server data.', providers: ['GA4', 'GTM', 'META_PIXEL', 'META_CAPI', 'SERVER_GTM'] },
  { name: 'refund', category: 'purchase', required: false, marketing: false, description: 'A refund lifecycle event was recorded.', providers: ['GA4', 'GTM'] },
  { name: 'generate_lead', category: 'lead', required: false, marketing: true, description: 'A lead form was submitted with consent.', providers: ['GA4', 'GTM', 'META_PIXEL', 'META_CAPI'] },
  { name: 'contact', category: 'support', required: false, marketing: true, description: 'A contact action occurred with consent.', providers: ['GA4', 'GTM', 'META_PIXEL', 'META_CAPI'] },
  { name: 'support_request', category: 'support', required: false, marketing: false, description: 'A support request was initiated.', providers: ['GA4', 'GTM'] },
  { name: 'login', category: 'support', required: false, marketing: false, description: 'A user completed authentication.', providers: ['GA4', 'GTM'] },
  { name: 'sign_up', category: 'support', required: false, marketing: true, description: 'A user completed registration.', providers: ['GA4', 'GTM', 'META_PIXEL', 'META_CAPI'] },
  { name: 'whatsapp_click', category: 'support', required: false, marketing: true, description: 'A WhatsApp support action occurred with marketing consent.', providers: ['GA4', 'GTM', 'META_PIXEL', 'META_CAPI'] },
  { name: 'checkout_abandoned', category: 'recovery', required: false, marketing: false, description: 'An incomplete checkout became eligible for recovery analysis.', providers: ['GA4', 'GTM'] },
  { name: 'checkout_recovered', category: 'recovery', required: false, marketing: false, description: 'An incomplete checkout returned.', providers: ['GA4', 'GTM'] },
  { name: 'RISK_ASSESSED', category: 'diagnostic', required: true, marketing: false, description: 'The existing risk engine assessed an order.', providers: ['GTM'] },
]

export const ANALYTICS_EVENT_MAP = Object.fromEntries(ANALYTICS_EVENT_REGISTRY.map((event) => [event.name, event])) as Record<CommerceEventName, AnalyticsEventDefinition | undefined>
