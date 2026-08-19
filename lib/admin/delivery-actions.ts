'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'

import { requireAdmin } from './auth'
import { writeAdminAuditLog } from './audit'
import { DELIVERY_RISK_LEVELS, DELIVERY_STATUSES, getDeliveryRiskDetails } from './delivery-data'
import { providerCatalogByCode } from '@/lib/delivery/provider-catalog'
import { calculatePathaoPrice, listPathaoAreas, listPathaoCities, listPathaoStores, listPathaoZones, testPathaoConnection } from '@/lib/delivery/pathao'

const providers = ['PATHAO', 'STEADFAST', 'REDX', 'CARRYBEE', 'ECOURIER'] as const
type Provider = (typeof providers)[number]
type RiskLevel = (typeof DELIVERY_RISK_LEVELS)[number]
type ShipmentStatus = (typeof DELIVERY_STATUSES)[number]

function validProvider(value: string): value is Provider {
  return providers.includes(value as Provider)
}
function validRisk(value: string): value is RiskLevel {
  return DELIVERY_RISK_LEVELS.includes(value as RiskLevel)
}
function validStatus(value: string): value is ShipmentStatus {
  return DELIVERY_STATUSES.includes(value as ShipmentStatus)
}
function refreshDelivery() {
  revalidatePath('/admin/delivery')
  revalidatePath('/admin/orders')
}

export async function testPathaoConnectionAction() {
  const session = await requireAdmin()
  const result = await testPathaoConnection()
  const db = createAdminClient()
  const passed = [result.authentication, result.store, result.city, result.price].every((item) => item.status === 'PASS')
  await db.from('delivery_providers').update({
    connection_state: passed ? 'CONNECTED' : 'DEGRADED',
    is_enabled: passed,
    capabilities: { CREATE_SHIPMENT: 'UNVERIFIED', TRACK_SHIPMENT: 'UNVERIFIED', WEBHOOK: 'UNVERIFIED', PRICE_QUOTE: result.price.status === 'PASS' ? 'SUPPORTED' : 'UNVERIFIED' },
    metadata: { environment: 'LIVE', last_connection_test_at: result.checkedAt, last_connection_test: { authentication: result.authentication.status, store: result.store.status, city: result.city.status, price: result.price.status }, store_count: result.store.stores.length, city_count: result.city.cities.length },
    updated_at: result.checkedAt,
  }).eq('provider', 'PATHAO')
  await writeAdminAuditLog({ actorUserId: session.userId, action: 'PATHAO_CONNECTION_TESTED', entityType: 'delivery_provider', entityId: 'PATHAO', details: { environment: 'LIVE', passed, authentication: result.authentication.status, store: result.store.status, city: result.city.status, price: result.price.status, shipment_creation: 'LOCKED_PHASE_2' } })
  refreshDelivery()
  return result
}

export async function getPathaoStoresAction() {
  await requireAdmin()
  return listPathaoStores()
}

export async function getPathaoCitiesAction() {
  await requireAdmin()
  return listPathaoCities()
}

export async function getPathaoZonesAction(cityId: number) {
  await requireAdmin()
  return listPathaoZones(cityId)
}

export async function getPathaoAreasAction(zoneId: number) {
  await requireAdmin()
  return listPathaoAreas(zoneId)
}

export async function calculatePathaoPriceAction(input: { storeId: number; itemType: 1 | 2; deliveryType: 12 | 48; itemWeight: number; recipientCity: number; recipientZone: number }) {
  await requireAdmin()
  return calculatePathaoPrice(input)
}

