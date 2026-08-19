import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import { decryptSecret, encryptSecret } from './secrets'

const PATHAO_BASE_URL = 'https://api-hermes.pathao.com'
const TOKEN_SKEW_SECONDS = 60

export type PathaoAuthStatus = 'PASS' | 'FAIL'

export type PathaoTestResult = {
  authentication: { status: PathaoAuthStatus; message: string }
  store: { status: PathaoAuthStatus; message: string; stores: PathaoStore[]; activeStore?: PathaoStore }
  city: { status: PathaoAuthStatus; message: string; cities: PathaoCity[] }
  zone: { status: PathaoAuthStatus; message: string; zones: PathaoZone[] }
  area: { status: PathaoAuthStatus; message: string; areas: PathaoArea[] }
  price: { status: PathaoAuthStatus; message: string; quote?: PathaoPricePlan }
  shipmentCreation: 'AVAILABLE — guarded Admin single-create flow'
  checkedAt: string
}

export type PathaoStore = {
  store_id: number
  store_name: string
  store_address?: string | null
  is_active?: boolean
  status?: string | null
}

export type PathaoCity = { city_id: number; city_name: string }
export type PathaoZone = { zone_id: number; zone_name: string }
export type PathaoArea = { area_id: number; area_name: string }

type PathaoTokenResponse = { access_token: string; refresh_token: string; expires_in?: number; token_type?: string }

export type PathaoPricePlan = {
  price: number | null
  discount: number | null
  promo_discount: number | null
  plan_id: number | string | null
  cod_enabled: boolean | null
  cod_percentage: number | null
  additional_charge: number | null
  final_price: number | null
}

export type PathaoCreateOrderInput = {
  storeId: number
  merchantOrderId: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  deliveryType: 12 | 48
  itemType: 1 | 2
  specialInstruction?: string | null
  itemQuantity: number
  itemWeight: number
  itemDescription: string
  amountToCollect: number
}

export type PathaoCreateOrderResult = {
  consignmentId: string
  providerOrderStatus: string | null
  providerStatusSlug: string | null
  deliveryFee: number | null
  raw: Record<string, unknown>
}

export type PathaoOrderInfoResult = {
  consignmentId: string
  merchantOrderId: string | null
  providerOrderStatus: string | null
  providerStatusSlug: string | null
  providerUpdatedAt: string | null
  invoiceId: string | null
  raw: Record<string, unknown>
}

class PathaoApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'PathaoApiError'
  }
}

function getCredentialConfig() {
  const required = ['PATHAO_CLIENT_ID', 'PATHAO_CLIENT_SECRET', 'PATHAO_USERNAME', 'PATHAO_PASSWORD', 'PATHAO_TOKEN_ENCRYPTION_KEY'] as const
  const missing = required.filter((name) => !process.env[name])
  if (missing.length) throw new Error(`Missing Pathao server configuration: ${missing.join(', ')}`)
  return {
    clientId: process.env.PATHAO_CLIENT_ID as string,
    clientSecret: process.env.PATHAO_CLIENT_SECRET as string,
    username: process.env.PATHAO_USERNAME as string,
    password: process.env.PATHAO_PASSWORD as string,
  }
}

async function requestPathao<T>(path: string, init: RequestInit, token: string): Promise<T> {
  const response = await fetch(`${PATHAO_BASE_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new PathaoApiError(response.status, `Pathao API request failed with HTTP ${response.status}.`)
  return body as T
}

async function issueToken() {
  const config = getCredentialConfig()
  const response = await fetch(`${PATHAO_BASE_URL}/aladdin/api/v1/issue-token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, username: config.username, password: config.password, grant_type: 'password' }),
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null) as { token_type?: string; expires_in?: number; access_token?: string; refresh_token?: string } | null
  if (!response.ok || !body?.access_token || !body.refresh_token) throw new PathaoApiError(response.status, `Pathao authentication failed with HTTP ${response.status}.`)
  return { access_token: body.access_token, refresh_token: body.refresh_token, expires_in: body.expires_in, token_type: body.token_type } satisfies PathaoTokenResponse
}

async function refreshToken(refreshToken: string) {
  const config = getCredentialConfig()
  const response = await fetch(`${PATHAO_BASE_URL}/aladdin/api/v1/issue-token`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    cache: 'no-store',
  })
  const body = await response.json().catch(() => null) as { token_type?: string; expires_in?: number; access_token?: string; refresh_token?: string } | null
  if (!response.ok || !body?.access_token || !body.refresh_token) throw new PathaoApiError(response.status, `Pathao token refresh failed with HTTP ${response.status}.`)
  return { access_token: body.access_token, refresh_token: body.refresh_token, expires_in: body.expires_in, token_type: body.token_type } satisfies PathaoTokenResponse
}

