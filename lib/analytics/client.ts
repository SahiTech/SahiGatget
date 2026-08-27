'use client'

import type { CanonicalCommerceEvent, CommerceEventName } from './events'

type Consent = { necessary: true; analytics: boolean; marketing: boolean }
type ClientEventInput = { eventName: CommerceEventName; commerce?: Record<string, unknown>; metadata?: Record<string, unknown>; eventId?: string; testMode?: boolean }

const CONSENT_KEY = 'sahigadget-analytics-consent'
const ATTRIBUTION_KEY = 'sahigadget-attribution'
const ANON_KEY = 'sahigadget-anonymous-id'
const SESSION_KEY = 'sahigadget-session-id'
let runtimeConfig = { enabled: false, marketingEnabled: false, ga4MeasurementId: '', gtmContainerId: '', metaPixelId: '' }
let initializedMetaPixelId = ''

export function configureAnalyticsRuntime(config: { enabled: boolean; marketingEnabled: boolean; ga4MeasurementId: string; gtmContainerId: string; metaPixelId: string }) {
  runtimeConfig = { enabled: config.enabled, marketingEnabled: config.marketingEnabled, ga4MeasurementId: config.ga4MeasurementId.trim(), gtmContainerId: config.gtmContainerId.trim(), metaPixelId: config.metaPixelId.trim() }
}

function id(key: string) { const existing = window.localStorage.getItem(key); if (existing) return existing; const value = crypto.randomUUID(); window.localStorage.setItem(key, value); return value }
function sessionId() { const existing = window.sessionStorage.getItem(SESSION_KEY); if (existing) return existing; const value = crypto.randomUUID(); window.sessionStorage.setItem(SESSION_KEY, value); return value }
function consent(): Consent { try { const value = JSON.parse(window.localStorage.getItem(CONSENT_KEY) || 'null') as Partial<Consent> | string | null; if (value && typeof value === 'object') return { necessary: true, analytics: Boolean(value.analytics), marketing: Boolean(value.marketing) }; return { necessary: true, analytics: value === 'granted', marketing: false } } catch { return { necessary: true, analytics: false, marketing: false } } }
function attribution() { const url = new URL(window.location.href); const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'ttclid']; const current = Object.fromEntries(keys.map((key) => [key, url.searchParams.get(key)]).filter(([, value]) => value)); const prior = JSON.parse(window.sessionStorage.getItem(ATTRIBUTION_KEY) || '{}') as Record<string, string>; const merged = { ...current, ...prior }; if (Object.keys(current).length) window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({ ...merged, landing_page: prior.landing_page || window.location.pathname })); return merged }
function loadScript(src: string, idValue: string) { if (document.getElementById(idValue)) return; const script = document.createElement('script'); script.id = idValue; script.async = true; script.src = src; document.head.appendChild(script) }

export function hasAnalyticsConsent() { return window.localStorage.getItem(CONSENT_KEY) !== null }
export function getAnalyticsConsent() { return consent() }
export function setAnalyticsConsent(value: Consent | 'granted' | 'denied') { const next: Consent = typeof value === 'string' ? { necessary: true, analytics: value === 'granted', marketing: false } : { necessary: true, analytics: Boolean(value.analytics), marketing: Boolean(value.marketing) }; window.localStorage.setItem(CONSENT_KEY, JSON.stringify(next)); window.dispatchEvent(new CustomEvent('sahigadget-consent-change')) }

export function trackClientEvent(input: ClientEventInput) {
  if (typeof window === 'undefined') return
  const currentConsent = consent()
  const event: CanonicalCommerceEvent = { eventId: input.eventId || crypto.randomUUID(), eventName: input.eventName, eventVersion: '1.0', occurredAt: new Date().toISOString(), sessionId: sessionId(), anonymousId: id(ANON_KEY), pageUrl: window.location.href, pagePath: window.location.pathname, referrer: document.referrer || null, source: attribution().utm_source || null, medium: attribution().utm_medium || null, campaign: attribution().utm_campaign || null, device: { type: /Mobi/i.test(navigator.userAgent) ? 'mobile' : 'desktop', language: navigator.language }, consent: currentConsent, commerce: { ...input.commerce, ...attribution() }, metadata: input.metadata as Record<string, string | number | boolean | null> | undefined, testMode: input.testMode }
  if (currentConsent.analytics || input.testMode) { window.dispatchEvent(new CustomEvent('sahigadget-analytics-event', { detail: event })); void fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event), keepalive: true }).catch(() => undefined) }
  if (runtimeConfig.enabled && (currentConsent.analytics || input.testMode)) { const gtmId = runtimeConfig.gtmContainerId; if (gtmId) { const w = window as typeof window & { dataLayer?: unknown[] }; w.dataLayer = w.dataLayer || []; w.dataLayer.push({ event: input.eventName, event_id: event.eventId, event_version: event.eventVersion, ecommerce: event.commerce, attribution: attribution(), test_mode: Boolean(input.testMode) }); loadScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`, 'sahigadget-gtm') } }
  if (runtimeConfig.enabled && (currentConsent.analytics || input.testMode)) { const idValue = runtimeConfig.ga4MeasurementId; if (idValue) { const w = window as typeof window & { gtag?: (...args: unknown[]) => void }; w.gtag = w.gtag || function (...args: unknown[]) { (w as typeof w & { dataLayer?: unknown[] }).dataLayer = (w as typeof w & { dataLayer?: unknown[] }).dataLayer || []; (w as typeof w & { dataLayer?: unknown[] }).dataLayer?.push(args) }; loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(idValue)}`, 'sahigadget-ga4'); w.gtag('config', idValue, { send_page_view: false }); w.gtag(event.eventName, { ...event.commerce, event_id: event.eventId }) } }
  const pixelId = runtimeConfig.metaPixelId
  if (runtimeConfig.enabled && runtimeConfig.marketingEnabled && (currentConsent.marketing || input.testMode) && pixelId) { const w = window as typeof window & { fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; push?: (...args: unknown[]) => void; loaded?: boolean; version?: string }; _fbq?: unknown }; if (!w.fbq) { const fbq = function (this: unknown, ...args: unknown[]) { if (fbq.callMethod) fbq.callMethod.apply(this, args); else fbq.queue?.push(args) } as ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; push?: (...args: unknown[]) => void; loaded?: boolean; version?: string }; fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = []; w.fbq = fbq; w._fbq = fbq }; loadScript('https://connect.facebook.net/en_US/fbevents.js', 'sahigadget-meta-pixel'); if (initializedMetaPixelId !== pixelId) { w.fbq('init', pixelId); initializedMetaPixelId = pixelId }; w.fbq('track', input.eventName === 'view_item' ? 'ViewContent' : input.eventName === 'add_to_cart' ? 'AddToCart' : input.eventName === 'begin_checkout' ? 'InitiateCheckout' : input.eventName === 'purchase' ? 'Purchase' : input.eventName === 'search' ? 'Search' : input.eventName === 'contact' ? 'Contact' : 'PageView', { ...event.commerce, eventID: event.eventId }) }
  return event
}

export function trackPageView() { return trackClientEvent({ eventName: 'page_view' }) }
