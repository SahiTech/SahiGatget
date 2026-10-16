import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { getAnalyticsConfig } from './server'
import { ANALYTICS_EVENT_REGISTRY } from './registry'

async function probeGtm(containerId: string) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const response = await fetch('https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(containerId), {
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    return response.ok ? 'REACHABLE' : 'UNREACHABLE'
  } catch {
    return 'UNREACHABLE'
  }
}

export async function getAnalyticsDiagnostics() {
  const config = await getAnalyticsConfig()
  let events: Array<{ event_id: string; event_name: string; created_at: string; test_mode: boolean; source: string }> = []

  try {
    const db = createAdminClient()
    const { data } = await db
      .from('commerce_events')
      .select('event_id,event_name,occurred_at,metadata')
      .order('occurred_at', { ascending: false })
      .limit(50)

    events = (data || []).map((row) => {
      const metadata = (row.metadata || {}) as Record<string, unknown>
      return {
        event_id: String(row.event_id),
        event_name: String(row.event_name),
        created_at: String(row.occurred_at),
        test_mode: Boolean(metadata.test_mode),
        source: String(metadata.source || 'storefront'),
      }
    })
  } catch {
    events = []
  }

  const gtmStatus = config.gtmContainerId ? await probeGtm(config.gtmContainerId) : 'DISABLED'
  let delivery = { pending: 0, succeeded: 0, failed: 0, dead: 0, retryable: 0, leased: 0 }
  try {
    const db = createAdminClient()
    const now = new Date().toISOString()
    const [pending, succeeded, failed, dead, retryable, leased] = await Promise.all([
      db.from('analytics_delivery_ledger').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      db.from('analytics_delivery_ledger').select('id', { count: 'exact', head: true }).eq('status', 'SUCCEEDED'),
      db.from('analytics_delivery_ledger').select('id', { count: 'exact', head: true }).eq('status', 'FAILED'),
      db.from('analytics_delivery_ledger').select('id', { count: 'exact', head: true }).eq('status', 'DEAD'),
      db.from('analytics_delivery_ledger').select('id', { count: 'exact', head: true }).in('status', ['PENDING', 'FAILED']).lte('next_attempt_at', now).is('lease_token', null),
      db.from('analytics_delivery_ledger').select('id', { count: 'exact', head: true }).not('lease_token', 'is', null),
    ])
    delivery = {
      pending: pending.count || 0,
      succeeded: succeeded.count || 0,
      failed: failed.count || 0,
      dead: dead.count || 0,
      retryable: retryable.count || 0,
      leased: leased.count || 0,
    }
  } catch {
    delivery = { pending: 0, succeeded: 0, failed: 0, dead: 0, retryable: 0, leased: 0 }
  }

  return {
    providers: {
      GA4: config.ga4MeasurementId ? (process.env.GA4_API_SECRET ? 'CONFIGURED' : 'PARTIAL') : 'DISABLED',
      GTM: gtmStatus,
      META_PIXEL: config.metaPixelId ? 'CONFIGURED' : 'DISABLED',
      META_CAPI: config.metaCapiEnabled ? (process.env.META_CAPI_ACCESS_TOKEN ? 'CONFIGURED' : 'PARTIAL') : 'DISABLED',
      TIKTOK_PIXEL: config.tiktokPixelId ? 'CONFIGURED' : 'DISABLED',
      TIKTOK_EVENTS_API: config.tiktokEventsApiEnabled
        ? (config.tiktokPixelId && process.env.TIKTOK_EVENTS_API_ACCESS_TOKEN ? 'CONFIGURED' : 'PARTIAL')
        : 'DISABLED',
      SERVER_GTM: config.serverGtmEnabled && config.serverGtmEndpoint
        ? 'CONFIGURED'
        : config.serverGtmEndpoint
          ? 'PAUSED'
          : 'DISABLED',
    },
    events,
    registry: ANALYTICS_EVENT_REGISTRY,
    delivery,
  }
}
