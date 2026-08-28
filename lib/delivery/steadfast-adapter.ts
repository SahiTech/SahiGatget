import 'server-only'

import type { DeliveryAdapter } from './contracts'
import { createSteadfastOrder, normalizeSteadfastWebhook, testSteadfastConnection, trackSteadfastShipment } from './steadfast'

export const steadfastDeliveryAdapter: DeliveryAdapter = {
  provider: 'STEADFAST',
  capabilities: new Set(['CREATE_SHIPMENT', 'TRACK_SHIPMENT', 'WEBHOOK', 'GET_BALANCE']),
  async testConnection() {
    try {
      const result = await testSteadfastConnection()
      return { ok: result.ok, message: result.ok ? `Steadfast connected. Current balance: ${result.balance ?? 'unavailable'}.` : 'Steadfast balance check did not pass.' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Steadfast connection failed.' }
    }
  },
  async createShipment(input) { return createSteadfastOrder(input) },
  async trackShipment(trackingNumber) { return trackSteadfastShipment(trackingNumber) },
  async normalizeWebhook(payload, headers) { return normalizeSteadfastWebhook(payload, headers) },
}
