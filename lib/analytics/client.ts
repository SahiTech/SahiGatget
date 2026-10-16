'use client'

import type { CanonicalCommerceEvent, CommerceEventName } from './types'
import { dispatchBrowserAnalyticsEvent, dispatchBrowserMetaPixelEvent, initializeBrowserAnalyticsProviders } from './browser-registry'
import { DEFAULT_ANALYTICS_PROJECT_CONFIG, normalizeAnalyticsCurrency, normalizeAnalyticsProjectKey } from './project-config'

type Consent = { necessary: true; analytics: boolean; marketing: boolean }
type ClientEventInput = { eventName: CommerceEventName; commerce?: Record<string, unknown>; metadata?: Record<string, unknown>; eventId?: string; testMode?: boolean }

const CONSENT_KEY = 'commerce-analytics-consent-v1'
const ATTRIBUTION_KEY = 'commerce-analytics-attribution-v1'
const ANON_KEY = 'commerce-analytics-anonymous-id-v1'
const SESSION_KEY = 'commerce-analytics-session-id-v1'
const LEGACY_CONSENT_KEY = 'sahigadget-analytics-consent'
const LEGACY_ATTRIBUTION_KEY = 'sahigadget-attribution'
const LEGACY_ANON_KEY = 'sahigadget-anonymous-id'
const LEGACY_SESSION_KEY = 'sahigadget-session-id'
let runtimeConfig = { ...DEFAULT_ANALYTICS_PROJECT_CONFIG, enabled: false, marketingEnabled: false, ga4MeasurementId: '', gtmContainerId: '', metaPixelId: '', tiktokPixelId: '', ga4ServerDeliveryEnabled: false, eventControls: {} as Record<string, boolean> }
let analyticsRuntimeConfigured = false
const pendingBrowserEvents = new Map<string, CanonicalCommerceEvent>()
const pendingMetaPixelPurchases = new Map<string, CanonicalCommerceEvent>()
const META_PURCHASE_SENT_PREFIX = 'sahigadget-meta-purchase-sent-v1:'
function migratedLocalStorage(key: string, legacyKey: string) { const existing = window.localStorage.getItem(key); if (existing !== null) return existing; const legacy = window.localStorage.getItem(legacyKey); if (legacy !== null) { window.localStorage.setItem(key, legacy); return legacy }; return null }
function migratedSessionStorage(key: string, legacyKey: string) { const existing = window.sessionStorage.getItem(key); if (existing !== null) return existing; const legacy = window.sessionStorage.getItem(legacyKey); if (legacy !== null) { window.sessionStorage.setItem(key, legacy); return legacy }; return null }
function id(key: string, legacyKey?: string) { const existing = legacyKey ? migratedLocalStorage(key, legacyKey) : window.localStorage.getItem(key); if (existing) return existing; const value = crypto.randomUUID(); window.localStorage.setItem(key, value); return value }
function sessionId() { const existing = migratedSessionStorage(SESSION_KEY, LEGACY_SESSION_KEY); if (existing) return existing; const value = crypto.randomUUID(); window.sessionStorage.setItem(SESSION_KEY, value); return value }
function consent(): Consent { try { const value = JSON.parse(migratedLocalStorage(CONSENT_KEY, LEGACY_CONSENT_KEY) || 'null') as Partial<Consent> | string | null; if (value && typeof value === 'object') return { necessary: true, analytics: Boolean(value.analytics), marketing: Boolean(value.marketing) }; return { necessary: true, analytics: value === 'granted', marketing: false } } catch { return { necessary: true, analytics: false, marketing: false } } }
function attribution() { const url = new URL(window.location.href); const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'ttclid']; const current = Object.fromEntries(keys.map((key) => [key, url.searchParams.get(key)]).filter(([, value]) => value)); const prior = JSON.parse(migratedSessionStorage(ATTRIBUTION_KEY, LEGACY_ATTRIBUTION_KEY) || '{}') as Record<string, string>; const merged = { ...current, ...prior }; if (Object.keys(current).length) window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({ ...merged, landing_page: prior.landing_page || window.location.pathname })); return merged }
export function hasAnalyticsConsent() { return migratedLocalStorage(CONSENT_KEY, LEGACY_CONSENT_KEY) !== null }
export function getAnalyticsConsent() { return consent() }