async function persistTokens(tokens: PathaoTokenResponse) {
  const db = createAdminClient()
  const expiresAt = new Date(Date.now() + Math.max(0, Number(tokens.expires_in ?? 0) - TOKEN_SKEW_SECONDS) * 1000).toISOString()
  const { error } = await db.from('delivery_provider_credentials').upsert({
    provider: 'PATHAO',
    encrypted_access_token: encryptSecret(tokens.access_token),
    encrypted_refresh_token: encryptSecret(tokens.refresh_token),
    access_token_expires_at: expiresAt,
    token_type: tokens.token_type ?? 'Bearer',
    last_successful_auth_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'provider' })
  if (error) throw new Error('Pathao token persistence failed.')
  return { expiresAt }
}

function unwrapData<T>(body: { data?: T } | T): T {
  if (typeof body === 'object' && body !== null && 'data' in body) return body.data as T
  return body as T
}

async function getAccessToken(): Promise<string> {
  getCredentialConfig()
  const db = createAdminClient()
  const { data: stored, error } = await db.from('delivery_provider_credentials').select('encrypted_access_token, encrypted_refresh_token, access_token_expires_at').eq('provider', 'PATHAO').maybeSingle()
  if (error) throw new Error('Pathao token state could not be read.')
  if (stored?.encrypted_access_token && stored.access_token_expires_at && new Date(stored.access_token_expires_at).getTime() > Date.now()) {
    return decryptSecret(stored.encrypted_access_token)
  }
  try {
    const tokens = stored?.encrypted_refresh_token ? await refreshToken(decryptSecret(stored.encrypted_refresh_token)) : await issueToken()
    await persistTokens(tokens)
    return tokens.access_token
  } catch (error) {
    await db.from('delivery_provider_credentials').upsert({ provider: 'PATHAO', last_error: 'Pathao authentication or refresh failed.', updated_at: new Date().toISOString() }, { onConflict: 'provider' })
    throw error
  }
}

export async function listPathaoStores() {
  const token = await getAccessToken()
  const body = await requestPathao<{ data?: PathaoStore[] } | PathaoStore[]>('/aladdin/api/v1/stores', { method: 'GET' }, token)
  return unwrapData<PathaoStore[]>(body) ?? []
}

export async function listPathaoCities() {
  const token = await getAccessToken()
  const body = await requestPathao<{ data?: PathaoCity[] } | PathaoCity[]>('/aladdin/api/v1/city-list', { method: 'GET' }, token)
  return unwrapData<PathaoCity[]>(body) ?? []
}

export async function listPathaoZones(cityId: number) {
  if (!Number.isInteger(cityId) || cityId < 1) throw new Error('A valid Pathao city ID is required.')
  const token = await getAccessToken()
  const body = await requestPathao<{ data?: PathaoZone[] } | PathaoZone[]>(`/aladdin/api/v1/cities/${cityId}/zone-list`, { method: 'GET' }, token)
  return unwrapData<PathaoZone[]>(body) ?? []
}

export async function listPathaoAreas(zoneId: number) {
  if (!Number.isInteger(zoneId) || zoneId < 1) throw new Error('A valid Pathao zone ID is required.')
  const token = await getAccessToken()
  const body = await requestPathao<{ data?: PathaoArea[] } | PathaoArea[]>(`/aladdin/api/v1/zones/${zoneId}/area-list`, { method: 'GET' }, token)
  return unwrapData<PathaoArea[]>(body) ?? []
}

