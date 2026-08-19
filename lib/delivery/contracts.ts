import type { Json } from '@/lib/types/database'

export const DELIVERY_PROVIDERS = ['PATHAO', 'STEADFAST', 'REDX', 'CARRYBEE', 'ECOURIER'] as const
export type DeliveryProviderCode = (typeof DELIVERY_PROVIDERS)[number]

export const DELIVERY_CAPABILITIES = [
  'CREATE_SHIPMENT',
  'BULK_CREATE',
  'TRACK_SHIPMENT',
  'CANCEL_SHIPMENT',
  'REQUEST_RETURN',
  'GET_RETURN_STATUS',
  'WEBHOOK',
  'GET_BALANCE',
  'GET_SETTLEMENT',
  'GENERATE_LABEL',
] as const
export type DeliveryCapability = (typeof DELIVERY_CAPABILITIES)[number]

export const SHIPMENT_STATUSES = [
  'DRAFT',
  'READY',
  'CREATED',
  'PICKUP_PENDING',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_FAILED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURN_IN_TRANSIT',
  'RETURNED',
  'EXCEPTION',
] as const
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number]

export const DELIVERY_CONNECTION_STATES = ['NOT_CONNECTED', 'CONNECTED', 'DEGRADED', 'DISABLED'] as const
export type DeliveryConnectionState = (typeof DELIVERY_CONNECTION_STATES)[number]

export type DeliveryRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'NOT_ASSESSED'

export type DeliveryAddress = {
  name: string
  phone: string
  email?: string | null
  division: string
  district: string
  area: string
  address: string
  postalCode?: string | null
}

export type ShipmentOrderSnapshot = {
  orderId: string
  orderNumber: string
  customer: DeliveryAddress
  itemCount: number
  totalAmount: number
  paymentMethod: string
  orderStatus: string
}

export type CreateShipmentInput = {
  idempotencyKey: string
  order: ShipmentOrderSnapshot
  parcel: {
    weightGrams?: number | null
    itemDescription: string
    quantity: number
    codAmount: number
  }
}

export type CreateShipmentResult = {
  providerShipmentId: string
  trackingNumber: string | null
  labelReference: string | null
  status: ShipmentStatus
  raw?: Json
}

export type TrackingResult = {
  providerShipmentId: string
  trackingNumber: string | null
  status: ShipmentStatus
  statusText?: string | null
  occurredAt?: string | null
  raw?: Json
}

export type NormalizedWebhookEvent = {
  provider: DeliveryProviderCode
  providerEventId: string
  providerShipmentId: string | null
  trackingNumber: string | null
  status: ShipmentStatus | null
  occurredAt: string | null
  payload: Json
}

export type DeliveryAdapter = {
  provider: DeliveryProviderCode
  capabilities: ReadonlySet<DeliveryCapability>
  testConnection(): Promise<{ ok: boolean; message: string }>
  createShipment?(input: CreateShipmentInput): Promise<CreateShipmentResult>
  bulkCreateShipment?(inputs: readonly CreateShipmentInput[]): Promise<readonly CreateShipmentResult[]>
  trackShipment?(trackingNumber: string): Promise<TrackingResult>
  cancelShipment?(providerShipmentId: string): Promise<{ ok: boolean; message: string }>
  requestReturn?(providerShipmentId: string, reason: string): Promise<{ ok: boolean; message: string }>
  getReturnStatus?(providerShipmentId: string): Promise<TrackingResult>
  normalizeWebhook?(payload: Json, headers: Headers): Promise<NormalizedWebhookEvent>
  generateLabel?(providerShipmentId: string): Promise<{ labelReference: string; raw?: Json }>
}

export type DeliveryProviderRecord = {
  provider: DeliveryProviderCode
  displayName: string
  connectionState: DeliveryConnectionState
  capabilities: Partial<Record<DeliveryCapability, 'SUPPORTED' | 'NOT_SUPPORTED' | 'UNVERIFIED'>>
  isEnabled: boolean
  metadata: Json
}

export type DeliveryRecommendation = {
  provider: DeliveryProviderCode | null
  confidence: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'
  reason: string
  alternatives: DeliveryProviderCode[]
  riskLevel: DeliveryRiskLevel
}

export type BulkDispatchItemResult = {
  orderId: string
  provider: DeliveryProviderCode | null
  outcome: 'SUCCESS' | 'FAILED' | 'DUPLICATE' | 'NEEDS_REVIEW'
  shipmentId?: string | null
  message: string
}