export function isAnalyticsPageViewPathAllowed(pathname: string | null | undefined) {
  const path = (pathname || '/').split(/[?#]/, 1)[0] || '/'
  // Never send administration, authentication, or private verification-token paths.
  return !/^\/(?:admin|auth|verify-order)(?:\/|$)/i.test(path)
}

function purchaseSentKey(orderId: string) {
  return META_PURCHASE_SENT_PREFIX + orderId
}

function dispatchQueuedBrowserEvents() {
  if (typeof window === 'undefined') return
  const currentConsent = consent()
  const events = [...pendingBrowserEvents.values()]
  pendingBrowserEvents.clear()
  for (const event of events) {
    const eventConsent = {
      necessary: true as const,
      analytics: event.consent.analytics && currentConsent.analytics,
      marketing: event.consent.marketing && currentConsent.marketing,
    }
    if (!eventConsent.analytics && !eventConsent.marketing) continue
    dispatchBrowserAnalyticsEvent({ ...event, consent: eventConsent }, runtimeConfig)
  }
}

function dispatchQueuedMetaPixelPurchases() {
  if (typeof window === 'undefined') return
  const currentConsent = consent()
  const purchases = [...pendingMetaPixelPurchases.entries()]
  pendingMetaPixelPurchases.clear()
  for (const [orderId, event] of purchases) {
    if (!currentConsent.marketing || window.sessionStorage.getItem(purchaseSentKey(orderId)) === '1') continue
    if (dispatchBrowserMetaPixelEvent({ ...event, consent: currentConsent }, runtimeConfig)) {
      window.sessionStorage.setItem(purchaseSentKey(orderId), '1')
    }
  }
}

function dispatchBrowserEventWhenReady(event: CanonicalCommerceEvent) {
  if (!analyticsRuntimeConfigured) {
    if (!event.testMode && (event.consent.analytics || event.consent.marketing)) {
      // Keep only a bounded set of events while public provider config is loading.
      if (pendingBrowserEvents.size >= 100) {
        const oldestKey = pendingBrowserEvents.keys().next().value
        if (oldestKey) pendingBrowserEvents.delete(oldestKey)
      }
      pendingBrowserEvents.set(event.eventId, event)
    }
    return
  }
  dispatchBrowserAnalyticsEvent(event, runtimeConfig)
}
function consentPayload(next: Consent) {
  return {
    analytics_storage: next.analytics ? 'granted' : 'denied',
    ad_storage: next.marketing ? 'granted' : 'denied',
    ad_user_data: next.marketing ? 'granted' : 'denied',
    ad_personalization: next.marketing ? 'granted' : 'denied',
  }
}

function pushGtmConsent(next: Consent, includeDefault = false) {
  if (typeof window === 'undefined') return
  const w = window as typeof window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }
  w.dataLayer = w.dataLayer || []
  // Use the documented gtag command queue shape (dataLayer.push(arguments)),
  // not a hand-built nested array that GTM may treat as an ordinary message.
  w.gtag = w.gtag || function () {
    w.dataLayer = w.dataLayer || []
    // Google documents this exact queue shape for Consent Mode commands.
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments)
  }
  if (includeDefault) {
    // Consent defaults must be queued before the GTM/gtag script is injected.
    w.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
  }
  w.gtag('consent', 'update', consentPayload(next))
}

function hasLoadedGoogleTag() {
  return Boolean(
    document.getElementById('commerce-analytics-gtm') ||
    document.getElementById('commerce-analytics-ga4'),
  )
}

export function setAnalyticsConsent(value: Consent | 'granted' | 'denied') {
  const next: Consent = typeof value === 'string'
    ? { necessary: true, analytics: value === 'granted', marketing: false }
    : { necessary: true, analytics: Boolean(value.analytics), marketing: Boolean(value.marketing) }
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify(next))
  // For a first-time choice, configureAnalyticsRuntime will queue default then
  // update before the tag script is injected. After tags load, update in place.
  if (hasLoadedGoogleTag()) pushGtmConsent(next)
  window.dispatchEvent(new CustomEvent('analytics-consent-change'))
}

export function initializeGtm() {
  // GTM container contents are managed externally. Until each marketing tag's
  // consent rules are verified, don't load the container without marketing consent.
  if (!consent().marketing) return false
  initializeBrowserAnalyticsProviders(runtimeConfig)
  return Boolean(runtimeConfig.enabled && runtimeConfig.gtmContainerId)
}

export function configureAnalyticsRuntime(config: { projectKey?: string; currency?: string; enabled: boolean; marketingEnabled: boolean; ga4MeasurementId: string; gtmContainerId: string; metaPixelId: string; tiktokPixelId?: string; ga4ServerDeliveryEnabled?: boolean; eventControls?: Record<string, boolean> }, isFinalConfig = false) {
  runtimeConfig = {
    projectKey: normalizeAnalyticsProjectKey(config.projectKey),
    currency: normalizeAnalyticsCurrency(config.currency),
    enabled: config.enabled,
    marketingEnabled: config.marketingEnabled,
    ga4MeasurementId: config.ga4MeasurementId.trim(),
    gtmContainerId: config.gtmContainerId.trim().toUpperCase(),
    metaPixelId: config.metaPixelId.trim(),
    tiktokPixelId: config.tiktokPixelId?.trim() || '',
    ga4ServerDeliveryEnabled: Boolean(config.ga4ServerDeliveryEnabled),
    eventControls: { ...(config.eventControls || {}) },
  }
  if (typeof window !== 'undefined') {
    const hasConfiguredGoogleTag = Boolean(runtimeConfig.enabled && (runtimeConfig.gtmContainerId || runtimeConfig.ga4MeasurementId))
    const currentConsent = consent()
    if (hasConfiguredGoogleTag && (currentConsent.analytics || currentConsent.marketing)) {
      // Queue both states before any Google tag script loads, including returning visitors.
      pushGtmConsent(currentConsent, true)
      if (currentConsent.marketing) initializeBrowserAnalyticsProviders(runtimeConfig)
    }
    if (isFinalConfig) {
      analyticsRuntimeConfigured = true
      dispatchQueuedBrowserEvents()
      dispatchQueuedMetaPixelPurchases()
      window.dispatchEvent(new CustomEvent('commerce-analytics-configured'))
    }
  }
}

