import type { DeliveryCapability, DeliveryProviderCode } from './contracts'

export type ProviderReadiness = 'READY_FOR_CREDENTIALS' | 'NOT_IMPLEMENTED'
export type ProviderCatalogEntry = { provider: DeliveryProviderCode; displayName: string; readiness: ProviderReadiness; officialDocsUrl: string; capabilities: readonly DeliveryCapability[]; notes: string }

export const DELIVERY_PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  { provider: 'PATHAO', displayName: 'Pathao', readiness: 'READY_FOR_CREDENTIALS', officialDocsUrl: 'https://merchant.pathao.com/', capabilities: ['CREATE_SHIPMENT'], notes: 'Production single-order creation is implemented; additional capabilities are advertised only after runtime verification.' },
  { provider: 'STEADFAST', displayName: 'Steadfast', readiness: 'READY_FOR_CREDENTIALS', officialDocsUrl: 'https://steadfast.com.bd/', capabilities: ['CREATE_SHIPMENT', 'TRACK_SHIPMENT', 'WEBHOOK', 'GET_BALANCE'], notes: 'Implemented against the documented v1 API: create order, tracking, balance readiness, and bearer-authenticated webhook normalization. Credentials and merchant webhook setup are still required.' },
  { provider: 'REDX', displayName: 'REDX', readiness: 'READY_FOR_CREDENTIALS', officialDocsUrl: 'https://redx.com.bd/developer-api/', capabilities: ['CREATE_SHIPMENT', 'TRACK_SHIPMENT', 'WEBHOOK'], notes: 'Official developer documentation is available; merchant credentials and runtime adapter verification are still required.' },
  { provider: 'CARRYBEE', displayName: 'CarryBee', readiness: 'NOT_IMPLEMENTED', officialDocsUrl: 'https://carrybee.com/', capabilities: [], notes: 'No verified implementation is enabled yet.' },
  { provider: 'ECOURIER', displayName: 'eCourier', readiness: 'NOT_IMPLEMENTED', officialDocsUrl: 'https://ecourier.com.bd/', capabilities: [], notes: 'No verified implementation is enabled yet.' },
]

export const providerCatalogByCode = new Map(DELIVERY_PROVIDER_CATALOG.map((entry) => [entry.provider, entry]))
export function mergeProviderCatalog<T extends { provider: string; capabilities?: Record<string, string>; connection_state?: string; is_enabled?: boolean }>(provider: T) {
  const catalog = providerCatalogByCode.get(provider.provider as DeliveryProviderCode)
  return { ...provider, catalogCapabilities: catalog?.capabilities ?? [], readiness: catalog?.readiness ?? 'NOT_IMPLEMENTED', officialDocsUrl: catalog?.officialDocsUrl ?? null, notes: catalog?.notes ?? 'Provider capability is not verified.', credentialsRequired: provider.connection_state !== 'CONNECTED' || !provider.is_enabled }
}
