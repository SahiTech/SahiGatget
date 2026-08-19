'use server'

/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase relation payloads are revalidated at the server-action boundary. */

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'

import { requireAdmin } from './auth'
import { writeAdminAuditLog } from './audit'
import { DELIVERY_RISK_LEVELS, DELIVERY_STATUSES, getDeliveryRiskDetails } from './delivery-data'
import { providerCatalogByCode } from '@/lib/delivery/provider-catalog'
import { calculatePathaoPrice, createPathaoOrder, getPathaoOrderInfo, listPathaoAreas, listPathaoCities, listPathaoStores, listPathaoZones, testPathaoConnection } from '@/lib/delivery/pathao'

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
    capabilities: { CREATE_SHIPMENT: result.authentication.status === 'PASS' && result.store.status === 'PASS' ? 'SUPPORTED' : 'UNVERIFIED', TRACK_SHIPMENT: 'UNVERIFIED', WEBHOOK: 'UNVERIFIED', PRICE_QUOTE: result.price.status === 'PASS' ? 'SUPPORTED' : 'UNVERIFIED' },
    metadata: { environment: 'LIVE', last_connection_test_at: result.checkedAt, last_connection_test: { authentication: result.authentication.status, store: result.store.status, city: result.city.status, price: result.price.status }, store_count: result.store.stores.length, city_count: result.city.cities.length },
    updated_at: result.checkedAt,
  }).eq('provider', 'PATHAO')
  await writeAdminAuditLog({ actorUserId: session.userId, action: 'PATHAO_CONNECTION_TESTED', entityType: 'delivery_provider', entityId: 'PATHAO', details: { environment: 'LIVE', passed, authentication: result.authentication.status, store: result.store.status, city: result.city.status, price: result.price.status, shipment_creation: 'GUARDED_PHASE_2_SINGLE_CREATE' } })
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

const PATHAO_ELIGIBLE_ORDER_STATUSES = new Set(['CONFIRMED', 'PROCESSING', 'READY_TO_SHIP'])

function normalizePhone(value: unknown) {
  return typeof value === 'string' ? value.replace(/[\s-]/g, '').trim() : ''
}

function buildCompleteAddress(order: any) {
  return [order.shipping_address, order.shipping_area, order.shipping_district, order.shipping_division, order.shipping_postal_code].filter((value) => typeof value === 'string' && value.trim()).join(', ').trim()
}

