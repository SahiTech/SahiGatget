import 'server-only'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordCanonicalEvent, type CanonicalCommerceEvent } from './events'
import { ANALYTICS_EVENT_MAP } from './registry'
import { ANALYTICS_PROVIDER_ADAPTERS, type AnalyticsProviderId } from './provider-adapters'
import { ensureDeliveryLedgerEntry, recordDeliveryResult } from './delivery-ledger'
import { DEFAULT_ANALYTICS_PROJECT_CONFIG, normalizeAnalyticsCurrency, normalizeAnalyticsProjectKey } from './project-config'

export type AnalyticsConfig = { projectKey: string; currency: string; enabled: boolean; marketingEnabled: boolean; consentMode: 'basic' | 'advanced'; debugMode: boolean; ga4MeasurementId: string; gtmContainerId: string; metaPixelId: string; metaCapiEnabled: boolean; tiktokPixelId: string; tiktokEventsApiEnabled: boolean; serverGtmEnabled: boolean; serverGtmEndpoint: string; environment: 'development' | 'preview' | 'production'; eventControls: Record<string, boolean> }
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = { ...DEFAULT_ANALYTICS_PROJECT_CONFIG, enabled: false, marketingEnabled: false, consentMode: 'advanced', debugMode: false, ga4MeasurementId: '', gtmContainerId: '', metaPixelId: '', metaCapiEnabled: false, tiktokPixelId: '', tiktokEventsApiEnabled: false, serverGtmEnabled: false, serverGtmEndpoint: '', environment: process.env.VERCEL_ENV === 'production' ? 'production' : process.env.VERCEL_ENV === 'preview' ? 'preview' : 'development', eventControls: {} }

export function safeAnalyticsConfigForEnvironment(config: AnalyticsConfig, environment: AnalyticsConfig['environment']): AnalyticsConfig {
  if (environment === 'production') return { ...config, environment }

  // Preview/local deployments share the production settings database. Never
  // expose live production pixel IDs or allow their events to be dispatched.
  return {
    ...config,
    environment,
    enabled: false,
    marketingEnabled: false,
    ga4MeasurementId: '',
    gtmContainerId: '',
    metaPixelId: '',
    metaCapiEnabled: false,
    tiktokPixelId: '',
    tiktokEventsApiEnabled: false,
    serverGtmEnabled: false,
    serverGtmEndpoint: '',
  }
}

const readStoredConfig = unstable_cache(async (): Promise<Partial<AnalyticsConfig>> => {
  try {
    const db = createAdminClient()
    const { data } = await db.from('settings').select('value').eq('key', 'analytics_config').maybeSingle()
    return (data?.value as Partial<AnalyticsConfig> | null) || {}
  } catch {
    return {}
  }
}, ['analytics-config-stored-v1'], { revalidate: 60, tags: ['analytics-config'] })

export async function getAnalyticsConfig() {
  const stored = await readStoredConfig()
  const candidate: AnalyticsConfig = {
    ...DEFAULT_ANALYTICS_CONFIG,
    ...stored,
    projectKey: normalizeAnalyticsProjectKey(stored.projectKey),
    currency: normalizeAnalyticsCurrency(stored.currency),
    eventControls: { ...DEFAULT_ANALYTICS_CONFIG.eventControls, ...(stored.eventControls || {}) },
    environment: DEFAULT_ANALYTICS_CONFIG.environment,
  }
  // Apply deployment-specific safety after the shared cached DB read: a Preview
  // deployment must never inherit a cached Production destination configuration.
  return safeAnalyticsConfigForEnvironment(candidate, DEFAULT_ANALYTICS_CONFIG.environment)
}
export async function dispatchAnalyticsEvent(event: CanonicalCommerceEvent) {
  const config = await getAnalyticsConfig()
  const definition = ANALYTICS_EVENT_MAP[event.eventName]
  const allows = (provider: AnalyticsProviderId) => Boolean(definition?.providers.includes(provider))
  const masterAllowed = config.enabled &&
    (definition?.required || config.eventControls[event.eventName] !== false) &&
    (event.consent.analytics || event.consent.marketing || event.testMode === true) &&
    !(config.environment === 'development' && !config.debugMode)

  if (!masterAllowed) return { ok: true, skipped: true, destinations: [] as string[] }

  const adapters = Object.values(ANALYTICS_PROVIDER_ADAPTERS).filter((adapter) => allows(adapter.id) && adapter.canDispatch(event, config))
  const reservations = await Promise.all(adapters.map(async (adapter) => ({
    adapter,
    reservation: await ensureDeliveryLedgerEntry(event, adapter.id),
  })))
  const leased = reservations.filter(({ reservation }) => Boolean(reservation?.leaseToken))

  const deliveries = await Promise.all(leased.map(async ({ adapter, reservation }) => {
    const leaseToken = reservation?.leaseToken || null
    try {
      const result = await adapter.dispatch(event, config)
      await recordDeliveryResult(event, adapter.id, result, leaseToken)
      return { destination: adapter.id, ...result }
    } catch (error) {
      const result = {
        ok: false,
        latency: 0,
        category: 'NETWORK_ERROR' as const,
        attempts: 0,
        responseBody: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      }
      await recordDeliveryResult(event, adapter.id, result, leaseToken)
      return { destination: adapter.id, ...result }
    }
  }))

  return {
    ok: deliveries.every((item) => item.ok),
    skipped: false,
    deliveries,
    destinations: leased.map(({ adapter }) => adapter.id),
  }
}

export async function trackServerCommerceEvent(input: CanonicalCommerceEvent & { orderId?: string | null; cartId?: string | null }) { try { const persisted = await recordCanonicalEvent(input); if (!persisted.ok || persisted.duplicate) return { ...persisted, deliveries: [] }; return { ...persisted, ...(await dispatchAnalyticsEvent(input)) } } catch { return { ok: true, skipped: true, deliveries: [] } }
}
