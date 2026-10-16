import Module from 'node:module'
import assert from 'node:assert/strict'

type ModuleLoader = (request: string, parent: unknown, isMain: boolean) => unknown
const runtimeModule = Module as unknown as { _load: ModuleLoader }
const originalLoad = runtimeModule._load

runtimeModule._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'server-only') return {}
  if (request === '@/lib/supabase/admin') return { createAdminClient: () => { throw new Error('database access is prohibited in analytics contract tests') } }
  return originalLoad.call(this, request, parent, isMain)
}

async function main() {
  const { canonicalCommerceEventSchema, sanitizeCommerceEvent } = await import('../lib/analytics/events')
  const { isClientIngestibleEventName, hasAnalyticsOrMarketingConsent, isSameOriginAnalyticsRequest } = await import('../lib/analytics/ingestion-policy')
  const {
    analyticsEventSchema,
    normalizeAnalyticsCurrency,
    normalizeAnalyticsProjectKey,
  } = await import('../lib/analytics/project-config')
  const { isLiveProviderDispatchAllowed } = await import('../lib/analytics/provider-policy')
  const {
    normalizeServerGtmEndpoint,
    isValidServerGtmEndpoint,
    buildServerGtmEnvelope,
  } = await import('../lib/analytics/server-gtm')
  const { ANALYTICS_PROVIDER_ADAPTERS, buildGa4MeasurementPayload, interpretGa4ValidationResponse } = await import('../lib/analytics/provider-adapters')
  const { safeAnalyticsConfigForEnvironment } = await import('../lib/analytics/server')
  const { isAnalyticsDeliveryPermanentlyIneligible } = await import('../lib/analytics/worker')
  const { isBrowserAnalyticsEventEnabled, isBrowserProviderEventAllowed, getMetaPixelIds, buildMetaPixelInitArgs, buildMetaPixelEventData, buildMetaPixelTrackSingleArgs } = await import('../lib/analytics/browser-registry')
  const { isAnalyticsPageViewPathAllowed } = await import('../lib/analytics/client')
  const { ANALYTICS_MAX_DELIVERY_ATTEMPTS } = await import('../lib/analytics/delivery-ledger')

  const base = {
    eventId: '11111111-1111-4111-8111-111111111111',
    eventName: 'add_to_cart' as const,
    eventVersion: '1.0' as const,
    occurredAt: new Date().toISOString(),
    sessionId: '22222222-2222-4222-8222-222222222222',
    anonymousId: '33333333-3333-4333-8333-333333333333',
    pageUrl: 'https://example.test/products/demo',
    pagePath: '/products/demo',
    referrer: null,
    source: 'google',
    medium: 'organic',
    campaign: null,
    device: { type: 'mobile', language: 'bn-BD' },
    consent: { necessary: true as const, analytics: true, marketing: false },
    commerce: {
      currency: 'BDT',
      value: 1200,
      items: [{ item_id: 'SKU-1', item_name: 'Demo phone', price: 1200, quantity: 1 }],
    },
    metadata: { source: 'test', item_count: 1 },
  }

  assert.equal(canonicalCommerceEventSchema.safeParse(base).success, true)

  // The public browser endpoint must not accept server-authoritative lifecycle events.
  assert.equal(isClientIngestibleEventName('page_view'), true)
  assert.equal(isClientIngestibleEventName('add_to_cart'), true)
  assert.equal(isClientIngestibleEventName('purchase'), false)
  assert.equal(isClientIngestibleEventName('ORDER_COMPLETED'), false)
  assert.equal(isClientIngestibleEventName('PAYMENT_VERIFIED'), false)
  assert.equal(isClientIngestibleEventName('RISK_ASSESSED'), false)
  assert.equal(hasAnalyticsOrMarketingConsent(base), true)
  assert.equal(hasAnalyticsOrMarketingConsent({
    ...base,
    consent: { necessary: true, analytics: false, marketing: false },
  }), false)
  assert.equal(isSameOriginAnalyticsRequest(
    'https://www.sahigadget.shop/api/analytics',
    'https://www.sahigadget.shop',
    'same-origin',
  ), true)
  assert.equal(isSameOriginAnalyticsRequest(
    'https://www.sahigadget.shop/api/analytics',
    'https://attacker.example',
    'cross-site',
  ), false)
  assert.equal(isSameOriginAnalyticsRequest(
    'https://www.sahigadget.shop/api/analytics',
    'null',
    'cross-site',
  ), false)
  assert.equal(isSameOriginAnalyticsRequest(
    'https://www.sahigadget.shop/api/analytics',
    null,
    'same-origin',
  ), true)
  assert.equal(isSameOriginAnalyticsRequest(
    'https://www.sahigadget.shop/api/analytics',
    null,
    null,
  ), false)
  assert.equal(isSameOriginAnalyticsRequest(
    'https://www.sahigadget.shop/api/analytics',
    null,
    'same-site',
  ), false)

  const oversized = { ...base, pagePath: 'x'.repeat(501) }
  assert.equal(canonicalCommerceEventSchema.safeParse(oversized).success, false)

  const privateQueryUrl = {
    ...base,
    pageUrl: 'https://example.test/product?email=private@example.com&token=secret#fragment',
  }
  assert.equal(sanitizeCommerceEvent(privateQueryUrl).pageUrl, 'https://example.test/product')

  const privateAnalyticsFields = sanitizeCommerceEvent({
    ...base,
    pageUrl: 'https://example.test/verify-order/private-order-token?email=private@example.com',
    pagePath: '/verify-order/private-order-token',
    source: 'campaign-private@example.com',
    commerce: {
      currency: 'BDT',
      search_term: 'call me on 01712345678',
      items: [{ item_id: 'SKU-1', item_name: 'contact buyer@example.com', price: 1200, quantity: 1 }],
    },
  })
  assert.equal(privateAnalyticsFields.pagePath, '/verify-order/[redacted]')
  assert.equal(privateAnalyticsFields.source, '[redacted]')
  assert.equal(privateAnalyticsFields.commerce?.['search_term'], '[redacted]')
  const privateItems = privateAnalyticsFields.commerce?.['items']
  assert.equal(Array.isArray(privateItems) ? (privateItems[0] as Record<string, unknown>).item_name : '', '[redacted]')
  assert.equal(privateAnalyticsFields.pageUrl?.includes('private-order-token'), false)
  assert.equal(privateAnalyticsFields.pageUrl?.includes('private@example.com'), false)

  const unknown = { ...base, unexpected: 'should be rejected' }
  assert.equal(canonicalCommerceEventSchema.safeParse(unknown).success, false)

  const sanitizedCommerce = sanitizeCommerceEvent({
    ...base,
    commerce: {
      transaction_id: 'ORDER-1',
      items: [{
        item_id: 'SKU-1',
        item_name: 'Demo phone',
        price: 1200,
        quantity: 1,
        phone: 'must-not-survive',
      }],
      unexpected_nested: { secret: 'must-not-survive' },
    },
  })
  const sanitizedItems = sanitizedCommerce.commerce?.['items']
  const sanitizedItem = Array.isArray(sanitizedItems)
    ? sanitizedItems[0] as Record<string, unknown>
    : {}
  assert.equal('phone' in sanitizedItem, false)
  assert.equal('unexpected_nested' in (sanitizedCommerce.commerce || {}), false)

  assert.equal(normalizeServerGtmEndpoint('https://gtm.example.com/'), 'https://gtm.example.com')
  assert.equal(isValidServerGtmEndpoint('http://gtm.example.com'), false)
  assert.equal(isValidServerGtmEndpoint('https://gtm.example.com/path?bad=1'), false)

  const envelope = buildServerGtmEnvelope(base, 'demo-store')
  assert.equal(envelope.schema, 'demo-store.analytics.event')
  assert.equal(envelope.event.id, base.eventId)

  assert.equal(normalizeAnalyticsProjectKey(' Demo_Store '), 'demo_store')
  assert.equal(normalizeAnalyticsProjectKey('bad project!'), 'commerce')
  assert.equal(normalizeAnalyticsCurrency('bdt'), 'BDT')
  assert.equal(normalizeAnalyticsCurrency('BD'), 'USD')
  assert.equal(analyticsEventSchema('demo-store'), 'demo-store.analytics.event')

  const ga4Payload = buildGa4MeasurementPayload(base)
  const ga4EventParams = ga4Payload.events[0].params as Record<string, unknown>
  assert.match(ga4Payload.client_id, /^\d+\.\d+$/)
  assert.match(String(ga4EventParams.session_id), /^\d+$/)

  // GA4's validation endpoint can return HTTP 200 with validation errors.
  const validGa4Response = interpretGa4ValidationResponse({
    ok: true, latency: 8, status: 200,
    responseBody: '{"validationMessages":[]}', attempts: 1,
  })
  assert.equal(validGa4Response.ok, true)

  const invalidGa4Response = interpretGa4ValidationResponse({
    ok: true, latency: 8, status: 200,
    responseBody: '{"validationMessages":[{"fieldPath":"events[0].name","description":"Unexpected event"}]}',
    attempts: 1,
  })
  assert.equal(invalidGa4Response.ok, false)
  assert.equal(invalidGa4Response.category, 'HTTP_ERROR')

  const malformedGa4Response = interpretGa4ValidationResponse({
    ok: true, latency: 8, status: 200, responseBody: '{}', attempts: 1,
  })
  assert.equal(malformedGa4Response.ok, false)

  const failedGa4Response = interpretGa4ValidationResponse({
    ok: false, latency: 10, status: 500, category: 'HTTP_ERROR',
    attempts: 1, responseBody: 'server error',
  })
  assert.equal(failedGa4Response.ok, false)

  assert.equal(isLiveProviderDispatchAllowed(true), false)
  assert.equal(isLiveProviderDispatchAllowed(false), true)

  const adapterConfig = {
    projectKey: 'demo-store',
    currency: 'USD',
    enabled: true,
    marketingEnabled: true,
    consentMode: 'advanced' as const,
    debugMode: true,
    ga4MeasurementId: 'G-DEMO',
    gtmContainerId: 'GTM-DEMO',
    metaPixelId: '123',
    metaCapiEnabled: true,
    tiktokPixelId: 'TT-DEMO',
    tiktokEventsApiEnabled: true,
    serverGtmEnabled: true,
    serverGtmEndpoint: 'https://gtm.example.com',
    environment: 'production' as const,
    eventControls: {},
  }

  for (const provider of ['GA4', 'META_CAPI', 'TIKTOK_EVENTS_API', 'SERVER_GTM'] as const) {
    assert.ok(ANALYTICS_PROVIDER_ADAPTERS[provider])
    assert.equal(
      ANALYTICS_PROVIDER_ADAPTERS[provider].canDispatch({ ...base, testMode: true }, adapterConfig),
      false,
    )
  }

  // Defense-in-depth worker guard: an invalid event/provider pair must be permanently ineligible.
  assert.equal(
    isAnalyticsDeliveryPermanentlyIneligible(
      base,
      'SERVER_GTM',
      adapterConfig,
    ),
    true,
  )

  // Safe test events are never treated as live provider deliveries.
  assert.equal(
    isAnalyticsDeliveryPermanentlyIneligible(
      { ...base, testMode: true },
      'GA4',
      adapterConfig,
    ),
    true,
  )

  // Missing consent is permanently ineligible; a configured but disabled optional event is too.
  assert.equal(
    isAnalyticsDeliveryPermanentlyIneligible(
      { ...base, consent: { necessary: true, analytics: false, marketing: false } },
      'GA4',
      adapterConfig,
    ),
    true,
  )
  assert.equal(
    isAnalyticsDeliveryPermanentlyIneligible(
      base,
      'GA4',
      { ...adapterConfig, eventControls: { add_to_cart: false } },
    ),
    true,
  )

  const previewConfig = safeAnalyticsConfigForEnvironment({
    ...adapterConfig,
    enabled: true,
    marketingEnabled: true,
    ga4MeasurementId: 'G-LIVE',
    gtmContainerId: 'GTM-LIVE',
    metaPixelId: '2040714466673633,1052046197788557',
    metaCapiEnabled: true,
    tiktokPixelId: 'TT-LIVE',
    tiktokEventsApiEnabled: true,
    serverGtmEnabled: true,
    serverGtmEndpoint: 'https://gtm.example.com',
  }, 'preview')
  assert.equal(previewConfig.enabled, false)
  assert.equal(previewConfig.marketingEnabled, false)
  assert.equal(previewConfig.ga4MeasurementId, '')
  assert.equal(previewConfig.gtmContainerId, '')
  assert.equal(previewConfig.metaPixelId, '')
  assert.equal(previewConfig.metaCapiEnabled, false)
  assert.equal(previewConfig.tiktokPixelId, '')
  assert.equal(previewConfig.tiktokEventsApiEnabled, false)
  assert.equal(previewConfig.serverGtmEnabled, false)

  const productionConfig = safeAnalyticsConfigForEnvironment(adapterConfig, 'production')
  assert.equal(productionConfig.enabled, true)
  assert.equal(productionConfig.metaPixelId, '123')

  const browserConfig = { ...adapterConfig, eventControls: { add_to_cart: true, purchase: true } }
  assert.equal(isBrowserAnalyticsEventEnabled('add_to_cart', browserConfig), true)
  assert.equal(isBrowserAnalyticsEventEnabled('add_to_cart', { ...browserConfig, eventControls: { add_to_cart: false } }), false)
  assert.equal(isBrowserAnalyticsEventEnabled('purchase', { ...browserConfig, eventControls: { purchase: false } }), true)

  // Browser provider allowlists prevent internal lifecycle events from going to Meta.
  assert.equal(isBrowserProviderEventAllowed('META_PIXEL', 'add_to_cart'), true)
  assert.equal(isBrowserProviderEventAllowed('META_PIXEL', 'purchase'), true)
  assert.equal(isBrowserProviderEventAllowed('META_PIXEL', 'RISK_ASSESSED'), false)
  assert.equal(isBrowserProviderEventAllowed('GTM', 'RISK_ASSESSED'), true)

  // Never send page views from administration, auth, or tokenized verification routes.
  assert.equal(isAnalyticsPageViewPathAllowed('/'), true)
  assert.equal(isAnalyticsPageViewPathAllowed('/products/nokia-2720-flip'), true)
  assert.equal(isAnalyticsPageViewPathAllowed('/admin/dashboard'), false)
  assert.equal(isAnalyticsPageViewPathAllowed('/auth/callback'), false)
  assert.equal(isAnalyticsPageViewPathAllowed('/verify-order/private-token'), false)

  // Meta must initialize each configured pixel once and dispatch only once per pixel.
  assert.deepEqual(
    getMetaPixelIds(' 2040714466673633, 1052046197788557 2040714466673633 '),
    ['2040714466673633', '1052046197788557'],
  )
  assert.deepEqual(
    getMetaPixelIds(' ,  , '),
    [],
  )
  assert.deepEqual(
    buildMetaPixelInitArgs('2040714466673633'),
    [
      ['set', 'autoConfig', false, '2040714466673633'],
      ['init', '2040714466673633'],
    ],
  )
  assert.deepEqual(
    buildMetaPixelEventData(base),
    {
      currency: 'BDT',
      value: 1200,
      content_ids: ['SKU-1'],
      content_type: 'product',
      contents: [{ id: 'SKU-1', quantity: 1, item_price: 1200 }],
      num_items: 1,
      content_name: 'Demo phone',
    },
  )
  assert.deepEqual(
    buildMetaPixelTrackSingleArgs('2040714466673633', 'AddToCart', base),
    [
      'trackSingle',
      '2040714466673633',
      'AddToCart',
      {
        currency: 'BDT',
        value: 1200,
        content_ids: ['SKU-1'],
        content_type: 'product',
        contents: [{ id: 'SKU-1', quantity: 1, item_price: 1200 }],
        num_items: 1,
        content_name: 'Demo phone',
      },
      { eventID: base.eventId },
    ],
  )

  const privateSearch = buildMetaPixelEventData({
    ...base,
    eventName: 'search',
    commerce: { search_term: 'call me on 01712345678', currency: 'BDT' },
  })
  assert.equal('search_string' in privateSearch, false)

  assert.equal(ANALYTICS_MAX_DELIVERY_ATTEMPTS, 8)

  console.log('analytics contract tests passed')
  console.log('analytics worker eligibility guards passed')
  console.log('live provider dispatch policy tests passed')
  console.log('provider adapter registry tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
