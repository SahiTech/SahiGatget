import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret } from './secrets'
import type { CreateShipmentInput, CreateShipmentResult, ShipmentStatus, TrackingResult } from './contracts'

export const REDX_BASE_URL = 'https://openapi.redx.com.bd/v1.0.0-beta'

type Credentials = { token: string; webhookToken?: string | null; baseUrl: string }

async function getCredentials(): Promise<Credentials> {
  const db = createAdminClient()
  const { data, error } = await db.from('delivery_provider_credentials').select('base_url,encrypted_api_key,encrypted_webhook_token').eq('provider', 'REDX').maybeSingle()
  if (error || !data?.encrypted_api_key) throw new Error('REDX production API token is not configured.')
  return {
    token: decryptSecret(data.encrypted_api_key).replace(/^Bearer\s+/i, '').trim(),
    webhookToken: data.encrypted_webhook_token ? decryptSecret(data.encrypted_webhook_token) : null,
    baseUrl: data.base_url || REDX_BASE_URL,
  }
}

async function redxRequest(path: string, init: RequestInit = {}) {
  const credentials = await getCredentials()
  const headers = new Headers(init.headers)
  headers.set('API-ACCESS-TOKEN', `Bearer ${credentials.token}`)
  headers.set('Content-Type', 'application/json')
  const response = await fetch(`${credentials.baseUrl}${path}`, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(15000) })
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = { raw: text } }
  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body ? String((body as { message?: unknown }).message) : `HTTP ${response.status}`
    throw new Error(`REDX API ${response.status}: ${message}`)
  }
  return body as any
}

export async function listRedxAreas(postCode?: string, districtName?: string) {
  const query = postCode ? `?post_code=${encodeURIComponent(postCode)}` : districtName ? `?district_name=${encodeURIComponent(districtName)}` : ''
  const result = await redxRequest(`/areas${query}`)
  return Array.isArray(result?.areas) ? result.areas : []
}

export async function listRedxPickupStores() {
  const result = await redxRequest('/pickup/stores')
  return Array.isArray(result?.pickup_stores) ? result.pickup_stores : []
}

export async function getRedxPickupStoreInfo(pickupStoreId: number) {
  const result = await redxRequest(`/pickup/store/info/${encodeURIComponent(String(pickupStoreId))}`)
  return result?.pickup_store ?? null
}

export async function calculateRedxCharge(input: { deliveryAreaId: number; pickupAreaId: number; cashCollectionAmount: number; weightGrams: number }) {
  const params = new URLSearchParams({ delivery_area_id: String(input.deliveryAreaId), pickup_area_id: String(input.pickupAreaId), cash_collection_amount: String(Math.max(0, input.cashCollectionAmount)), weight: String(input.weightGrams) })
  return redxRequest(`/charge/charge_calculator?${params.toString()}`)
}

export async function testRedxConnection() {
  const stores = await listRedxPickupStores()
  const areas = await listRedxAreas()
  return { ok: stores.length > 0 && areas.length > 0, stores, areas, message: stores.length > 0 ? `REDX connected. ${stores.length} pickup store(s) available.` : 'REDX API authenticated but no pickup store was returned.' }
}

function mapStatus(value: unknown): ShipmentStatus {
  const status = String(value ?? '').toLowerCase().trim()
  if (status === 'delivered' || status === 'paid') return 'DELIVERED'
  if (status === 'returned' || status === 'agent-returning') return 'RETURNED'
  if (status === 'delivery-in-progress') return 'OUT_FOR_DELIVERY'
  if (status === 'ready-for-delivery' || status === 'agent-hold' || status === 'agent-area-change') return 'IN_TRANSIT'
  if (status === 'cancelled' || status === 'canceled') return 'CANCELLED'
  if (status === 'failed' || status === 'delivery-failed') return 'DELIVERY_FAILED'
  if (status === 'pickup-pending') return 'PICKUP_PENDING'
  if (status === 'picked-up' || status === 'pickup') return 'PICKED_UP'
  return 'CREATED'
}

export async function createRedxParcel(input: CreateShipmentInput & { deliveryArea: string; deliveryAreaId: number; pickupStoreId?: number | null; declaredValue?: number }): Promise<CreateShipmentResult> {
  const stores = await listRedxPickupStores()
  const pickupStore = input.pickupStoreId ? stores.find((store: any) => Number(store.id) === Number(input.pickupStoreId)) : stores[0]
  const payload: Record<string, unknown> = {
    customer_name: input.order.customer.name,
    customer_phone: input.order.customer.phone,
    delivery_area: input.deliveryArea,
    delivery_area_id: input.deliveryAreaId,
    customer_address: [input.order.customer.address, input.order.customer.area, input.order.customer.district, input.order.customer.division, input.order.customer.postalCode].filter(Boolean).join(', ').slice(0, 220),
    merchant_invoice_id: input.order.orderNumber,
    cash_collection_amount: Math.max(0, Number(input.parcel.codAmount)),
    parcel_weight: Math.max(500, Math.round(Number(input.parcel.weightGrams ?? 500))),
    instruction: input.parcel.itemDescription.slice(0, 500),
    value: Math.max(0, Number(input.declaredValue ?? input.order.totalAmount ?? 0)),
    is_closed_box: 'true',
    parcel_details_json: [{ name: input.parcel.itemDescription.slice(0, 150), category: 'General', value: Math.max(0, Number(input.declaredValue ?? input.order.totalAmount ?? 0)) }],
  }
  if (pickupStore?.id) payload.pickup_store_id = Number(pickupStore.id)
  const result = await redxRequest('/parcel', { method: 'POST', body: JSON.stringify(payload) })
  if (!result?.tracking_id) throw new Error('REDX did not return a tracking ID.')
  return { providerShipmentId: String(result.tracking_id), trackingNumber: String(result.tracking_id), labelReference: null, status: 'CREATED', raw: { result, pickupStore } }
}

export async function trackRedxParcel(trackingNumber: string): Promise<TrackingResult> {
  const result = await redxRequest(`/parcel/track/${encodeURIComponent(trackingNumber)}`)
  const tracking = Array.isArray(result?.tracking) ? result.tracking : []
  const latest = tracking[tracking.length - 1]
  return { providerShipmentId: trackingNumber, trackingNumber, status: mapStatus(latest?.status ?? latest?.message_en), statusText: latest?.message_en ?? latest?.message_bn ?? null, occurredAt: latest?.time ?? null, raw: result }
}

export async function getRedxParcelInfo(trackingNumber: string) {
  const result = await redxRequest(`/parcel/info/${encodeURIComponent(trackingNumber)}`)
  return result?.parcel ?? null
}

export async function normalizeRedxWebhook(payload: any, requestUrl: string) {
  const credentials = await getCredentials()
  if (!credentials.webhookToken) throw new Error('REDX webhook token is not configured.')
  const supplied = new URL(requestUrl).searchParams.get('token') ?? ''
  if (!supplied || supplied !== credentials.webhookToken) throw new Error('Invalid REDX webhook token.')
  const providerShipmentId = payload?.tracking_number ? String(payload.tracking_number) : null
  const providerEventId = `redx:${providerShipmentId ?? payload?.invoice_number ?? 'event'}:${payload?.timestamp ?? payload?.status ?? crypto.randomUUID()}`
  return { provider: 'REDX' as const, providerEventId, providerShipmentId, trackingNumber: providerShipmentId, status: mapStatus(payload?.status), occurredAt: payload?.timestamp ? String(payload.timestamp) : null, payload }
}
