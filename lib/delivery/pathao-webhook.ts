import 'server-only'

import crypto from 'node:crypto'

import type { Json } from '@/lib/types/database'
import type { NormalizedWebhookEvent, ShipmentStatus } from './contracts'

const STATUS_MAP: Record<string, ShipmentStatus> = {
  pending: 'CREATED',
  order_created: 'CREATED',
  created: 'CREATED',
  pickup_requested: 'PICKUP_PENDING',
  assigned_for_pickup: 'PICKUP_PENDING',
  pickup: 'PICKED_UP',
  pickup_failed: 'EXCEPTION',
  pickup_cancelled: 'CANCELLED',
  at_the_sorting_hub: 'IN_TRANSIT',
  in_transit: 'IN_TRANSIT',
  received_at_last_mile_hub: 'IN_TRANSIT',
  assigned_for_delivery: 'OUT_FOR_DELIVERY',
  delivered: 'DELIVERED',
  partial_delivery: 'EXCEPTION',
  return: 'RETURN_REQUESTED',
  delivery_failed: 'DELIVERY_FAILED',
  on_hold: 'EXCEPTION',
  payment_invoice: 'IN_TRANSIT',
  paid_return: 'RETURNED',
  exchange: 'EXCEPTION',
  return_id_created: 'RETURN_REQUESTED',
  return_in_transit: 'RETURN_IN_TRANSIT',
  returned_to_merchant: 'RETURNED',
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function firstString(root: unknown, keys: string[], depth = 0): string | null {
  if (depth > 5) return null
  const record = asRecord(root)
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  for (const value of Object.values(record)) {
    const found = firstString(value, keys, depth + 1)
    if (found) return found
  }
  return null
}

function normalizeStatus(value: string | null): ShipmentStatus | null {
  if (!value) return null
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return STATUS_MAP[key] ?? null
}

export function normalizePathaoWebhook(payload: Json, headers: Headers): NormalizedWebhookEvent {
  const providerEventId = firstString(payload, ['event_id', 'eventId', 'webhook_id', 'webhookId', 'id'])
    ?? crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  const providerShipmentId = firstString(payload, ['consignment_id', 'consignmentId', 'shipment_id', 'shipmentId'])
  const trackingNumber = firstString(payload, ['tracking_number', 'trackingNumber', 'invoice_id', 'invoiceId'])
  const eventType = firstString(payload, ['event', 'event_type', 'eventType', 'status', 'order_status', 'orderStatus'])
  const occurredAt = firstString(payload, ['occurred_at', 'occurredAt', 'updated_at', 'updatedAt', 'created_at', 'createdAt'])

  // The header is validated by the HTTP route before normalization. Reading it here
  // makes the adapter contract explicit without persisting the secret.
  void headers

  return {
    provider: 'PATHAO',
    providerEventId,
    providerShipmentId,
    trackingNumber,
    status: normalizeStatus(eventType),
    occurredAt,
    payload,
  }
}
