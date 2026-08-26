import 'server-only'

import { PAYMENT_CAPABILITIES, type PaymentAdapter, type PaymentCapability, type PaymentProvider } from './contracts'

export class PaymentError extends Error {
  constructor(message: string, readonly code: 'NOT_ENABLED' | 'NOT_SUPPORTED' | 'PROVIDER_ERROR' | 'DUPLICATE') {
    super(message)
    this.name = 'PaymentError'
  }
}

const adapters = new Map<PaymentProvider, PaymentAdapter>()

const codAdapter: PaymentAdapter = { provider: 'COD', capabilities: new Set<PaymentCapability>(['CREATE_PAYMENT', 'QUERY_STATUS']) }

export function registerPaymentAdapter(adapter: PaymentAdapter) { adapters.set(adapter.provider, adapter) }
export function getPaymentAdapter(provider: PaymentProvider) { return adapters.get(provider) ?? null }
export function listPaymentAdapters() { return [...adapters.values()] }
export function assertPaymentCapability(adapter: PaymentAdapter, capability: PaymentCapability) {
  if (!adapter.capabilities.has(capability)) throw new PaymentError(`${adapter.provider} does not support ${capability}.`, 'NOT_SUPPORTED')
}

registerPaymentAdapter(codAdapter)

export function listPaymentMethods() {
  return PAYMENT_CAPABILITIES.map((capability) => capability).length > 0
    ? [
        { provider: 'COD' as const, enabled: true, capabilities: [...codAdapter.capabilities] },
        { provider: 'BKASH' as const, enabled: false, capabilities: [] },
        { provider: 'NAGAD' as const, enabled: false, capabilities: [] },
        { provider: 'ROCKET' as const, enabled: false, capabilities: [] },
      ]
    : []
}

export function verifyPaymentProvider(provider: PaymentProvider) {
  const adapter = getPaymentAdapter(provider)
  if (!adapter) throw new PaymentError('This payment method is not enabled.', 'NOT_ENABLED')
  return adapter
}
