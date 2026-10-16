import 'server-only'

import { getAnalyticsConfig } from './server'
import { ANALYTICS_PROVIDER_ADAPTERS, type AnalyticsProviderId } from './provider-adapters'
import { ANALYTICS_EVENT_MAP } from './registry'
import type { CanonicalCommerceEvent } from './types'
import type { HttpDeliveryResult } from './transport'
import {
  ANALYTICS_DELIVERY_LEASE_SECONDS,
  ANALYTICS_MAX_DELIVERY_ATTEMPTS,
  claimAnalyticsDeliveryBatch,
  releaseDeliveryForProviderRecheck,
  recordDeliveryResult,
} from './delivery-ledger'

const DEFAULT_BATCH_SIZE = 25
const DELIVERY_CONCURRENCY = 6

function failureFromError(error: unknown): HttpDeliveryResult {
  return {
    ok: false,
    latency: 0,
    attempts: 0,
    category: 'NETWORK_ERROR',
    responseBody: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
  }
}

export function isAnalyticsDeliveryPermanentlyIneligible(
  event: CanonicalCommerceEvent,
  provider: AnalyticsProviderId,
  config: Awaited<ReturnType<typeof getAnalyticsConfig>>,
) {
  const definition = ANALYTICS_EVENT_MAP[event.eventName]
  if (!definition || !definition.providers.includes(provider)) return true
  if (event.testMode === true) return true
  if (!(event.consent.analytics || event.consent.marketing)) return true
  if (!definition.required && config.eventControls[event.eventName] === false) return true
  return false
}

async function processEntry(
  entry: Awaited<ReturnType<typeof claimAnalyticsDeliveryBatch>>[number],
  config: Awaited<ReturnType<typeof getAnalyticsConfig>>,
) {
  const provider = entry.provider
  const event = entry.event_payload
  const adapter = ANALYTICS_PROVIDER_ADAPTERS[provider]
  const leaseToken = entry.lease_token || null

  if (!adapter || isAnalyticsDeliveryPermanentlyIneligible(event, provider, config)) {
    const finalized = await recordDeliveryResult(
      event,
      provider,
      {
        ok: false,
        latency: 0,
        attempts: 0,
        category: 'HTTP_ERROR',
        responseBody: 'Delivery is not eligible for live replay.',
      },
      leaseToken,
      true,
    )
    return {
      eventId: entry.event_id,
      provider,
      ok: finalized,
      skipped: true,
      dead: finalized,
      reason: 'NOT_ELIGIBLE' as const,
    }
  }

  if (!config.enabled || (config.environment === 'development' && !config.debugMode)) {
    const released = leaseToken
      ? await releaseDeliveryForProviderRecheck(entry.event_id, provider, leaseToken, 'ANALYTICS_DISABLED')
      : false
    return {
      eventId: entry.event_id,
      provider,
      ok: released,
      skipped: true,
      dead: false,
      reason: 'ANALYTICS_DISABLED' as const,
    }
  }

  if (!adapter.canDispatch(event, config)) {
    const released = leaseToken
      ? await releaseDeliveryForProviderRecheck(entry.event_id, provider, leaseToken)
      : false
    return {
      eventId: entry.event_id,
      provider,
      ok: released,
      skipped: true,
      dead: false,
      reason: 'PROVIDER_NOT_READY' as const,
    }
  }

  try {
    const delivery = await adapter.dispatch(event, config)
    const finalized = await recordDeliveryResult(event, provider, delivery, leaseToken)
    return {
      eventId: entry.event_id,
      provider,
      ok: delivery.ok && finalized,
      skipped: false,
      dead: !delivery.ok && entry.attempt_count + 1 >= ANALYTICS_MAX_DELIVERY_ATTEMPTS,
      category: delivery.category,
      attemptNumber: entry.attempt_count + 1,
    }
  } catch (error) {
    const delivery = failureFromError(error)
    const finalized = await recordDeliveryResult(event, provider, delivery, leaseToken)
    return {
      eventId: entry.event_id,
      provider,
      ok: finalized && delivery.ok,
      skipped: false,
      dead: entry.attempt_count + 1 >= ANALYTICS_MAX_DELIVERY_ATTEMPTS,
      category: delivery.category,
      attemptNumber: entry.attempt_count + 1,
    }
  }
}

export async function processAnalyticsDeliveryWorker(limit = DEFAULT_BATCH_SIZE) {
  const entries = await claimAnalyticsDeliveryBatch(Math.min(Math.max(limit, 1), 100))

  if (entries.length === 0) {
    return {
      ok: true,
      claimed: 0,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      dead: 0,
      maxAttempts: ANALYTICS_MAX_DELIVERY_ATTEMPTS,
      leaseSeconds: ANALYTICS_DELIVERY_LEASE_SECONDS,
      results: [],
    }
  }

  // Avoid a config read on the overwhelmingly common empty-queue tick.
  const config = await getAnalyticsConfig()
  const results: Array<{
    eventId: string
    provider: AnalyticsProviderId
    ok: boolean
    skipped: boolean
    dead: boolean
    reason?: string
    category?: string
    attemptNumber?: number
  }> = []

  for (let index = 0; index < entries.length; index += DELIVERY_CONCURRENCY) {
    const chunk = entries.slice(index, index + DELIVERY_CONCURRENCY)
    const processed = await Promise.all(chunk.map((entry) => processEntry(entry, config)))
    results.push(...processed)
  }

  return {
    ok: results.every((result) => result.ok || result.skipped),
    claimed: entries.length,
    attempted: results.filter((result) => !result.skipped).length,
    succeeded: results.filter((result) => result.ok && !result.skipped).length,
    failed: results.filter((result) => !result.ok && !result.skipped).length,
    skipped: results.filter((result) => result.skipped).length,
    dead: results.filter((result) => result.dead).length,
    maxAttempts: ANALYTICS_MAX_DELIVERY_ATTEMPTS,
    leaseSeconds: ANALYTICS_DELIVERY_LEASE_SECONDS,
    results,
  }
}
