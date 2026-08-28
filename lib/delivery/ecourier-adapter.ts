import 'server-only'

import type { DeliveryAdapter } from './contracts'
import { createECourierOrder, testECourierConnection, trackECourierShipment } from './ecourier'

export const ecourierDeliveryAdapter: DeliveryAdapter = {
  provider: 'ECOURIER',
  capabilities: new Set(['CREATE_SHIPMENT', 'TRACK_SHIPMENT']),
  async testConnection() {
    try {
      const result = await testECourierConnection()
      return { ok: result.ok, message: result.ok ? `eCourier connected. ${result.packageCount} package plans available.` : 'eCourier connection check did not pass.' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'eCourier connection failed.' }
    }
  },
  async createShipment(input) { return createECourierOrder(input) },
  async trackShipment(trackingNumber) { return trackECourierShipment(trackingNumber) },
}
