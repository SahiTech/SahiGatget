import 'server-only'

import type { DeliveryAdapter } from './contracts'
import { createRedxParcel, normalizeRedxWebhook, resolveRedxDeliveryArea, testRedxConnection, trackRedxParcel } from './redx'

export const redxDeliveryAdapter: DeliveryAdapter = {
  provider: 'REDX',
  capabilities: new Set(['CREATE_SHIPMENT', 'TRACK_SHIPMENT', 'WEBHOOK']),
  async testConnection() {
    try {
      const result = await testRedxConnection()
      return { ok: result.ok, message: result.message }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'REDX connection failed.' }
    }
  },
  async createShipment(input) {
    const area = await resolveRedxDeliveryArea(input.order.customer)
    return createRedxParcel({ ...input, deliveryArea: String(area.name), deliveryAreaId: Number(area.id) })
  },
  async trackShipment(trackingNumber) { return trackRedxParcel(trackingNumber) },
  async normalizeWebhook(payload, headers) {
    const requestUrl = headers.get('x-redx-webhook-url')
    if (!requestUrl) throw new Error('REDX webhook request URL context is missing.')
    return normalizeRedxWebhook(payload, requestUrl)
  },
}
