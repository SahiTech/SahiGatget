import type { DeliveryCapability, DeliveryProviderCode } from './contracts'

export type ProviderReadiness = 'READY_FOR_CREDENTIALS' | 'NOT_IMPLEMENTED'

export type ProviderCatalogEntry = {
  provider: DeliveryProviderCode
  displayName: string
  readiness: ProviderReadiness
  officialDocsUrl: string
  capabilities: readonly DeliveryCapability[]
  notes: string
}

/**
 * Capability truth is intentionally conservative. A capability is listed only
 * when the public provider documentation supports the shape of the operation;
 * merchant credentials are still required before any network call.
 */
export const DELIVERY_PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  {
    provider: 'PATHAO',
    displayName: 'Pathao',
    readiness: 'READY_FOR_CREDENTIALS',
    officialDocsUrl: 'https://merchant.pathao.com/',
    capabilities: [],
    notes: 'Merchant onboarding, tracking, price calculation, COD, and reverse logistics are documented; API contract requires merchant access before implementation.',
  },
  {
    provider: 'STEADFAST',
    displayName: 'Steadfast',
    readiness: 'READY_FOR_CREDENTIALS',
    officialDocsUrl: 'https://steadfast.com.bd/',
    capabilities: [],
    notes: 'Merchant onboarding and real-time tracking are documented; API endpoints and credentials require merchant access.',
  },
  {
    provider: 'REDX',
    displayName: 'REDX',
    readiness: 'READY_FOR_CREDENTIALS',
    officialDocsUrl: 'https://redx.com.bd/developer-api/',
    capabilities: ['CREATE_SHIPMENT', 'TRACK_SHIPMENT', 'WEBHOOK'],
    notes: 'Official developer documentation exposes sandbox/production APIs for parcel creation, tracking, updates, and webhooks. Merchant token and area/pickup configuration are still required.',
  },
  {
    provider: 'CARRYBEE',
    displayName: 'CarryBee',
    readiness: 'NOT_IMPLEMENTED',
    officialDocsUrl: 'https://carrybee.com/',
    capabilities: [],
    notes: 'No verified official API contract was available in this phase.',
  },
  {
    provider: 'ECOURIER',
    displayName: 'eCourier',
    readiness: 'NOT_IMPLEMENTED',
    officialDocsUrl: 'https://ecourier.com.bd/',
    capabilities: [],
    notes: 'No verified official API contract was available in this phase.',
  },
]

export const providerCatalogByCode = new Map(DELIVERY_PROVIDER_CATALOG.map((entry) => [entry.provider, entry]))

export function mergeProviderCatalog<T extends { provider: string; capabilities?: Record<string, string>; connection_state?: string; is_enabled?: boolean }>(provider: T) {
  const catalog = providerCatalogByCode.get(provider.provider as DeliveryProviderCode)
  return {
    ...provider,
    catalogCapabilities: catalog?.capabilities ?? [],
    readiness: catalog?.readiness ?? 'NOT_IMPLEMENTED',
    officialDocsUrl: catalog?.officialDocsUrl ?? null,
    notes: catalog?.notes ?? 'Provider capability is not verified.',
    credentialsRequired: provider.connection_state !== 'CONNECTED' || !provider.is_enabled,
  }
}
