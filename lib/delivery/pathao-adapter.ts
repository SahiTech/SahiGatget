import 'server-only'

import { testPathaoConnection } from './pathao'
import { normalizePathaoWebhook } from './pathao-webhook'
import type { DeliveryAdapter } from './contracts'

/**
 * Pathao's order creation remains behind the existing guarded Admin Orders
 * surface. The adapter exposes only capabilities that are actually implemented
 * here, so provider selection cannot advertise unsupported operations.
 */
export const pathaoDeliveryAdapter: DeliveryAdapter = {
  provider: 'PATHAO',
  capabilities: new Set(['WEBHOOK']),
  async testConnection() {
    const result = await testPathaoConnection()
    const required = [result.authentication, result.store, result.city, result.zone, result.area, result.price]
    const ok = required.every((item) => item.status === 'PASS')
    return {
      ok,
      message: ok
        ? 'Pathao authentication, merchant store, location, and price readiness passed.'
        : 'Pathao readiness is incomplete; authentication, merchant store, city, zone, area, and price must all pass.',
    }
  },
  async normalizeWebhook(payload, headers) {
    return normalizePathaoWebhook(payload, headers)
  },
}