export async function testDeliveryProviderReadiness(providerCode: string) {
  await requireAdmin()
  if (!validProvider(providerCode)) return { ok: false, state: 'INVALID', message: 'Select a valid courier provider.' }
  const db = createAdminClient()
  const { data: provider, error } = await db.from('delivery_providers').select('provider, display_name, connection_state, is_enabled').eq('provider', providerCode).maybeSingle()
  if (error || !provider) return { ok: false, state: 'MISSING', message: 'Courier provider configuration is missing.' }
  const catalog = providerCatalogByCode.get(provider.provider as Provider)
  if (provider.connection_state !== 'CONNECTED' || !provider.is_enabled) {
    return { ok: false, state: 'CREDENTIALS_REQUIRED', message: `${provider.display_name} credentials are required before any courier API call.` }
  }
  return { ok: true, state: 'READY', message: `${provider.display_name} is marked connected. A provider-specific connection test will be enabled only after its official credentials and adapter are configured.`, capabilities: catalog?.capabilities ?? [] }
}

export async function prepareInternalShipment(input: { orderId: string; provider: string }) {
  const session = await requireAdmin()
  if (!validProvider(input.provider)) return { ok: false, message: 'Select a valid courier provider.' }

  const db = createAdminClient()
  const { data: order, error: orderError } = await db
    .from('orders')
    .select('id, order_number, grand_total, payment_method, customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot, shipping_address, shipping_area, shipping_district, shipping_division, shipping_postal_code, order_items(id, sku, product_name_snapshot, variant_title_snapshot, quantity, line_total)')
    .eq('id', input.orderId)
    .maybeSingle()
  if (orderError || !order) return { ok: false, message: 'Order not found or could not be loaded.' }

  const { data: provider, error: providerError } = await db.from('delivery_providers').select('provider, display_name, connection_state, is_enabled').eq('provider', input.provider).maybeSingle()
  if (providerError || !provider) return { ok: false, message: 'Courier provider is not configured.' }

  const idempotencyKey = `internal:${order.id}:${input.provider}`
  const recipientSnapshot = {
    name: order.customer_name_snapshot,
    phone: order.customer_phone_snapshot,
    email: order.customer_email_snapshot,
    address: order.shipping_address,
    area: order.shipping_area,
    district: order.shipping_district,
    division: order.shipping_division,
    postalCode: order.shipping_postal_code,
  }
  const parcelSnapshot = { codAmount: Number(order.grand_total ?? 0), paymentMethod: order.payment_method, items: order.order_items ?? [] }

  const { data: shipment, error: shipmentError } = await db.from('shipments').insert({
    order_id: order.id,
    provider: input.provider,
    status: 'READY',
    idempotency_key: idempotencyKey,
    risk_level: 'NOT_ASSESSED',
    recipient_snapshot: recipientSnapshot,
    parcel_snapshot: parcelSnapshot,
    provider_snapshot: { displayName: provider.display_name, connectionState: provider.connection_state, isEnabled: provider.is_enabled, internalOnly: true },
  }).select('id').single()

  if (shipmentError) {
    if (shipmentError.code === '23505') return { ok: true, duplicate: true, message: 'Shipment already exists for this order and courier.' }
    return { ok: false, message: 'Shipment preparation failed. The order was preserved.' }
  }

  const { error: historyError } = await db.from('shipment_history').insert({ shipment_id: shipment.id, provider: input.provider, previous_status: 'DRAFT', new_status: 'READY', source: 'ADMIN', notes: 'Internal shipment prepared; courier API not connected.', payload: { internalOnly: true } })
  if (historyError) return { ok: false, message: 'Shipment was created but its history could not be recorded. Contact an administrator.' }

  const { error: auditError } = await db.from('delivery_audit_logs').insert({ shipment_id: shipment.id, order_id: order.id, provider: input.provider, actor_user_id: session.userId, action: 'INTERNAL_SHIPMENT_PREPARED', details: { internalOnly: true, providerConnectionState: provider.connection_state } })
  if (auditError) return { ok: false, message: 'Shipment was created but its delivery audit event could not be recorded.' }

  await writeAdminAuditLog({ actorUserId: session.userId, action: 'SHIPMENT_PREPARED', entityType: 'shipment', entityId: shipment.id, details: { order_id: order.id, provider: input.provider, internal_only: true } })
  refreshDelivery()
  return { ok: true, duplicate: false, shipmentId: shipment.id, message: 'Shipment prepared successfully.' }
}

