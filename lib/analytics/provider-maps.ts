import type { CommerceEventName } from './types'

export const META_PIXEL_EVENT_MAP: Partial<Record<CommerceEventName, string>> = {
  page_view: 'PageView',
  view_item: 'ViewContent',
  search: 'Search',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  purchase: 'Purchase',
  generate_lead: 'Lead',
  contact: 'Contact',
  sign_up: 'CompleteRegistration',
}

export const TIKTOK_PIXEL_EVENT_MAP: Partial<Record<CommerceEventName, string>> = {
  view_item: 'ViewContent',
  search: 'Search',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  purchase: 'CompletePayment',
  generate_lead: 'SubmitForm',
  contact: 'Contact',
  sign_up: 'CompleteRegistration',
}

export const TIKTOK_EVENTS_API_MAP = TIKTOK_PIXEL_EVENT_MAP
export const GA4_EVENT_NAME_MAP: Partial<Record<CommerceEventName, string>> = {}

export function providerEventName(provider: 'META_PIXEL' | 'TIKTOK_PIXEL' | 'TIKTOK_EVENTS_API' | 'GA4', eventName: CommerceEventName) {
  if (provider === 'META_PIXEL') return META_PIXEL_EVENT_MAP[eventName] ?? eventName
  if (provider === 'TIKTOK_PIXEL' || provider === 'TIKTOK_EVENTS_API') return TIKTOK_PIXEL_EVENT_MAP[eventName]
  return GA4_EVENT_NAME_MAP[eventName] ?? eventName
}
