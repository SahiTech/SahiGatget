import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { recordCanonicalEvent, type CanonicalCommerceEvent } from './events'

export type AnalyticsConfig = { enabled: boolean; marketingEnabled: boolean; consentMode: 'basic' | 'advanced'; debugMode: boolean; ga4MeasurementId: string; gtmContainerId: string; metaPixelId: string; metaCapiEnabled: boolean; serverGtmEndpoint: string; environment: 'development' | 'preview' | 'production' }
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = { enabled: false, marketingEnabled: false, consentMode: 'basic', debugMode: false, ga4MeasurementId: '', gtmContainerId: '', metaPixelId: '', metaCapiEnabled: false, serverGtmEndpoint: '', environment: process.env.VERCEL_ENV === 'production' ? 'production' : process.env.VERCEL_ENV === 'preview' ? 'preview' : 'development' }

async function readConfig(): Promise<AnalyticsConfig> { try { const db = createAdminClient(); const { data } = await db.from('settings').select('value').eq('key', 'analytics_config').maybeSingle(); return { ...DEFAULT_ANALYTICS_CONFIG, ...(data?.value as Partial<AnalyticsConfig> || {}), environment: DEFAULT_ANALYTICS_CONFIG.environment } } catch { return DEFAULT_ANALYTICS_CONFIG } }
export async function getAnalyticsConfig() { return readConfig() }

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) { const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 3500); try { for (let attempt = 0; attempt < 2; attempt += 1) { const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: controller.signal, cache: 'no-store' }); if (response.ok) return { ok: true, latency: 3500 - (timer ? 0 : 0) }; if (response.status < 500) break } return { ok: false, category: 'HTTP_ERROR' } } catch (error) { return { ok: false, category: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR' } } finally { clearTimeout(timer) } }

function ga4Payload(event: CanonicalCommerceEvent) { return { client_id: event.anonymousId || event.sessionId || event.eventId, events: [{ name: event.eventName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(), params: { ...event.commerce, event_id: event.eventId, engagement_time_msec: 1 } }] } }
function metaPayload(event: CanonicalCommerceEvent) { return { data: [{ event_name: event.eventName, event_time: Math.floor(new Date(event.occurredAt).getTime() / 1000), event_id: event.eventId, action_source: 'website', user_data: {}, custom_data: event.commerce || {} }] } }

export async function dispatchAnalyticsEvent(event: CanonicalCommerceEvent) { const config = await readConfig(); const sanitized = { ...event, consent: event.consent }; if (!config.enabled || !event.consent.analytics || (event.testMode !== true && config.environment === 'development' && !config.debugMode)) return { ok: true, skipped: true, destinations: [] as string[] }; const deliveries: Array<{ destination: string; ok: boolean; category?: string }> = []; const destinations: Promise<void>[] = []
  const ga4Secret = process.env.GA4_API_SECRET
  if (config.ga4MeasurementId && ga4Secret) destinations.push(postJson(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(config.ga4MeasurementId)}&api_secret=${encodeURIComponent(ga4Secret)}`, ga4Payload(sanitized)).then((result) => { deliveries.push({ destination: 'GA4', ...result }) }))
  if (config.marketingEnabled && event.consent.marketing && config.metaCapiEnabled && process.env.META_CAPI_ACCESS_TOKEN && config.metaPixelId) destinations.push(postJson(`https://graph.facebook.com/v20.0/${encodeURIComponent(config.metaPixelId)}/events?access_token=${encodeURIComponent(process.env.META_CAPI_ACCESS_TOKEN)}`, metaPayload(sanitized)).then((result) => { deliveries.push({ destination: 'META_CAPI', ...result }) }))
  if (config.serverGtmEndpoint) destinations.push(postJson(config.serverGtmEndpoint, { ...sanitized, destination: 'SERVER_GTM' }).then((result) => { deliveries.push({ destination: 'SERVER_GTM', ...result }) }))
  await Promise.allSettled(destinations); return { ok: deliveries.every((item) => item.ok), skipped: false, deliveries }
}

export async function trackServerCommerceEvent(input: CanonicalCommerceEvent & { orderId?: string | null; cartId?: string | null }) { try { const persisted = await recordCanonicalEvent(input); if (!persisted.ok || persisted.duplicate) return { ...persisted, deliveries: [] }; return { ...persisted, ...(await dispatchAnalyticsEvent(input)) } } catch { return { ok: true, skipped: true, deliveries: [] } } }