export function trackClientEvent(input: ClientEventInput) {
  if (typeof window === 'undefined') return
  const currentConsent = consent()
  const attributionData = attribution()
  const commerce = input.commerce ? { currency: runtimeConfig.currency, ...input.commerce } : input.commerce
  const event: CanonicalCommerceEvent = { eventId: input.eventId || crypto.randomUUID(), eventName: input.eventName, eventVersion: '1.0', occurredAt: new Date().toISOString(), sessionId: sessionId(), anonymousId: id(ANON_KEY, LEGACY_ANON_KEY), pageUrl: window.location.href, pagePath: window.location.pathname, referrer: document.referrer || null, source: attributionData.utm_source || null, medium: attributionData.utm_medium || null, campaign: attributionData.utm_campaign || null, device: { type: /Mobi/i.test(navigator.userAgent) ? 'mobile' : 'desktop', language: navigator.language }, consent: currentConsent, commerce: commerce ? { ...commerce, ...attributionData } : attributionData, metadata: input.metadata as Record<string, string | number | boolean | null> | undefined, testMode: input.testMode }
  const hasAnalyticsConsent = currentConsent.analytics || currentConsent.marketing
  if (hasAnalyticsConsent || input.testMode) {
    window.dispatchEvent(new CustomEvent('commerce-analytics-event', { detail: event }))

    // Test-mode events are local diagnostics only and must never enter the public API.
    if (hasAnalyticsConsent && !input.testMode) {
      const body = JSON.stringify(event)
      try {
        const blob = new Blob([body], { type: 'application/json' })
        if (!navigator.sendBeacon('/api/analytics', blob)) {
          void fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined)
        }
      } catch {
        void fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined)
      }
    }
  }
  dispatchBrowserEventWhenReady(event)
  return event
}

/**
 * Send a confirmed COD purchase to Meta Pixel only. It intentionally bypasses
 * GTM/GA4 because the existing server workflow already records GA4 Purchase.
 * The order ID is the stable Pixel eventID for future Pixel/CAPI deduplication.
 */
export function trackMetaPixelPurchase(input: {
  orderId: string
  currency: string
  value: number
  shipping: number
  items: Array<{ item_id: string; item_name: string; price: number; quantity: number }>
}) {
  if (typeof window === 'undefined') return false
  const currentConsent = consent()
  if (!currentConsent.marketing || !input.orderId || !Number.isFinite(input.value) || input.value < 0) return false

  const storageKey = purchaseSentKey(input.orderId)
  if (window.sessionStorage.getItem(storageKey) === '1') return true
  const eventId = `purchase:${input.orderId}`
  if (pendingMetaPixelPurchases.has(input.orderId)) return true

  const event: CanonicalCommerceEvent = {
    eventId,
    eventName: 'purchase',
    eventVersion: '1.0',
    occurredAt: new Date().toISOString(),
    sessionId: null,
    anonymousId: null,
    pageUrl: null,
    pagePath: window.location.pathname,
    referrer: null,
    source: null,
    medium: null,
    campaign: null,
    device: null,
    consent: currentConsent,
    commerce: {
      currency: /^[A-Za-z]{3}$/.test(input.currency) ? input.currency.toUpperCase() : runtimeConfig.currency,
      value: input.value,
      shipping: Number.isFinite(input.shipping) && input.shipping >= 0 ? input.shipping : 0,
      items: input.items.slice(0, 50).map((item) => ({
        item_id: item.item_id.slice(0, 200),
        item_name: item.item_name.slice(0, 200),
        price: item.price,
        quantity: item.quantity,
      })),
    },
  }

  if (!analyticsRuntimeConfigured) {
    pendingMetaPixelPurchases.set(input.orderId, event)
    return true
  }
  if (!dispatchBrowserMetaPixelEvent(event, runtimeConfig)) return false
  window.sessionStorage.setItem(storageKey, '1')
  return true
}

export function trackPageView() { return trackClientEvent({ eventName: 'page_view' }) }
