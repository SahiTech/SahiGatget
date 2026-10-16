'use client'

import { providerEventName } from './provider-maps'
import { ANALYTICS_EVENT_MAP } from './registry'
import type { CanonicalCommerceEvent, CommerceEventName } from './types'

export type BrowserAnalyticsRuntimeConfig = {
  enabled: boolean
  marketingEnabled: boolean
  ga4MeasurementId: string
  gtmContainerId: string
  metaPixelId: string
  tiktokPixelId: string
  ga4ServerDeliveryEnabled: boolean
  eventControls: Record<string, boolean>
}

export type BrowserProviderId = 'GTM' | 'GA4' | 'META_PIXEL' | 'TIKTOK_PIXEL'

type BrowserWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; push?: (...args: unknown[]) => void; loaded?: boolean; version?: string; disablePushState?: boolean }
  _fbq?: unknown
  ttq?: { load?: (id: string) => void; page?: () => void; track?: (name: string, properties?: Record<string, unknown>) => void; _i?: Record<string, unknown> }
  __COMMERCE_ANALYTICS_GTM__?: { id: string; status: 'loading' | 'ready' | 'error'; startedAt?: number; readyAt?: number; errorAt?: number }
}

function getWindow() { return window as BrowserWindow }

export function isBrowserAnalyticsEventEnabled(eventName: CommerceEventName, config: BrowserAnalyticsRuntimeConfig) {
  const definition = ANALYTICS_EVENT_MAP[eventName]
  // Unknown/internal lifecycle events must not default to enabled in the browser.
  return Boolean(definition && (definition.required || config.eventControls[eventName] !== false))
}

export function isBrowserProviderEventAllowed(provider: BrowserProviderId, eventName: CommerceEventName) {
  return Boolean(ANALYTICS_EVENT_MAP[eventName]?.providers.includes(provider))
}

function loadScript(src: string, idValue: string) {
  if (document.getElementById(idValue)) return
  const script = document.createElement('script')
  script.id = idValue
  script.async = true
  script.src = src
  document.head.appendChild(script)
}

const initializedMetaPixelIds = new Set<string>()
const initializedTikTokPixelIds = new Set<string>()
let initializedGa4MeasurementId = ''

/** Parse configured Meta pixel IDs once each, preserving their configured order. */
export function getMetaPixelIds(configuredIds: string) {
  return [...new Set(configuredIds.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean))]
}

/**
 * Meta's automatic configuration can emit inferred click events beside our
 * explicit commerce mapping. Disable it before initializing each pixel.
 */
export function buildMetaPixelInitArgs(pixelId: string) {
  return [
    ['set', 'autoConfig', false, pixelId],
    ['init', pixelId],
  ] as const
}

/** Translate canonical/GA4 commerce fields into Meta's expected event schema. */
export function buildMetaPixelEventData(event: CanonicalCommerceEvent) {
  const commerce = event.commerce || {}
  const rawItems = Array.isArray(commerce.items) ? commerce.items : []
  const items = rawItems
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    .map((item) => ({
      id: typeof item.item_id === 'string' ? item.item_id : typeof item.id === 'string' ? item.id : '',
      name: typeof item.item_name === 'string' ? item.item_name : '',
      quantity: typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1,
      price: typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0 ? item.price : null,
    }))
    .filter((item) => Boolean(item.id))

  const configuredIds = Array.isArray(commerce.content_ids)
    ? commerce.content_ids.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())).slice(0, 50)
    : []
  const contentIds = [...new Set(configuredIds.length ? configuredIds : items.map((item) => item.id))].slice(0, 50)
  const data: Record<string, unknown> = {}

  if (typeof commerce.currency === 'string' && /^[A-Za-z]{3}$/.test(commerce.currency.trim())) {
    data.currency = commerce.currency.trim().toUpperCase()
  }
  if (typeof commerce.value === 'number' && Number.isFinite(commerce.value) && commerce.value >= 0) {
    data.value = commerce.value
  }
  if (contentIds.length) {
    data.content_ids = contentIds
    data.content_type = commerce.content_type === 'product_group' ? 'product_group' : 'product'
  }
  if (items.length) {
    data.contents = items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      ...(item.price === null ? {} : { item_price: item.price }),
    }))
    data.num_items = items.reduce((total, item) => total + item.quantity, 0)
    const names = [...new Set(items.map((item) => item.name).filter(Boolean))]
    if (names.length) data.content_name = names.join(', ').slice(0, 500)
  }

  // Never send obvious personal contact details as search terms.
  if (event.eventName === 'search' && typeof commerce.search_term === 'string') {
    const term = commerce.search_term.trim().slice(0, 200)
    const containsEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(term)
    const containsBangladeshPhone = /(?:\+?88)?01[3-9]\d{8}/.test(term)
    if (term && !containsEmail && !containsBangladeshPhone) data.search_string = term
  }

  return data
}

