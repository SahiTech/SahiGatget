import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { getAnalyticsConfig } from './server'
import { ANALYTICS_EVENT_REGISTRY } from './registry'

export async function getAnalyticsDiagnostics() { const config = await getAnalyticsConfig(); let events: Array<{ event_id: string; event_name: string; created_at: string; test_mode: boolean; source: string }> = []; try { const db = createAdminClient(); const { data } = await db.from('commerce_events').select('event_id,event_name,created_at,metadata').order('created_at', { ascending: false }).limit(50); events = (data || []).map((row) => { const metadata = (row.metadata || {}) as Record<string, unknown>; return { event_id: String(row.event_id), event_name: String(row.event_name), created_at: String(row.created_at), test_mode: Boolean(metadata.test_mode), source: String(metadata.source || 'storefront') } }) } catch { events = [] }
  return { providers: { GA4: config.ga4MeasurementId ? (process.env.GA4_API_SECRET ? 'CONFIGURED' : 'PARTIAL') : 'DISABLED', GTM: config.gtmContainerId ? 'CONFIGURED' : 'DISABLED', META_PIXEL: config.metaPixelId ? 'CONFIGURED' : 'DISABLED', META_CAPI: config.metaCapiEnabled ? (process.env.META_CAPI_ACCESS_TOKEN ? 'CONFIGURED' : 'PARTIAL') : 'DISABLED', SERVER_GTM: config.serverGtmEndpoint ? 'CONFIGURED' : 'DISABLED' }, events, registry: ANALYTICS_EVENT_REGISTRY }
}