export async function prepareBulkInternalShipments(input: { orderIds: string[]; provider: string }) {
  await requireAdmin()
  const uniqueOrderIds = [...new Set(input.orderIds)].slice(0, 100)
  const results = []
  for (const orderId of uniqueOrderIds) {
    const result = await prepareInternalShipment({ orderId, provider: input.provider })
    results.push({ orderId, outcome: result.ok ? result.duplicate ? 'ALREADY_PREPARED' : 'PREPARED' : 'FAILED', message: result.message })
  }
  refreshDelivery()
  return { ok: true, results }
}

export async function loadDeliveryRiskDetails(orderId: string) {
  await requireAdmin()
  return getDeliveryRiskDetails(orderId)
}

export async function updateShipmentRisk(input: { shipmentId: string; riskLevel: string }) {
  const session = await requireAdmin()
  if (!validRisk(input.riskLevel)) return { ok: false, message: 'Invalid risk level.' }
  const db = createAdminClient()
  const { data: shipment, error } = await db.from('shipments').update({ risk_level: input.riskLevel, updated_at: new Date().toISOString() }).eq('id', input.shipmentId).select('id, order_id, provider, risk_level').maybeSingle()
  if (error || !shipment) return { ok: false, message: 'Risk could not be updated.' }
  await db.from('delivery_audit_logs').insert({ shipment_id: shipment.id, order_id: shipment.order_id, provider: shipment.provider, actor_user_id: session.userId, action: 'RISK_REVIEWED', details: { riskLevel: input.riskLevel } })
  await writeAdminAuditLog({ actorUserId: session.userId, action: 'SHIPMENT_RISK_REVIEWED', entityType: 'shipment', entityId: shipment.id, details: { risk_level: input.riskLevel } })
  refreshDelivery()
  return { ok: true, message: 'Risk review saved.' }
}

export async function updateInternalShipmentStatus(input: { shipmentId: string; status: string; notes?: string }) {
  const session = await requireAdmin()
  if (!validStatus(input.status)) return { ok: false, message: 'Invalid shipment status.' }
  if (!['READY', 'CANCELLED', 'EXCEPTION'].includes(input.status)) return { ok: false, message: 'Only internal preparation, cancellation, or exception states are available while couriers are disconnected.' }

  const db = createAdminClient()
  const { data: current, error: currentError } = await db.from('shipments').select('id, order_id, provider, status').eq('id', input.shipmentId).maybeSingle()
  if (currentError || !current) return { ok: false, message: 'Shipment not found.' }
  const { error } = await db.from('shipments').update({ status: input.status, updated_at: new Date().toISOString(), last_error: input.status === 'EXCEPTION' ? (input.notes ?? 'Marked as exception by Admin.') : null }).eq('id', current.id)
  if (error) return { ok: false, message: 'Shipment status could not be updated.' }
  await db.from('shipment_history').insert({ shipment_id: current.id, provider: current.provider, previous_status: current.status, new_status: input.status, source: 'ADMIN', notes: input.notes ?? null, payload: { internalOnly: true } })
  await db.from('delivery_audit_logs').insert({ shipment_id: current.id, order_id: current.order_id, provider: current.provider, actor_user_id: session.userId, action: 'SHIPMENT_STATUS_CHANGED', details: { previousStatus: current.status, newStatus: input.status } })
  await writeAdminAuditLog({ actorUserId: session.userId, action: 'SHIPMENT_STATUS_CHANGED', entityType: 'shipment', entityId: current.id, details: { previous_status: current.status, new_status: input.status } })
  refreshDelivery()
  return { ok: true, message: 'Shipment status updated.' }
}
