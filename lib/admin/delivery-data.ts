import 'server-only'

/* eslint-disable @typescript-eslint/no-explicit-any -- serialized Supabase relation data is normalized at the loader boundary. */

import { createAdminClient } from '@/lib/supabase/admin'

import { requireAdmin } from './auth'
import { mergeProviderCatalog } from '@/lib/delivery/provider-catalog'

export const DELIVERY_STATUSES = ['DRAFT', 'READY', 'CREATED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'RETURNED', 'EXCEPTION'] as const
export const DELIVERY_RISK_LEVELS = ['NOT_ASSESSED', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error('Unable to load delivery operations data.')
}

function safeSearch(value?: string) {
  return value?.trim().replace(/[,%()]/g, '') ?? ''
}

function normalizeShipment(shipment: any) {
  if (!shipment) return null
  return {
    id: shipment.id,
    provider: shipment.provider,
    status: shipment.status,
    providerShipmentId: shipment.provider_shipment_id,
    trackingNumber: shipment.tracking_number,
    labelReference: shipment.label_reference,
    riskLevel: shipment.risk_level,
    recipientSnapshot: shipment.recipient_snapshot ?? {},
    parcelSnapshot: shipment.parcel_snapshot ?? {},
    createdAt: shipment.created_at,
    updatedAt: shipment.updated_at,
    history: (shipment.shipment_history ?? []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  }
}

function normalizeOrder(order: any) {
  const shipment = (order.shipments ?? []).map(normalizeShipment).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
  return {
    id: order.id,
    orderNumber: order.order_number,
    customerId: order.customer_id,
    customerName: order.customer_name_snapshot,
    customerPhone: order.customer_phone_snapshot,
    customerEmail: order.customer_email_snapshot,
    address: order.shipping_address,
    area: order.shipping_area,
    district: order.shipping_district,
    division: order.shipping_division,
    postalCode: order.shipping_postal_code,
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    codAmount: Number(order.grand_total ?? 0),
    grandTotal: Number(order.grand_total ?? 0),
    createdAt: order.created_at,
    items: order.order_items ?? [],
    shipment,
  }
}

export async function getDeliveryOperationsData(filters: { query?: string; orderStatus?: string; shipmentStatus?: string; provider?: string; risk?: string } = {}) {
  await requireAdmin()
  const db = createAdminClient()
  const search = safeSearch(filters.query)

  let ordersQuery = db
    .from('orders')
    .select('id, order_number, customer_id, grand_total, payment_method, payment_status, order_status, shipping_address, shipping_area, shipping_division, shipping_district, shipping_postal_code, customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot, created_at, order_items(id, sku, product_name_snapshot, variant_title_snapshot, quantity, line_total), shipments(id, provider, status, provider_shipment_id, tracking_number, label_reference, risk_level, recipient_snapshot, parcel_snapshot, created_at, updated_at, shipment_history(id, previous_status, new_status, source, notes, created_at))')
    .order('created_at', { ascending: false })
    .limit(100)

  if (search) ordersQuery = ordersQuery.or(`order_number.ilike.%${search}%,customer_name_snapshot.ilike.%${search}%,customer_phone_snapshot.ilike.%${search}%`)
  if (filters.orderStatus && filters.orderStatus !== 'ALL') ordersQuery = ordersQuery.eq('order_status', filters.orderStatus)

  const shipmentCounts = await Promise.all([
    db.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'READY'),
    db.from('shipments').select('*', { count: 'exact', head: true }).in('status', ['CREATED', 'PICKUP_PENDING', 'PICKED_UP']),
    db.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'IN_TRANSIT'),
    db.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'OUT_FOR_DELIVERY'),
    db.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'DELIVERED'),
    db.from('shipments').select('*', { count: 'exact', head: true }).in('status', ['DELIVERY_FAILED', 'EXCEPTION']),
    db.from('shipments').select('*', { count: 'exact', head: true }).in('status', ['RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'RETURNED']),
    db.from('delivery_providers').select('provider, display_name, connection_state, capabilities, is_enabled').order('display_name').limit(10),
    ordersQuery,
  ])

  shipmentCounts.forEach((result) => assertNoError(result.error))
  const [ready, dispatched, inTransit, outForDelivery, delivered, failed, returned, providers, orders] = shipmentCounts
  let normalizedOrders = (orders.data ?? []).map(normalizeOrder)
  if (filters.shipmentStatus && filters.shipmentStatus !== 'ALL') normalizedOrders = normalizedOrders.filter((order: any) => (order.shipment?.status ?? 'NOT_PREPARED') === filters.shipmentStatus)
  if (filters.provider && filters.provider !== 'ALL') normalizedOrders = normalizedOrders.filter((order: any) => order.shipment?.provider === filters.provider)
  if (filters.risk && filters.risk !== 'ALL') normalizedOrders = normalizedOrders.filter((order: any) => (order.shipment?.riskLevel ?? 'NOT_ASSESSED') === filters.risk)

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayOrders = normalizedOrders.filter((order: any) => new Date(order.createdAt) >= today).length
  const needsAttention = normalizedOrders.filter((order: any) => ['HIGH', 'CRITICAL'].includes(order.shipment?.riskLevel) || ['DELIVERY_FAILED', 'EXCEPTION'].includes(order.shipment?.status)).length

  return {
    orders: normalizedOrders,
    providers: (providers.data ?? []).map(mergeProviderCatalog),
    metrics: {
      todayOrders,
      readyToDispatch: ready.count ?? 0,
      dispatched: dispatched.count ?? 0,
      inTransit: inTransit.count ?? 0,
      outForDelivery: outForDelivery.count ?? 0,
      delivered: delivered.count ?? 0,
      failed: failed.count ?? 0,
      returned: returned.count ?? 0,
      needsAttention,
    },
    filters,
  }
}

export async function getDeliveryRiskDetails(orderId: string) {
  await requireAdmin()
  const db = createAdminClient()
  const { data: order, error } = await db.from('orders').select('id, customer_id, customer_name_snapshot, customer_phone_snapshot, order_status, created_at').eq('id', orderId).maybeSingle()
  assertNoError(error)
  if (!order) throw new Error('Order not found.')

  const baseQuery = order.customer_id ? db.from('orders').select('id, order_status, created_at').eq('customer_id', order.customer_id).limit(100) : null
  const history = baseQuery ? await baseQuery : { data: [], error: null }
  assertNoError(history.error)
  const rows = history.data ?? []
  const delivered = rows.filter((row: any) => row.order_status === 'DELIVERED').length
  const returned = rows.filter((row: any) => ['RETURNED', 'RETURN_REQUESTED'].includes(row.order_status)).length
  const cancelled = rows.filter((row: any) => row.order_status === 'CANCELLED').length
  const failed = rows.filter((row: any) => row.order_status === 'DELIVERY_FAILED').length
  const successRate = rows.length ? Math.round((delivered / rows.length) * 100) : null

  return {
    orderId,
    customerName: order.customer_name_snapshot,
    totalOrders: rows.length,
    delivered,
    returned,
    cancelled,
    failed,
    successRate,
    recommendation: rows.length < 2 ? 'Insufficient history' : failed + returned > delivered ? 'Manual verification recommended' : 'No additional recommendation',
    recentOrders: rows.slice(0, 8),
  }
}
