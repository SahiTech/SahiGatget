import 'server-only'

import { testPathaoConnection } from './pathao'
import type { DeliveryAdapter } from './contracts'

/**
 * Pathao's verified Phase 2 operations require order-specific Admin Orders
 * context that the generic DeliveryAdapter input does not carry safely: the
 * selected merchant store, delivery/item type, and parcel weight. Therefore
 * the existing guarded Admin Orders flow remains the only generic-looking
 * create surface, while unsupported generic capabilities stay unregistered.
 */
export const pathaoDeliveryAdapter: DeliveryAdapter = {
  provider: 'PATHAO',
  capabilities: new Set(),
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
}