/**
 * Meta's trackSingle targets exactly one pixel. eventID belongs in the options
 * argument, not in event data, so it can be matched to a future CAPI event_id.
 */
export function buildMetaPixelTrackSingleArgs(pixelId: string, metaEvent: string, event: CanonicalCommerceEvent) {
  return [
    'trackSingle',
    pixelId,
    metaEvent,
    buildMetaPixelEventData(event),
    { eventID: event.eventId },
  ] as const
}

type BrowserProviderAdapter = {
  id: BrowserProviderId
  canDispatch: (event: CanonicalCommerceEvent, config: BrowserAnalyticsRuntimeConfig) => boolean
  initialize?: (config: BrowserAnalyticsRuntimeConfig) => void
  dispatch: (event: CanonicalCommerceEvent, config: BrowserAnalyticsRuntimeConfig) => void
}

const gtmAdapter: BrowserProviderAdapter = {
  id: 'GTM',
  canDispatch: (event, config) => Boolean(isBrowserAnalyticsEventEnabled(event.eventName, config) && isBrowserProviderEventAllowed('GTM', event.eventName) && config.enabled && config.gtmContainerId && event.consent.marketing && !event.testMode),
  initialize: (config) => {
    if (typeof window === 'undefined' || !config.enabled || !config.gtmContainerId) return
    const w = getWindow()
    w.dataLayer = w.dataLayer || []
    const existing = w.__COMMERCE_ANALYTICS_GTM__
    if (existing?.id === config.gtmContainerId && (existing.status === 'loading' || existing.status === 'ready')) return
    const scriptId = 'commerce-analytics-gtm'
    if (document.getElementById(scriptId)) {
      if (!w.__COMMERCE_ANALYTICS_GTM__) w.__COMMERCE_ANALYTICS_GTM__ = { id: config.gtmContainerId, status: 'loading', startedAt: Date.now() }
      return
    }
    const script = document.createElement('script')
    script.id = scriptId
    script.async = true
    script.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(config.gtmContainerId)
    w.__COMMERCE_ANALYTICS_GTM__ = { id: config.gtmContainerId, status: 'loading', startedAt: Date.now() }
    script.onload = () => {
      if (w.__COMMERCE_ANALYTICS_GTM__) {
        w.__COMMERCE_ANALYTICS_GTM__.status = 'ready'
        w.__COMMERCE_ANALYTICS_GTM__.readyAt = Date.now()
      }
      window.dispatchEvent(new CustomEvent('commerce-analytics-gtm-ready'))
    }
    script.onerror = () => {
      if (w.__COMMERCE_ANALYTICS_GTM__) {
        w.__COMMERCE_ANALYTICS_GTM__.status = 'error'
        w.__COMMERCE_ANALYTICS_GTM__.errorAt = Date.now()
      }
      window.dispatchEvent(new CustomEvent('commerce-analytics-gtm-error'))
    }
    document.head.appendChild(script)
  },
  dispatch: (event, config) => {
    const w = getWindow()
    const active = Boolean(w.__COMMERCE_ANALYTICS_GTM__ || document.getElementById('commerce-analytics-gtm') || w.dataLayer)
    if (!active) return
    gtmAdapter.initialize?.(config)
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ ecommerce: null })
    w.dataLayer.push({ event: event.eventName, event_id: event.eventId, event_version: event.eventVersion, ecommerce: event.commerce, attribution: { source: event.source, medium: event.medium, campaign: event.campaign }, test_mode: Boolean(event.testMode) })
  },
}

const ga4Adapter: BrowserProviderAdapter = {
  id: 'GA4',
  canDispatch: (event, config) => Boolean(isBrowserAnalyticsEventEnabled(event.eventName, config) && isBrowserProviderEventAllowed('GA4', event.eventName) && config.enabled && config.ga4MeasurementId && !config.ga4ServerDeliveryEnabled && !config.gtmContainerId && event.consent.analytics && !event.testMode),
  dispatch: (event, config) => {
    const idValue = config.ga4MeasurementId
    if (!idValue) return
    const w = getWindow()
    w.gtag = w.gtag || function (...args: unknown[]) {
      w.dataLayer = w.dataLayer || []
      w.dataLayer.push(args)
    }
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(idValue), 'commerce-analytics-ga4')
    const gtag = w.gtag
    if (!gtag) return
    if (initializedGa4MeasurementId !== idValue) {
      gtag('js', new Date())
      gtag('config', idValue, { send_page_view: false })
      initializedGa4MeasurementId = idValue
    }
    gtag('event', event.eventName, { ...event.commerce, event_id: event.eventId })
  },
}