export async function calculatePathaoPrice(input: { storeId: number; itemType: 1 | 2; deliveryType: 12 | 48; itemWeight: number; recipientCity: number; recipientZone: number }) {
  if (!Number.isInteger(input.storeId) || input.storeId < 1) throw new Error('A valid Pathao store ID is required.')
  if (![1, 2].includes(input.itemType)) throw new Error('Pathao item type must be Document or Parcel.')
  if (![12, 48].includes(input.deliveryType)) throw new Error('Pathao delivery type is invalid.')
  if (!Number.isFinite(input.itemWeight) || input.itemWeight < 0.5 || input.itemWeight > 10) throw new Error('Pathao item weight must be between 0.5 KG and 10 KG.')
  if (!Number.isInteger(input.recipientCity) || input.recipientCity < 1 || !Number.isInteger(input.recipientZone) || input.recipientZone < 1) throw new Error('Valid Pathao city and zone IDs are required.')
  const token = await getAccessToken()
  const body = await requestPathao<{ data?: PathaoPricePlan } | PathaoPricePlan>('/aladdin/api/v1/merchant/price-plan', { method: 'POST', body: JSON.stringify(input) }, token)
  return unwrapData<PathaoPricePlan>(body)
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function getPathaoOrderInfo(consignmentId: string): Promise<PathaoOrderInfoResult> {
  const normalized = consignmentId.trim()
  if (!normalized || normalized.length > 120) throw new Error('A valid Pathao consignment ID is required.')
  const token = await getAccessToken()
  const body = await requestPathao<Record<string, unknown>>(`/aladdin/api/v1/orders/${encodeURIComponent(normalized)}/info`, { method: 'GET' }, token)
  const data = body && typeof body.data === 'object' && body.data !== null ? body.data as Record<string, unknown> : body
  const returnedConsignmentId = textValue(data.consignment_id) ?? normalized
  return {
    consignmentId: returnedConsignmentId,
    merchantOrderId: textValue(data.merchant_order_id),
    providerOrderStatus: textValue(data.order_status),
    providerStatusSlug: textValue(data.order_status_slug),
    providerUpdatedAt: textValue(data.updated_at) ?? textValue(data.order_updated_at),
    invoiceId: textValue(data.invoice_id),
    raw: body,
  }
}

export async function createPathaoOrder(input: PathaoCreateOrderInput): Promise<PathaoCreateOrderResult> {
  if (!Number.isInteger(input.storeId) || input.storeId < 1) throw new Error('A valid Pathao store ID is required.')
  if (!input.merchantOrderId.trim() || input.merchantOrderId.length > 100) throw new Error('A valid stable merchant order ID is required.')
  if (!input.recipientName.trim() || input.recipientName.length > 120) throw new Error('Recipient name is required.')
  if (!input.recipientPhone.trim() || input.recipientPhone.length > 30) throw new Error('Recipient phone is required.')
  if (!input.recipientAddress.trim() || input.recipientAddress.length > 500) throw new Error('A complete recipient address is required.')
  if (![12, 48].includes(input.deliveryType)) throw new Error('Pathao delivery type is invalid.')
  if (![1, 2].includes(input.itemType)) throw new Error('Pathao item type must be Document or Parcel.')
  if (!Number.isInteger(input.itemQuantity) || input.itemQuantity < 1) throw new Error('Pathao item quantity must be a positive integer.')
  if (!Number.isFinite(input.itemWeight) || input.itemWeight < 0.5 || input.itemWeight > 10) throw new Error('Pathao item weight must be between 0.5 KG and 10 KG.')
  if (!input.itemDescription.trim() || input.itemDescription.length > 500) throw new Error('A valid item description is required.')
  if (!Number.isFinite(input.amountToCollect) || input.amountToCollect < 0) throw new Error('Pathao collectible amount must be a non-negative number.')

  const token = await getAccessToken()
  const payload: Record<string, unknown> = {
    store_id: input.storeId,
    merchant_order_id: input.merchantOrderId.trim(),
    recipient_name: input.recipientName.trim(),
    recipient_phone: input.recipientPhone.trim(),
    recipient_address: input.recipientAddress.trim(),
    delivery_type: input.deliveryType,
    item_type: input.itemType,
    item_quantity: input.itemQuantity,
    item_weight: input.itemWeight.toFixed(2),
    item_description: input.itemDescription.trim(),
    amount_to_collect: Number(input.amountToCollect.toFixed(2)),
  }
  if (input.specialInstruction?.trim()) payload.special_instruction = input.specialInstruction.trim().slice(0, 500)

  const body = await requestPathao<Record<string, unknown>>('/aladdin/api/v1/orders', { method: 'POST', body: JSON.stringify(payload) }, token)
  const data = body && typeof body.data === 'object' && body.data !== null ? body.data as Record<string, unknown> : body
  const consignmentId = textValue(data.consignment_id)
  if (!consignmentId) throw new Error('Pathao accepted no usable consignment ID; shipment remains in exception review.')
  return {
    consignmentId,
    providerOrderStatus: textValue(data.order_status),
    providerStatusSlug: textValue(data.order_status_slug),
    deliveryFee: numberValue(data.delivery_fee),
    raw: body,
  }
}

export async function testPathaoConnection(): Promise<PathaoTestResult> {
  const checkedAt = new Date().toISOString()
  try { await getAccessToken() } catch (error) {
    const message = error instanceof Error ? error.message : 'Pathao authentication failed.'
    return { authentication: { status: 'FAIL', message }, store: { status: 'FAIL', message: 'Blocked by authentication failure.', stores: [] }, city: { status: 'FAIL', message: 'Blocked by authentication failure.', cities: [] }, zone: { status: 'FAIL', message: 'Blocked by authentication failure.', zones: [] }, area: { status: 'FAIL', message: 'Blocked by authentication failure.', areas: [] }, price: { status: 'FAIL', message: 'Blocked by authentication failure.' }, shipmentCreation: 'AVAILABLE — guarded Admin single-create flow', checkedAt }
  }
  const authentication = { status: 'PASS' as const, message: 'Authentication and token validity passed.' }
  try {
    const stores = await listPathaoStores()
    const activeStores = stores.filter((item) => item.is_active !== false && item.status?.toLowerCase() !== 'inactive')
    const activeStore = activeStores[0]
    const store = { status: activeStores.length ? 'PASS' as const : 'FAIL' as const, message: activeStores.length ? `${stores.length} merchant store(s) retrieved; ${activeStores.length} active store(s).` : 'No active merchant store was returned.', stores, activeStore }
    const cities = await listPathaoCities()
    const city = { status: cities.length ? 'PASS' as const : 'FAIL' as const, message: `${cities.length} city record(s) retrieved.`, cities }
    const emptyZone = { status: 'FAIL' as const, message: 'Zone readiness requires at least one city.', zones: [] as PathaoZone[] }
    const emptyArea = { status: 'FAIL' as const, message: 'Area readiness requires at least one zone.', areas: [] as PathaoArea[] }
    if (!activeStore || !cities.length) return { authentication, store, city, zone: emptyZone, area: emptyArea, price: { status: 'FAIL', message: 'Price readiness requires an active store and one city.' }, shipmentCreation: 'AVAILABLE — guarded Admin single-create flow', checkedAt }
    const zones = await listPathaoZones(cities[0].city_id)
    const zone = { status: zones.length ? 'PASS' as const : 'FAIL' as const, message: `${zones.length} zone record(s) retrieved for the first city.`, zones }
    if (!zones.length) return { authentication, store, city, zone, area: emptyArea, price: { status: 'FAIL', message: 'Price readiness requires a zone for the first city.' }, shipmentCreation: 'AVAILABLE — guarded Admin single-create flow', checkedAt }
    const areas = await listPathaoAreas(zones[0].zone_id)
    const area = { status: areas.length ? 'PASS' as const : 'FAIL' as const, message: `${areas.length} area record(s) retrieved for the first zone.`, areas }
    const quote = await calculatePathaoPrice({ storeId: activeStore.store_id, itemType: 2, deliveryType: 48, itemWeight: 0.5, recipientCity: cities[0].city_id, recipientZone: zones[0].zone_id })
    return { authentication, store, city, zone, area, price: { status: 'PASS', message: 'Price calculation readiness passed with the minimum valid parcel weight.', quote }, shipmentCreation: 'AVAILABLE — guarded Admin single-create flow', checkedAt }
  } catch (error) {
    return { authentication, store: { status: 'FAIL', message: error instanceof Error ? error.message : 'Store retrieval failed.', stores: [] }, city: { status: 'FAIL', message: 'Location API verification failed.', cities: [] }, zone: { status: 'FAIL', message: 'Zone API verification failed.', zones: [] }, area: { status: 'FAIL', message: 'Area API verification failed.', areas: [] }, price: { status: 'FAIL', message: 'Price API verification failed.' }, shipmentCreation: 'AVAILABLE — guarded Admin single-create flow', checkedAt }
  }
}

export function pathaoEnvironmentStatus() {
  return {
    live: true,
    configured: Boolean(process.env.PATHAO_CLIENT_ID && process.env.PATHAO_CLIENT_SECRET && process.env.PATHAO_USERNAME && process.env.PATHAO_PASSWORD && process.env.PATHAO_TOKEN_ENCRYPTION_KEY),
    baseUrl: PATHAO_BASE_URL,
  }
}

export const pathaoShipmentCreationLocked = false