export async function createPathaoShipmentAction(input: { orderId: string; storeId?: number; deliveryType: 12 | 48; itemType: 1 | 2; itemWeight: number; specialInstruction?: string }) {
  const session = await requireAdmin()
  if (!input.orderId || (input.storeId !== undefined && (!Number.isInteger(input.storeId) || input.storeId < 1))) return { ok: false, message: 'A valid order is required.' }
  if (![12, 48].includes(input.deliveryType) || ![1, 2].includes(input.itemType)) return { ok: false, message: 'Invalid Pathao delivery or item type.' }
  if (!Number.isFinite(input.itemWeight) || input.itemWeight < 0.5 || input.itemWeight > 10) return { ok: false, message: 'Parcel weight must be between 0.5 KG and 10 KG.' }

  const db = createAdminClient()
  const { data: order, error: orderError } = await db.from('orders').select('id, order_number, grand_total, payment_method, order_status, notes, customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot, shipping_address, shipping_area, shipping_district, shipping_division, shipping_postal_code, order_items(id, product_name_snapshot, variant_title_snapshot, quantity, line_total), shipments(id, provider, status, provider_shipment_id, merchant_order_id, provider_order_status, provider_status_slug, provider_updated_at, delivery_fee, amount_to_collect, provider_snapshot)').eq('id', input.orderId).maybeSingle()
  if (orderError || !order) return { ok: false, message: 'Order not found or could not be loaded.' }
  if (!PATHAO_ELIGIBLE_ORDER_STATUSES.has(order.order_status)) return { ok: false, message: `Order status ${order.order_status} is not eligible for courier creation.` }

  const existing = (order.shipments ?? []).find((item: any) => item.provider === 'PATHAO' && item.provider_shipment_id)
  if (existing) return { ok: true, duplicate: true, shipmentId: existing.id, consignmentId: existing.provider_shipment_id, message: 'Shipment already created.' }

  const recipientName = typeof order.customer_name_snapshot === 'string' ? order.customer_name_snapshot.trim() : ''
  const recipientPhone = normalizePhone(order.customer_phone_snapshot)
  const recipientAddress = buildCompleteAddress(order)
  const items = Array.isArray(order.order_items) ? order.order_items : []
  const itemQuantity = items.reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0)
  const itemDescription = items.map((item: any) => [item.product_name_snapshot, item.variant_title_snapshot].filter(Boolean).join(' — ')).filter(Boolean).join('; ').slice(0, 500)
  const codAmount = String(order.payment_method ?? '').toUpperCase() === 'COD' ? Number(order.grand_total ?? 0) : 0
  if (!recipientName || !recipientPhone || !recipientAddress || !items.length || !Number.isInteger(itemQuantity) || itemQuantity < 1 || !itemDescription || !Number.isFinite(codAmount) || codAmount < 0) return { ok: false, message: 'Order is missing a required recipient, parcel, or collectible-amount field.' }

  const { data: provider, error: providerError } = await db.from('delivery_providers').select('provider, connection_state, is_enabled, metadata').eq('provider', 'PATHAO').maybeSingle()
  if (providerError || !provider || provider.connection_state !== 'CONNECTED' || !provider.is_enabled) return { ok: false, message: 'Pathao is not marked connected. Run the connection test first.' }
  const stores = await listPathaoStores()
  const selectedStore = stores.find((store) => (input.storeId === undefined || store.store_id === input.storeId) && store.is_active !== false && store.status?.toLowerCase() !== 'inactive')
  if (!selectedStore) return { ok: false, message: 'No active Pathao merchant store is available.' }

  const merchantOrderId = String(order.order_number).trim()
  const idempotencyKey = `pathao:${order.id}`
  const reservationSnapshot = { merchantOrderId, submissionState: 'PENDING', storeId: selectedStore.store_id, deliveryType: input.deliveryType, itemType: input.itemType, itemWeight: input.itemWeight, internalOnly: false }
  const { data: reservation, error: reservationError } = await db.from('shipments').insert({ order_id: order.id, provider: 'PATHAO', status: 'READY', merchant_order_id: merchantOrderId, idempotency_key: idempotencyKey, amount_to_collect: codAmount, risk_level: 'NOT_ASSESSED', recipient_snapshot: { name: recipientName, phone: recipientPhone, email: order.customer_email_snapshot, address: recipientAddress }, parcel_snapshot: { itemType: input.itemType, deliveryType: input.deliveryType, itemWeight: input.itemWeight, itemQuantity, itemDescription, items }, provider_snapshot: reservationSnapshot, attempt_count: 1 }).select('id').single()
  if (reservationError) {
    if (reservationError.code === '23505') return { ok: false, duplicate: true, message: 'A Pathao shipment attempt already exists for this order. Review the existing shipment before retrying.' }
    return { ok: false, message: 'Shipment reservation failed. The order was preserved.' }
  }

  await db.from('shipment_history').insert({ shipment_id: reservation.id, provider: 'PATHAO', previous_status: 'DRAFT', new_status: 'READY', source: 'ADMIN', notes: 'Pathao submission reserved; provider call pending.', payload: { merchantOrderId, storeId: selectedStore.store_id } })
  await db.from('delivery_audit_logs').insert({ shipment_id: reservation.id, order_id: order.id, provider: 'PATHAO', actor_user_id: session.userId, action: 'PATHAO_SHIPMENT_SUBMISSION_RESERVED', details: { merchantOrderId, deliveryType: input.deliveryType, itemType: input.itemType } })

  try {
    const result = await createPathaoOrder({ storeId: selectedStore.store_id, merchantOrderId, recipientName, recipientPhone, recipientAddress, deliveryType: input.deliveryType, itemType: input.itemType, specialInstruction: input.specialInstruction || order.notes, itemQuantity, itemWeight: input.itemWeight, itemDescription, amountToCollect: codAmount })
    const now = new Date().toISOString()
    const { error: updateError } = await db.from('shipments').update({ status: 'CREATED', provider_shipment_id: result.consignmentId, merchant_order_id: merchantOrderId, provider_order_status: result.providerOrderStatus, provider_status_slug: result.providerStatusSlug, provider_updated_at: now, delivery_fee: result.deliveryFee, amount_to_collect: codAmount, provider_snapshot: { merchantOrderId, consignmentId: result.consignmentId, providerOrderStatus: result.providerOrderStatus, providerStatusSlug: result.providerStatusSlug, deliveryFee: result.deliveryFee, submissionState: 'CREATED' }, updated_at: now, last_error: null }).eq('id', reservation.id)
    if (updateError) throw new Error('Pathao created the shipment but local persistence failed; manual reconciliation is required.')
    await db.from('shipment_history').insert({ shipment_id: reservation.id, provider: 'PATHAO', previous_status: 'READY', new_status: 'CREATED', source: 'PROVIDER_API', notes: 'Pathao shipment created.', payload: { consignmentId: result.consignmentId, providerOrderStatus: result.providerOrderStatus, providerStatusSlug: result.providerStatusSlug, deliveryFee: result.deliveryFee } })
    await db.from('delivery_audit_logs').insert({ shipment_id: reservation.id, order_id: order.id, provider: 'PATHAO', actor_user_id: session.userId, action: 'PATHAO_SHIPMENT_CREATED', details: { merchantOrderId, consignmentId: result.consignmentId, providerOrderStatus: result.providerOrderStatus } })
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'PATHAO_SHIPMENT_CREATED', entityType: 'shipment', entityId: reservation.id, details: { provider: 'PATHAO', merchant_order_id: merchantOrderId, consignment_id: result.consignmentId } })
    refreshDelivery()
    return { ok: true, duplicate: false, shipmentId: reservation.id, consignmentId: result.consignmentId, message: 'Pathao shipment created successfully.' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pathao shipment creation failed.'
    const now = new Date().toISOString()
    await db.from('shipments').update({ status: 'EXCEPTION', last_error: message.slice(0, 500), provider_snapshot: { ...reservationSnapshot, submissionState: 'EXCEPTION' }, updated_at: now }).eq('id', reservation.id)
    await db.from('shipment_history').insert({ shipment_id: reservation.id, provider: 'PATHAO', previous_status: 'READY', new_status: 'EXCEPTION', source: 'PROVIDER_API', notes: 'Pathao shipment creation failed or returned an indeterminate result.', payload: { error: message.slice(0, 300) } })
    await db.from('delivery_audit_logs').insert({ shipment_id: reservation.id, order_id: order.id, provider: 'PATHAO', actor_user_id: session.userId, action: 'PATHAO_SHIPMENT_FAILED', details: { merchantOrderId, error: message.slice(0, 300) } })
    refreshDelivery()
    return { ok: false, shipmentId: reservation.id, message: 'Pathao shipment creation failed or is indeterminate. Review the exception before retrying.' }
  }
}

