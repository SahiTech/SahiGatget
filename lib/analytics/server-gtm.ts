import 'server-only'

import type { CanonicalCommerceEvent } from './events'
import { DEFAULT_ANALYTICS_PROJECT_CONFIG, normalizeAnalyticsProjectKey } from './project-config'

export type ServerGtmConfig = {
  enabled: boolean
  endpoint: string
}

export type ServerGtmHealth = {
  configured: boolean
  valid: boolean
  reachable: boolean
  endpoint: string
  latencyMs: number | null
  reason: 'NOT_CONFIGURED' | 'INVALID_ENDPOINT' | 'REACHABLE' | 'UNREACHABLE'
}

const MAX_ENDPOINT_LENGTH = 2048

export function normalizeServerGtmEndpoint(value: string | null | undefined) {
  const endpoint = (value || '').trim().replace(/\/+$/, '')
  if (!endpoint) return ''
  if (endpoint.length > MAX_ENDPOINT_LENGTH) return ''
  try {
    const url = new URL(endpoint)
    if (url.protocol !== 'https:') return ''
    if (url.username || url.password || url.search || url.hash) return ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

export function isValidServerGtmEndpoint(value: string | null | undefined) {
  const raw = (value || '').trim()
  return raw === '' || normalizeServerGtmEndpoint(raw) === raw.replace(/\/+$/, '')
}

export function serverGtmHealthFromConfig(config: ServerGtmConfig): ServerGtmHealth {
  if (!config.endpoint) return { configured: false, valid: true, reachable: false, endpoint: '', latencyMs: null, reason: 'NOT_CONFIGURED' }
  const normalized = normalizeServerGtmEndpoint(config.endpoint)
  if (!normalized) return { configured: true, valid: false, reachable: false, endpoint: config.endpoint, latencyMs: null, reason: 'INVALID_ENDPOINT' }
  return { configured: true, valid: true, reachable: false, endpoint: normalized, latencyMs: null, reason: 'UNREACHABLE' }
}

/**
 * The endpoint is intentionally treated as an opaque server-side GTM ingress.
 * No credentials are stored in the database and no customer PII is sent by this
 * transport. Provider-specific routing belongs inside the server container.
 *
 * Activation is deliberately opt-in. Until a real server container is deployed,
 * this module cannot turn an arbitrary URL into a working GTM server.
 */
export function buildServerGtmEnvelope(event: CanonicalCommerceEvent, projectKey = DEFAULT_ANALYTICS_PROJECT_CONFIG.projectKey) {
  return {
    schema: `${normalizeAnalyticsProjectKey(projectKey)}.analytics.event`,
    version: '1.0',
    event: {
      id: event.eventId,
      name: event.eventName,
      version: event.eventVersion,
      occurred_at: event.occurredAt,
      session_id: event.sessionId,
      anonymous_id: event.anonymousId,
      page_path: event.pagePath,
      referrer: event.referrer,
      source: event.source,
      medium: event.medium,
      campaign: event.campaign,
      device: event.device,
      consent: event.consent,
      commerce: event.commerce,
      test_mode: event.testMode === true,
    },
  }
}
