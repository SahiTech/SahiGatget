import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret } from './secrets'
import type { CreateShipmentInput, CreateShipmentResult, ShipmentStatus, TrackingResult } from './contracts'

export const STEADFAST_BASE_URL = 'https://portal.packzy.com/api/v1'

type Credentials = { apiKey: string; secretKey: string; baseUrl: string }

async function getCredentials(): Promise<Credentials> {
  const db = createAdminClient()
  const { data, error } = await db.from('delivery_provider_credentials').select('base_url,encrypted_api_key,encrypted_secret_key').eq('provider', 'STEADFAST').maybeSingle()
  if (error || !data?.encrypted_api_key || !data.encrypted_secret_key) throw new Error('Steadfast credentials are not configured.')
  return { apiKey: decryptSecret(data.encrypted_api_key), secretKey: decryptSecret(data.encrypted_secret_key), baseUrl: data.base_url || STEADFAST_BASE_URL }
}

async function steadfastRequest(path: string, init: RequestInit = {}) {
  const credentials = await getCredentials()
  const headers = new Headers(init.headers)
  headers.set('Api-Key', credentials.apiKey)
  headers.set('Secret-Key', credentials.secretKey)
  headers.set('Content-Type', 'application/json')
  const response = await fetch(`${credentials.baseUrl}${path}`, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(15000) })
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = { raw: text } }
  if (!response.ok) throw new Error(`Steadfast API ${response.status}: ${typeof body === 'object' && body && 'message' in body ? String((body as { message?: unknown }).message) : 'Request failed'}`)
  return body as any
}

export async function testSteadfastConnection() {
  const result = await steadfastRequest('/get_balance')
  return { ok: Number(result?.status) === 200, balance: result?.current_balance ?? null }
}

function mapStatus(value: unknown): ShipmentStatus {
  const status = String(value ?? '').toLowerCase()
  if (status === 'delivered' || status === 'partial_delivered') return 'DELIVERED'
  if (status === 'cancelled' || status === 'cancelled_approval_pending') return 'CANCELLED'
  if (status === 'hold') return 'EXCEPTION'
  if (status === 'pending' || status === 'in_review') return 'CREATED'
  return 'IN_TRANSIT'
}

export async function createSteadfastOrder(input: CreateShipmentInput): Promise<CreateShipmentResult> {
  const payload = {
    invoice: input.order.orderNumber,
    recipient_name: input.order.customer.name,
    recipient_phone: input.order.customer.phone,
    recipient_email: input.order.customer.email ?? undefined,
    recipient_address: [input.order.customer.address, input.order.customer.area, input.order.customer.district, input.order.customer.division, input.order.customer.postalCode].filter(Boolean).join(', ').slice(0, 250),
    cod_amount: Math.max(0, Number(input.parcel.codAmount)),
    note: undefined,
    item_description: input.parcel.itemDescription.slice(0, 500),
    total_lot: input.parcel.quantity,
    delivery_type: 0,
  }
  const result = await steadfastRequest('/create_order', { method: 'POST', body: JSON.stringify(payload) })
  const consignment = result?.consignment
  if (!consignment?.consignment_id) throw new Error('Steadfast did not return a consignment ID.')
  return { providerShipmentId: String(consignment.consignment_id), trackingNumber: consignment.tracking_code ? String(consignment.tracking_code) : null, labelReference: null, status: mapStatus(consignment.status), raw: result }
}

export async function trackSteadfastShipment(trackingNumber: string): Promise<TrackingResult> {
  const result = await steadfastRequest(`/status_by_trackingcode/${encodeURIComponent(trackingNumber)}`)
  return { providerShipmentId: String(result?.consignment_id ?? trackingNumber), trackingNumber, status: mapStatus(result?.delivery_status), statusText: result?.delivery_status ?? null, raw: result }
}

export async function normalizeSteadfastWebhook(payload: any, headers: Headers) {
  const auth = headers.get('authorization') ?? ''
  const db = createAdminClient()
  const { data } = await db.from('delivery_provider_credentials').select('encrypted_webhook_token').eq('provider', 'STEADFAST').maybeSingle()
  if (!data?.encrypted_webhook_token) throw new Error('Steadfast webhook token is not configured.')
  const expected = `Bearer ${decryptSecret(data.encrypted_webhook_token)}`
  if (auth !== expected) throw new Error('Invalid Steadfast webhook authorization.')
  const providerEventId = `${payload?.notification_type ?? 'event'}:${payload?.consignment_id ?? payload?.invoice ?? payload?.updated_at ?? crypto.randomUUID()}`
  return { provider: 'STEADFAST' as const, providerEventId, providerShipmentId: payload?.consignment_id ? String(payload.consignment_id) : null, trackingNumber: payload?.tracking_code ? String(payload.tracking_code) : null, status: mapStatus(payload?.status), occurredAt: payload?.updated_at ? String(payload.updated_at) : null, payload }
}
