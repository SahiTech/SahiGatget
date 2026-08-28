import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret } from './secrets'
import type { CreateShipmentInput, CreateShipmentResult, ShipmentStatus, TrackingResult } from './contracts'

export const ECOURIER_BASE_URL = 'https://backoffice.ecourier.com.bd/api'

type Credentials = { apiKey: string; apiSecret: string; userId: string; baseUrl: string }

async function getCredentials(): Promise<Credentials> {
  const db = createAdminClient()
  const { data, error } = await db.from('delivery_provider_credentials').select('base_url,encrypted_api_key,encrypted_secret_key,encrypted_user_id').eq('provider', 'ECOURIER').maybeSingle()
  if (error || !data?.encrypted_api_key || !data.encrypted_secret_key || !data.encrypted_user_id) throw new Error('eCourier API Key, API Secret and User ID are not configured.')
  return { apiKey: decryptSecret(data.encrypted_api_key), apiSecret: decryptSecret(data.encrypted_secret_key), userId: decryptSecret(data.encrypted_user_id), baseUrl: data.base_url || ECOURIER_BASE_URL }
}

async function request(path: string, body: Record<string, unknown>) {
  const credentials = await getCredentials()
  const response = await fetch(`${credentials.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'API-SECRET': credentials.apiSecret,
      'API-KEY': credentials.apiKey,
      'USER-ID': credentials.userId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const text = await response.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  if (!response.ok || Number(data?.response_code ?? response.status) >= 400) throw new Error(`eCourier API ${response.status}: ${Array.isArray(data?.errors) ? data.errors.join(' ') : data?.message ?? 'Request failed'}`)
  return data
}

export async function testECourierConnection() {
  const data = await request('/packages', {})
  return { ok: Array.isArray(data) || Array.isArray(data?.message), packageCount: Array.isArray(data) ? data.length : Array.isArray(data?.message) ? data.message.length : 0 }
}

function mapStatus(value: unknown): ShipmentStatus {
  const status = String(value ?? '').toLowerCase()
  if (status.includes('delivered')) return 'DELIVERED'
  if (status.includes('picked')) return 'PICKED_UP'
  if (status.includes('destination') || status.includes('transit') || status.includes('way to')) return 'IN_TRANSIT'
  if (status.includes('cancel')) return 'CANCELLED'
  if (status.includes('initiated')) return 'CREATED'
  return 'EXCEPTION'
}

export async function createECourierOrder(input: CreateShipmentInput): Promise<CreateShipmentResult> {
  const customer = input.order.customer
  const items = Math.max(1, input.parcel.quantity)
  const codAmount = Math.max(0, Number(input.parcel.codAmount))
  const paymentMethod = codAmount > 0 ? 'COD' : 'POS'
  const address = [customer.address, customer.area, customer.district, customer.division].filter(Boolean).join(', ').slice(0, 40)
  const result = await request('/order-place', {
    recipient_name: customer.name.slice(0, 250),
    recipient_mobile: customer.phone,
    recipient_city: customer.division || customer.district,
    recipient_thana: customer.area || customer.district,
    recipient_area: customer.area || customer.district,
    recipient_address: address,
    package_code: `#${input.order.orderNumber}`.slice(0, 32),
    product_price: Math.round(codAmount),
    payment_method: paymentMethod,
    recipient_zip: customer.postalCode ?? null,
    parcel_type: 'BOX',
    product_id: input.order.orderNumber.slice(0, 20),
    pick_address: undefined,
    comments: input.parcel.itemDescription.slice(0, 255),
    number_of_item: items,
    actual_product_price: Math.round(Number(input.order.totalAmount ?? codAmount)),
  })
  const id = result?.ID ?? result?.id
  if (!id) throw new Error('eCourier did not return an eCourier tracking ID.')
  return { providerShipmentId: String(id), trackingNumber: String(id), labelReference: null, status: 'CREATED', raw: result }
}

export async function trackECourierShipment(trackingNumber: string): Promise<TrackingResult> {
  const result = await request('/track', { ecr: trackingNumber })
  const row = Array.isArray(result?.query_data) ? result.query_data[0] : null
  const statuses = Array.isArray(row?.status) ? row.status : []
  const latest = statuses[0]
  return { providerShipmentId: String(row?.REFID ?? trackingNumber), trackingNumber, status: mapStatus(latest?.[0]), statusText: latest?.[0] ? String(latest[0]) : null, occurredAt: latest?.[2] ? String(latest[2]) : null, raw: result }
}
