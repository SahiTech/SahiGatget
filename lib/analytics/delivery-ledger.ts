import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { CanonicalCommerceEvent } from './types'
import type { AnalyticsProviderId } from './provider-adapters'
import type { HttpDeliveryResult } from './transport'

export const ANALYTICS_MAX_DELIVERY_ATTEMPTS = 8
export const ANALYTICS_DELIVERY_LEASE_SECONDS = 300
export const ANALYTICS_PROVIDER_RECHECK_SECONDS = 15 * 60

export type AnalyticsDeliveryStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'DEAD'

export type AnalyticsDeliveryRecord = {
  event_id: string
  provider: AnalyticsProviderId
  status: AnalyticsDeliveryStatus
  attempt_count: number
  event_payload: CanonicalCommerceEvent
  last_attempt_at: string | null
  next_attempt_at: string | null
  latency_ms: number | null
  http_status: number | null
  category: string | null
  response_excerpt: string | null
  lease_token?: string | null
  lease_until?: string | null
  dead_letter_at?: string | null
}

export async function ensureDeliveryLedgerEntry(event: CanonicalCommerceEvent, provider: AnalyticsProviderId) {
  try {
    const db = createAdminClient()
    const now = new Date().toISOString()

    await db.from('analytics_delivery_ledger').upsert({
      event_id: event.eventId,
      provider,
      status: 'PENDING',
      event_payload: event,
      next_attempt_at: now,
      updated_at: now,
    }, { onConflict: 'event_id,provider', ignoreDuplicates: true })

    const { data, error } = await db.rpc('claim_analytics_delivery', {
      p_event_id: event.eventId,
      p_provider: provider,
      p_lease_seconds: ANALYTICS_DELIVERY_LEASE_SECONDS,
      p_max_attempts: ANALYTICS_MAX_DELIVERY_ATTEMPTS,
    })

    if (error || !Array.isArray(data) || !data[0]) return null
    const row = data[0] as Record<string, unknown>
    return {
      attemptCount: Number(row.attempt_count || 0),
      status: row.status as AnalyticsDeliveryStatus,
      leaseToken: typeof row.lease_token === 'string' ? row.lease_token : null,
      leaseUntil: typeof row.lease_until === 'string' ? row.lease_until : null,
    }
  } catch {
    // Analytics observability must never affect commerce.
    return null
  }
}

export async function recordDeliveryResult(
  event: CanonicalCommerceEvent,
  provider: AnalyticsProviderId,
  result: HttpDeliveryResult,
  leaseToken: string | null = null,
  permanentFailure = false,
) {
  try {
    const db = createAdminClient()
    const { data, error } = await db.rpc('finalize_analytics_delivery', {
      p_event_id: event.eventId,
      p_provider: provider,
      p_lease_token: leaseToken,
      p_ok: result.ok,
      p_latency_ms: result.latency,
      p_http_status: result.status ?? null,
      p_category: result.category ?? null,
      p_response_excerpt: result.responseBody ?? null,
      p_permanent_failure: permanentFailure,
      p_max_attempts: ANALYTICS_MAX_DELIVERY_ATTEMPTS,
    })

    if (error) return false
    return data === true
  } catch {
    // Ledger failures are diagnostic-only and must not fail the event path.
    return false
  }
}

export async function releaseDeliveryForProviderRecheck(
  eventId: string,
  provider: AnalyticsProviderId,
  leaseToken: string,
  category = 'PROVIDER_NOT_ELIGIBLE',
) {
  try {
    const db = createAdminClient()
    const { data, error } = await db.rpc('release_analytics_delivery', {
      p_event_id: eventId,
      p_provider: provider,
      p_lease_token: leaseToken,
      p_delay_seconds: ANALYTICS_PROVIDER_RECHECK_SECONDS,
      p_category: category,
      p_response_excerpt: 'Provider is temporarily unavailable or disabled; delivery will be rechecked.',
    })
    return !error && data === true
  } catch {
    return false
  }
}

export async function claimAnalyticsDeliveryBatch(limit = 25): Promise<AnalyticsDeliveryRecord[]> {
  try {
    const db = createAdminClient()
    const { data, error } = await db.rpc('claim_analytics_delivery_batch', {
      p_limit: limit,
      p_lease_seconds: ANALYTICS_DELIVERY_LEASE_SECONDS,
      p_max_attempts: ANALYTICS_MAX_DELIVERY_ATTEMPTS,
    })
    if (error) return []
    return (data || []) as AnalyticsDeliveryRecord[]
  } catch {
    return []
  }
}

export async function getAnalyticsWorkerSecret() {
  try {
    const db = createAdminClient()
    const { data } = await db
      .from('analytics_worker_auth')
      .select('secret')
      .eq('id', true)
      .maybeSingle()
    return typeof data?.secret === 'string' ? data.secret : null
  } catch {
    return null
  }
}

export async function listRetryableDeliveries(limit = 20): Promise<AnalyticsDeliveryRecord[]> {
  try {
    const db = createAdminClient()
    const now = new Date().toISOString()
    const { data } = await db
      .from('analytics_delivery_ledger')
      .select('event_id,provider,status,attempt_count,event_payload,last_attempt_at,next_attempt_at,latency_ms,http_status,category,response_excerpt,lease_token,lease_until,dead_letter_at')
      .in('status', ['PENDING', 'FAILED'])
      .lte('next_attempt_at', now)
      .is('lease_token', null)
      .order('next_attempt_at', { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 100))
    return (data || []) as AnalyticsDeliveryRecord[]
  } catch {
    return []
  }
}
