import 'server-only'

import type { CanonicalCommerceEvent } from './types'
import type { AnalyticsConfig } from './server'
import { providerEventName } from './provider-maps'
import { buildServerGtmEnvelope } from './server-gtm'
import { isLiveProviderDispatchAllowed } from './provider-policy'
import { postJson, type HttpDeliveryResult } from './transport'

/**
 * GA4's debug/validation endpoint may return HTTP 200 for invalid events.
 * Treat a payload as valid only when the response contains an empty
 * validationMessages array.
 */
export function interpretGa4ValidationResponse(result: HttpDeliveryResult): HttpDeliveryResult {
  if (!result.ok) return result

  let payload: unknown
  try {
    payload = JSON.parse(result.responseBody || '')
  } catch {
    return { ...result, ok: false, category: 'HTTP_ERROR', responseBody: 'Invalid JSON from GA4 validation endpoint.' }
  }

  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { validationMessages?: unknown }).validationMessages)) {
    return { ...result, ok: false, category: 'HTTP_ERROR', responseBody: 'Unexpected GA4 validation response format.' }
  }

  const messages = (payload as { validationMessages: unknown[] }).validationMessages
  if (messages.length > 0) {
    return {
      ...result,
      ok: false,
      category: 'HTTP_ERROR',
      responseBody: JSON.stringify(messages).slice(0, 1000),
    }
  }

  return result
}

export const ANALYTICS_PROVIDER_IDS = ['GA4', 'META_CAPI', 'TIKTOK_EVENTS_API', 'SERVER_GTM'] as const
export type AnalyticsProviderId = (typeof ANALYTICS_PROVIDER_IDS)[number]

export type AnalyticsProviderAdapter = {
  id: AnalyticsProviderId
  canDispatch: (event: CanonicalCommerceEvent, config: AnalyticsConfig) => boolean
  dispatch: (event: CanonicalCommerceEvent, config: AnalyticsConfig) => Promise<HttpDeliveryResult>
  validate?: (event: CanonicalCommerceEvent, config: AnalyticsConfig) => Promise<HttpDeliveryResult>
}

function ga4NumericId(input: string) {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) hash = Math.imul(hash ^ input.charCodeAt(index), 16777619)
  const first = Math.abs(hash >>> 0) % 9000000000 + 1000000000
  const secondHash = Math.abs(Math.imul(hash ^ 0x9e3779b9, 2246822519) >>> 0)
  const second = secondHash % 9000000000 + 1000000000
  return String(first) + '.' + String(second)
}

function ga4SessionId(input: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) hash = Math.imul(hash ^ input.charCodeAt(index), 16777619)
  return String(Math.abs(hash >>> 0) % 9000000000000 + 1000000000000)
}

export function buildGa4MeasurementPayload(event: CanonicalCommerceEvent) {
  const stableSource = event.anonymousId || event.sessionId || event.eventId
  const clientId = /^\d+\.\d+$/.test(stableSource) ? stableSource : ga4NumericId(stableSource)
  const sessionId = /^\d+$/.test(event.sessionId || '') ? event.sessionId : ga4SessionId(event.sessionId || event.occurredAt)
  return {
    client_id: clientId,
    events: [{
      name: event.eventName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
      params: { ...event.commerce, event_id: event.eventId, session_id: sessionId, engagement_time_msec: 1 },
    }],
    consent: {
      analytics_storage: event.consent.analytics ? 'GRANTED' : 'DENIED',
      ad_user_data: event.consent.marketing ? 'GRANTED' : 'DENIED',
      ad_personalization: event.consent.marketing ? 'GRANTED' : 'DENIED',
    },
  }
}

function metaPayload(event: CanonicalCommerceEvent) {
  return {
    data: [{
      event_name: providerEventName('META_PIXEL', event.eventName),
      event_time: Math.floor(new Date(event.occurredAt).getTime() / 1000),
      event_id: event.eventId,
      action_source: 'website',
      user_data: {},
      custom_data: event.commerce || {},
    }],
  }
}

function tiktokPayload(event: CanonicalCommerceEvent, pixelId: string) {
  const eventName = providerEventName('TIKTOK_EVENTS_API', event.eventName)
  if (!eventName) return null
  return {
    event_source: 'website',
    event_source_id: pixelId,
    data: [{
      event: eventName,
      event_time: Math.floor(new Date(event.occurredAt).getTime() / 1000),
      event_id: event.eventId,
      properties: event.commerce || {},
      page: { url: event.pageUrl || undefined },
    }],
  }
}

function liveEligible(event: CanonicalCommerceEvent) {
  return isLiveProviderDispatchAllowed(event.testMode)
}

export const ANALYTICS_PROVIDER_ADAPTERS: Record<AnalyticsProviderId, AnalyticsProviderAdapter> = {
  GA4: {
    id: 'GA4',
    canDispatch: (event, config) => Boolean(liveEligible(event) && event.consent.analytics && config.ga4MeasurementId && process.env.GA4_API_SECRET),
    dispatch: (event, config) => postJson(
      'https://www.google-analytics.com/mp/collect?measurement_id=' + encodeURIComponent(config.ga4MeasurementId) + '&api_secret=' + encodeURIComponent(process.env.GA4_API_SECRET || ''),
      buildGa4MeasurementPayload(event),
    ),
    validate: async (event, config) => interpretGa4ValidationResponse(await postJson(
      'https://www.google-analytics.com/debug/mp/collect?measurement_id=' + encodeURIComponent(config.ga4MeasurementId) + '&api_secret=' + encodeURIComponent(process.env.GA4_API_SECRET || ''),
      { ...buildGa4MeasurementPayload(event), validation_behavior: 'ENFORCE_RECOMMENDATIONS' },
    )),
  },
  META_CAPI: {
    id: 'META_CAPI',
    canDispatch: (event, config) => Boolean(liveEligible(event) && config.marketingEnabled && event.consent.marketing && config.metaCapiEnabled && process.env.META_CAPI_ACCESS_TOKEN && config.metaPixelId),
    dispatch: (event, config) => postJson(
      'https://graph.facebook.com/v20.0/' + encodeURIComponent(config.metaPixelId) + '/events?access_token=' + encodeURIComponent(process.env.META_CAPI_ACCESS_TOKEN || ''),
      metaPayload(event),
    ),
  },
  TIKTOK_EVENTS_API: {
    id: 'TIKTOK_EVENTS_API',
    canDispatch: (event, config) => Boolean(liveEligible(event) && config.marketingEnabled && event.consent.marketing && config.tiktokEventsApiEnabled && process.env.TIKTOK_EVENTS_API_ACCESS_TOKEN && config.tiktokPixelId && providerEventName('TIKTOK_EVENTS_API', event.eventName)),
    dispatch: async (event, config) => {
      const payload = tiktokPayload(event, config.tiktokPixelId)
      if (!payload) return { ok: false, latency: 0, category: 'HTTP_ERROR', attempts: 0, responseBody: 'Unsupported TikTok event.' }
      return postJson('https://business-api.tiktok.com/open_api/v1.3/event/track/', payload, { 'Access-Token': process.env.TIKTOK_EVENTS_API_ACCESS_TOKEN || '' })
    },
  },
  SERVER_GTM: {
    id: 'SERVER_GTM',
    canDispatch: (event, config) => Boolean(liveEligible(event) && (event.consent.analytics || event.consent.marketing) && config.serverGtmEnabled && config.serverGtmEndpoint),
    dispatch: (event, config) => postJson(config.serverGtmEndpoint, buildServerGtmEnvelope(event, config.projectKey)),
  },
}