const PATHAO_PROVIDER_STATUS_MAP: Record<string, ShipmentStatus> = Object.fromEntries(['CREATED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'RETURNED', 'EXCEPTION'].map((status) => [status, status])) as Record<string, ShipmentStatus>

export async function refreshPathaoShipmentStatusAction(input: { shipmentId: string }) {
  const session = await requireAdmin()
  if (!input.shipmentId) return { ok: false, message: 'Shipment is required.' }
  const db = createAdminClient()
  const { data: shipment, error } = await db.from('shipments').select('id, order_id, provider, status, provider_shipment_id, provider_snapshot').eq('id', input.shipmentId).maybeSingle()
  if (error || !shipment || shipment.provider !== 'PATHAO') return { ok: false, message: 'Pathao shipment not found.' }
  if (!shipment.provider_shipment_id) return { ok: false, message: 'Pathao consignment ID is not available.' }

  try {
    const info = await getPathaoOrderInfo(shipment.provider_shipment_id)
    const providerStatusKey = `${info.providerStatusSlug ?? ''}`.trim().toUpperCase() || `${info.providerOrderStatus ?? ''}`.trim().toUpperCase()
    const mappedStatus = PATHAO_PROVIDER_STATUS_MAP[providerStatusKey]
    const nextStatus = mappedStatus ?? shipment.status
    const now = new Date().toISOString()
    const providerSnapshot = { ...(shipment.provider_snapshot ?? {}), consignmentId: info.consignmentId, merchantOrderId: info.merchantOrderId, providerOrderStatus: info.providerOrderStatus, providerStatusSlug: info.providerStatusSlug, providerUpdatedAt: info.providerUpdatedAt, invoiceId: info.invoiceId, statusRefreshState: 'REFRESHED' }
    const { error: updateError } = await db.from('shipments').update({ status: nextStatus, merchant_order_id: info.merchantOrderId ?? undefined, provider_order_status: info.providerOrderStatus, provider_status_slug: info.providerStatusSlug, provider_updated_at: info.providerUpdatedAt ?? now, provider_snapshot: providerSnapshot, updated_at: now }).eq('id', shipment.id)
    if (updateError) return { ok: false, message: 'Provider status was received but local persistence failed.' }
    if (nextStatus !== shipment.status) await db.from('shipment_history').insert({ shipment_id: shipment.id, provider: 'PATHAO', previous_status: shipment.status, new_status: nextStatus, source: 'PROVIDER_API', notes: 'Pathao order information refreshed.', payload: { providerOrderStatus: info.providerOrderStatus, providerStatusSlug: info.providerStatusSlug } })
    await db.from('delivery_audit_logs').insert({ shipment_id: shipment.id, order_id: shipment.order_id, provider: 'PATHAO', actor_user_id: session.userId, action: 'PATHAO_STATUS_REFRESHED', details: { consignmentId: info.consignmentId, providerOrderStatus: info.providerOrderStatus, providerStatusSlug: info.providerStatusSlug, mappedStatus: nextStatus } })
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'PATHAO_STATUS_REFRESHED', entityType: 'shipment', entityId: shipment.id, details: { provider: 'PATHAO', consignment_id: info.consignmentId, provider_status: info.providerOrderStatus, provider_status_slug: info.providerStatusSlug } })
    refreshDelivery()
    return { ok: true, status: nextStatus, providerOrderStatus: info.providerOrderStatus, providerStatusSlug: info.providerStatusSlug, providerUpdatedAt: info.providerUpdatedAt, invoiceId: info.invoiceId, message: 'Pathao status refreshed.' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pathao status refresh failed.'
    await db.from('shipments').update({ last_error: message.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', shipment.id)
    await db.from('delivery_audit_logs').insert({ shipment_id: shipment.id, order_id: shipment.order_id, provider: 'PATHAO', actor_user_id: session.userId, action: 'PATHAO_STATUS_REFRESH_FAILED', details: { error: message.slice(0, 300) } })
    return { ok: false, message: 'Pathao status refresh failed. Review the shipment exception state.' }
  }
}

export async function requestManualPathaoReversePickupAction(input: { shipmentId: string; reason: string }) {
  const session = await requireAdmin()
  const reason = input.reason.trim().slice(0, 300)
  if (!input.shipmentId || !reason) return { ok: false, message: 'Shipment and return reason are required.' }
  const db = createAdminClient()
  const { data: shipment, error } = await db.from('shipments').select('id, order_id, provider, status, provider_shipment_id, provider_snapshot').eq('id', input.shipmentId).maybeSingle()
  if (error || !shipment || shipment.provider !== 'PATHAO') return { ok: false, message: 'Pathao shipment not found.' }
  if (!shipment.provider_shipment_id) return { ok: false, message: 'A Pathao consignment is required before recording a reverse-pickup request.' }
  const now = new Date().toISOString()
  const providerSnapshot = { ...(shipment.provider_snapshot ?? {}), manualReversePickup: { state: 'REQUESTED', reason, requestedAt: now, providerAction: 'MERCHANT_PANEL_REQUIRED' } }
  const { error: updateError } = await db.from('shipments').update({ status: 'RETURN_REQUESTED', provider_snapshot: providerSnapshot, updated_at: now }).eq('id', shipment.id)
  if (updateError) return { ok: false, message: 'The internal reverse-pickup request could not be recorded.' }
  await db.from('shipment_history').insert({ shipment_id: shipment.id, provider: 'PATHAO', previous_status: shipment.status, new_status: 'RETURN_REQUESTED', source: 'ADMIN', notes: 'Manual reverse-pickup request recorded; Pathao Merchant Panel action required.', payload: { reason, providerAction: 'MERCHANT_PANEL_REQUIRED' } })
  await db.from('delivery_audit_logs').insert({ shipment_id: shipment.id, order_id: shipment.order_id, provider: 'PATHAO', actor_user_id: session.userId, action: 'PATHAO_REVERSE_PICKUP_MANUAL_REQUESTED', details: { consignmentId: shipment.provider_shipment_id, reason, providerAction: 'MERCHANT_PANEL_REQUIRED' } })
  refreshDelivery()
  return { ok: true, message: 'Internal reverse-pickup request recorded. Complete the provider action in the Pathao Merchant Panel.' }
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
