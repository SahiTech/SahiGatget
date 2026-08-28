import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import type { NormalizedWebhookEvent, ShipmentStatus } from './contracts'

const STATUS_RANK: Record<ShipmentStatus, number> = {
  DRAFT: 0,
  READY: 1,
  CREATED: 2,
  PICKUP_PENDING: 3,
  PICKED_UP: 4,
  IN_TRANSIT: 5,
  OUT_FOR_DELIVERY: 6,
  DELIVERED: 7,
  DELIVERY_FAILED: 7,
  CANCELLED: 7,
  RETURN_REQUESTED: 8,
  RETURN_IN_TRANSIT: 9,
  RETURNED: 10,
  EXCEPTION: 6,
}

function shouldApplyStatus(current: ShipmentStatus, next: ShipmentStatus) {
  if (current === next) return false
  // Terminal delivery/return states must not be moved backwards by a delayed webhook.
  if (['DELIVERED', 'CANCELLED', 'RETURNED'].includes(current)) return false
  if (['DELIVERY_FAILED', 'EXCEPTION'].includes(current) && STATUS_RANK[next] < STATUS_RANK[current]) return false
  return true
}

export async function processNormalizedWebhook(event: NormalizedWebhookEvent) {
  const db = createAdminClient()

  const { data: existing } = await db
    .from('delivery_webhook_events')
    .select('id, processed_at, processing_error')
    .eq('provider', event.provider)
    .eq('provider_event_id', event.providerEventId)
    .maybeSingle()

  if (existing?.processed_at) return { duplicate: true, updated: false }

  if (!existing) {
    const { error } = await db.from('delivery_webhook_events').insert({
      provider: event.provider,
      provider_event_id: event.providerEventId,
      provider_shipment_id: event.providerShipmentId,
      event_type: event.status,
      payload: event.payload,
    })
    if (error) {
      // Another concurrent webhook may have won the unique constraint.
      const { data: raced } = await db
        .from('delivery_webhook_events')
        .select('processed_at')
        .eq('provider', event.provider)
        .eq('provider_event_id', event.providerEventId)
        .maybeSingle()
      if (raced?.processed_at) return { duplicate: true, updated: false }
      throw new Error('Unable to record delivery webhook event.')
    }
  }

  let shipmentQuery = db
    .from('shipments')
    .select('id, order_id, provider, status, provider_shipment_id, tracking_number')
    .eq('provider', event.provider)
    .limit(1)

  if (event.providerShipmentId) shipmentQuery = shipmentQuery.eq('provider_shipment_id', event.providerShipmentId)
  else if (event.trackingNumber) shipmentQuery = shipmentQuery.eq('tracking_number', event.trackingNumber)
  else {
    await db.from('delivery_webhook_events').update({ processed_at: new Date().toISOString(), processing_error: 'Webhook did not contain a shipment identifier.' }).eq('provider', event.provider).eq('provider_event_id', event.providerEventId)
    return { duplicate: false, updated: false }
  }

  const { data: shipment, error: shipmentError } = await shipmentQuery.maybeSingle()
  if (shipmentError) throw new Error('Unable to locate shipment for webhook.')

  if (!shipment) {
    await db.from('delivery_webhook_events').update({ processed_at: new Date().toISOString(), processing_error: 'No matching shipment was found.' }).eq('provider', event.provider).eq('provider_event_id', event.providerEventId)
    return { duplicate: false, updated: false }
  }

  const currentStatus = shipment.status as ShipmentStatus
  const updates: Record<string, unknown> = {
    provider_snapshot: event.payload,
    updated_at: new Date().toISOString(),
  }
  if (event.providerShipmentId && !shipment.provider_shipment_id) updates.provider_shipment_id = event.providerShipmentId
  if (event.trackingNumber && !shipment.tracking_number) updates.tracking_number = event.trackingNumber
  if (event.status && shouldApplyStatus(currentStatus, event.status)) updates.status = event.status

  const { error: updateError } = await db.from('shipments').update(updates).eq('id', shipment.id)
  if (updateError) throw new Error('Unable to update shipment from webhook.')

  if (event.status && shouldApplyStatus(currentStatus, event.status)) {
    const { error: historyError } = await db.from('shipment_history').insert({
      shipment_id: shipment.id,
      provider: event.provider,
      previous_status: currentStatus,
      new_status: event.status,
      source: 'WEBHOOK',
      provider_event_id: event.providerEventId,
      notes: 'Status synchronized from Pathao webhook.',
      payload: event.payload,
    })
    if (historyError) throw new Error('Unable to record shipment webhook history.')
  }

  await db.from('delivery_audit_logs').insert({
    shipment_id: shipment.id,
    order_id: shipment.order_id,
    action: 'PROVIDER_WEBHOOK_PROCESSED',
    provider: event.provider,
    details: { providerEventId: event.providerEventId, status: event.status, trackingNumber: event.trackingNumber },
  })

  const { error: processedError } = await db.from('delivery_webhook_events').update({ processed_at: new Date().toISOString(), processing_error: null }).eq('provider', event.provider).eq('provider_event_id', event.providerEventId)
  if (processedError) throw new Error('Unable to mark webhook as processed.')

  return { duplicate: false, updated: Boolean(event.status && shouldApplyStatus(currentStatus, event.status)) }
}