const metaPixelAdapter: BrowserProviderAdapter = {
  id: 'META_PIXEL',
  canDispatch: (event, config) => Boolean(isBrowserAnalyticsEventEnabled(event.eventName, config) && isBrowserProviderEventAllowed('META_PIXEL', event.eventName) && config.enabled && config.marketingEnabled && config.metaPixelId && event.consent.marketing && !event.testMode),
  dispatch: (event, config) => {
    const w = getWindow()
    const pixelIds = getMetaPixelIds(config.metaPixelId)
    if (!pixelIds.length) return
    if (!w.fbq) {
      const fbq = function (this: unknown, ...args: unknown[]) {
        if (fbq.callMethod) fbq.callMethod.apply(this, args)
        else fbq.queue?.push(args)
      } as ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; push?: (...args: unknown[]) => void; loaded?: boolean; version?: string }
      fbq.push = fbq
      fbq.loaded = true
      fbq.version = '2.0'
      fbq.queue = []
      w.fbq = fbq
      w._fbq = fbq
    }
    loadScript('https://connect.facebook.net/en_US/fbevents.js', 'commerce-analytics-meta-pixel')
    const fbq = w.fbq
    if (!fbq) return
    const metaEvent = providerEventName('META_PIXEL', event.eventName)

    // The app owns route PageViews; don't also infer PageViews from pushState.
    // This property is supported by Meta's own GTM Pixel template.
    fbq.disablePushState = true

    // Initialize each configured pixel exactly once, disabling inferred click
    // events before init so only the consented canonical events are emitted.
    for (const pixelId of pixelIds) {
      if (!initializedMetaPixelIds.has(pixelId)) {
        for (const command of buildMetaPixelInitArgs(pixelId)) fbq(...command)
        initializedMetaPixelIds.add(pixelId)
      }
    }

    if (metaEvent) {
      for (const pixelId of pixelIds) {
        fbq(...buildMetaPixelTrackSingleArgs(pixelId, metaEvent, event))
      }
    }
  },
}

const tiktokPixelAdapter: BrowserProviderAdapter = {
  id: 'TIKTOK_PIXEL',
  canDispatch: (event, config) => Boolean(isBrowserAnalyticsEventEnabled(event.eventName, config) && isBrowserProviderEventAllowed('TIKTOK_PIXEL', event.eventName) && config.enabled && config.marketingEnabled && config.tiktokPixelId && event.consent.marketing && !event.testMode),
  dispatch: (event, config) => {
    const pixelId = config.tiktokPixelId
    if (!pixelId) return
    const w = getWindow()
    if (!w.ttq) {
      const queue: unknown[] = []
      w.ttq = {
        load: (id: string) => queue.push(['load', id]),
        page: () => queue.push(['page']),
        track: (name: string, properties?: Record<string, unknown>) => queue.push(['track', name, properties || {}]),
        _i: {},
      }
    }
    loadScript('https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=' + encodeURIComponent(pixelId), 'commerce-analytics-tiktok-pixel')
    const ttq = w.ttq
    if (!ttq) return
    if (!initializedTikTokPixelIds.has(pixelId)) {
      ttq.load?.(pixelId)
      initializedTikTokPixelIds.add(pixelId)
    }
    if (event.eventName === 'page_view') ttq.page?.()
    else {
      const tiktokEvent = providerEventName('TIKTOK_PIXEL', event.eventName)
      if (tiktokEvent) ttq.track?.(tiktokEvent, { ...event.commerce, event_id: event.eventId })
    }
  },
}

export const BROWSER_ANALYTICS_PROVIDER_ADAPTERS: Record<BrowserProviderId, BrowserProviderAdapter> = {
  GTM: gtmAdapter,
  GA4: ga4Adapter,
  META_PIXEL: metaPixelAdapter,
  TIKTOK_PIXEL: tiktokPixelAdapter,
}

export function initializeBrowserAnalyticsProviders(config: BrowserAnalyticsRuntimeConfig) {
  if (typeof window === 'undefined') return
  for (const adapter of Object.values(BROWSER_ANALYTICS_PROVIDER_ADAPTERS)) adapter.initialize?.(config)
}

export function dispatchBrowserAnalyticsEvent(event: CanonicalCommerceEvent, config: BrowserAnalyticsRuntimeConfig) {
  if (typeof window === 'undefined') return
  for (const adapter of Object.values(BROWSER_ANALYTICS_PROVIDER_ADAPTERS)) {
    if (adapter.canDispatch(event, config)) adapter.dispatch(event, config)
  }
}

/**
 * Dispatch an authoritative purchase only to Meta Pixel. This deliberately
 * avoids pushing the event through GTM/GA4, where it could double-count the
 * server-recorded GA4 purchase.
 */
export function dispatchBrowserMetaPixelEvent(event: CanonicalCommerceEvent, config: BrowserAnalyticsRuntimeConfig) {
  if (typeof window === 'undefined') return false
  const adapter = BROWSER_ANALYTICS_PROVIDER_ADAPTERS.META_PIXEL
  if (!adapter.canDispatch(event, config)) return false
  adapter.dispatch(event, config)
  return true
}
