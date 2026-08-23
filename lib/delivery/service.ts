import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/types/database'
import type {
  BulkDispatchItemResult,
  CreateShipmentInput,
  DeliveryAdapter,
  DeliveryCapability,
  DeliveryProviderCode,
  DeliveryProviderRecord,
  DeliveryRecommendation,
  DeliveryRiskLevel,
  NormalizedWebhookEvent,
  ShipmentStatus,
  TrackingResult,
} from './contracts'
import { DELIVERY_CAPABILITIES, DELIVERY_PROVIDERS } from './contracts'
import { pathaoDeliveryAdapter } from './pathao-adapter'

export class DeliveryError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_CONNECTED' | 'NOT_SUPPORTED' | 'INVALID_STATE' | 'DUPLICATE' | 'PROVIDER_ERROR' | 'CONFIGURATION_ERROR',
    readonly retryable = false,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'DeliveryError'
  }
}

const adapters = new Map<DeliveryProviderCode, DeliveryAdapter>()

export function registerDeliveryAdapter(adapter: DeliveryAdapter) {
  adapters.set(adapter.provider, adapter)
}

export function getDeliveryAdapter(provider: DeliveryProviderCode) {
  return adapters.get(provider) ?? null
}

export function listRegisteredDeliveryAdapters() {
  return [...adapters.values()]
}

registerDeliveryAdapter(pathaoDeliveryAdapter)

export function assertCapability(adapter: DeliveryAdapter, capability: DeliveryCapability) {
  if (!adapter.capabilities.has(capability)) throw new DeliveryError(`${adapter.provider} does not support ${capability}.`, 'NOT_SUPPORTED')
}

export async function listDeliveryProviders(): Promise<DeliveryProviderRecord[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('delivery_providers')
    .select('provider,display_name,connection_state,capabilities,is_enabled,metadata')
    .order('display_name')
  if (error) throw new DeliveryError('Unable to load delivery providers.', 'PROVIDER_ERROR', true, error)
  const configured = new Map((data ?? []).map((row) => [row.provider as DeliveryProviderCode, row]))
  return DELIVERY_PROVIDERS.map((provider) => {
    const row = configured.get(provider)
    return {
      provider,
      displayName: row?.display_name ?? provider,
      connectionState: row?.connection_state ?? 'NOT_CONNECTED',
      capabilities: row?.capabilities ?? Object.fromEntries(DELIVERY_CAPABILITIES.map((item) => [item, 'UNVERIFIED'])),
      isEnabled: row?.is_enabled ?? false,
      metadata: (row?.metadata ?? {}) as Json,
    }
  })
}

export async function createShipment(provider: DeliveryProviderCode, input: CreateShipmentInput) {
  const adapter = getDeliveryAdapter(provider)
  if (!adapter) throw new DeliveryError(`${provider} is not connected.`, 'NOT_CONNECTED')
  assertCapability(adapter, 'CREATE_SHIPMENT')
  if (!adapter.createShipment) throw new DeliveryError(`${provider} createShipment is not implemented.`, 'NOT_SUPPORTED')
  return adapter.createShipment(input)
}

export async function trackShipment(provider: DeliveryProviderCode, trackingNumber: string): Promise<TrackingResult> {
  const adapter = getDeliveryAdapter(provider)
  if (!adapter) throw new DeliveryError(`${provider} is not connected.`, 'NOT_CONNECTED')
  assertCapability(adapter, 'TRACK_SHIPMENT')
  if (!adapter.trackShipment) throw new DeliveryError(`${provider} tracking is not implemented.`, 'NOT_SUPPORTED')
  return adapter.trackShipment(trackingNumber)
}

export async function processWebhook(provider: DeliveryProviderCode, payload: Json, headers: Headers): Promise<NormalizedWebhookEvent> {
  const adapter = getDeliveryAdapter(provider)
  if (!adapter) throw new DeliveryError(`${provider} is not connected.`, 'NOT_CONNECTED')
  assertCapability(adapter, 'WEBHOOK')
  if (!adapter.normalizeWebhook) throw new DeliveryError(`${provider} webhook normalization is not implemented.`, 'NOT_SUPPORTED')
  return adapter.normalizeWebhook(payload, headers)
}

export async function recommendCourier(input: { destination: Pick<CreateShipmentInput['order']['customer'], 'division' | 'district' | 'area'>; codAmount: number; riskLevel?: DeliveryRiskLevel }): Promise<DeliveryRecommendation> {
  const providers = await listDeliveryProviders()
  const connected = providers.filter((provider) => provider.isEnabled && provider.connectionState === 'CONNECTED' && provider.capabilities.CREATE_SHIPMENT === 'SUPPORTED')
  if (!connected.length) return { provider: null, confidence: 'NONE', reason: 'Not enough connected courier data to recommend a provider.', alternatives: [], riskLevel: input.riskLevel ?? 'NOT_ASSESSED' }
  return {
    provider: connected[0].provider,
    confidence: 'LOW',
    reason: 'Recommendation is based only on connected-provider availability; historical delivery data is not sufficient yet.',
    alternatives: connected.slice(1).map((provider) => provider.provider),
    riskLevel: input.riskLevel ?? 'NOT_ASSESSED',
  }
}

export async function dispatchBulk(inputs: readonly { orderId: string; provider: DeliveryProviderCode; shipment: CreateShipmentInput }[]): Promise<readonly BulkDispatchItemResult[]> {
  const results: BulkDispatchItemResult[] = []
  for (const item of inputs) {
    try {
      const shipment = await createShipment(item.provider, item.shipment)
      results.push({ orderId: item.orderId, provider: item.provider, outcome: 'SUCCESS', shipmentId: shipment.providerShipmentId, message: 'Shipment created.' })
    } catch (error) {
      const deliveryError = error instanceof DeliveryError ? error : new DeliveryError('Shipment creation failed.', 'PROVIDER_ERROR', true, error instanceof Error ? error : undefined)
      results.push({ orderId: item.orderId, provider: item.provider, outcome: deliveryError.code === 'DUPLICATE' ? 'DUPLICATE' : 'FAILED', message: deliveryError.message })
    }
  }
  return results
}

export type { ShipmentStatus }
