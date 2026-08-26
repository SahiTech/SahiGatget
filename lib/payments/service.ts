import 'server-only'

import { PAYMENT_CAPABILITIES, type PaymentAdapter, type PaymentCapability, type PaymentFailureCategory, type PaymentIntent, type PaymentProvider, type PaymentRequirement, type PaymentStatus, type PaymentStatusResult } from './contracts'
import { createAdminClient } from '@/lib/supabase/admin'

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



export function paymentRequirementForRiskAction(action: string): PaymentRequirement {
  if (action === 'ALLOW') return 'COD'
  if (action === 'ALLOW_WITH_VERIFICATION') return 'FULL_ADVANCE'
  if (action === 'MANUAL_REVIEW' || action === 'BLOCK' || action === 'TEMPORARILY_RESTRICT') return 'MANUAL_REVIEW'
  return 'FULL_ADVANCE'
}

function asPaymentIntent(row: Record<string, unknown>): PaymentIntent {
  return {
    id: String(row.id), orderId: String(row.order_id), provider: String(row.provider) as PaymentProvider, amount: Number(row.amount), currency: 'BDT', status: String(row.status) as PaymentStatus, paymentRequirement: String(row.payment_requirement) as PaymentRequirement, paymentUrl: row.payment_url ? String(row.payment_url) : null, transactionId: row.provider_transaction_id ? String(row.provider_transaction_id) : null, providerReference: row.provider_payment_id ? String(row.provider_payment_id) : null, createdAt: String(row.created_at), expiresAt: row.expires_at ? String(row.expires_at) : null,
  }
}

export async function createPaymentRecord(input: { orderId: string; amount: number; paymentRequirement: PaymentRequirement; idempotencyKey: string; expiresAt?: string | null }): Promise<PaymentIntent> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new PaymentError('The payment amount is invalid.', 'PROVIDER_ERROR')
  const db = createAdminClient()
  const { data: existing, error: lookupError } = await db.from('payment_transactions').select('*').eq('idempotency_key', input.idempotencyKey).maybeSingle()
  if (lookupError) throw new PaymentError('Payment state could not be loaded.', 'PROVIDER_ERROR')
  if (existing) return asPaymentIntent(existing as Record<string, unknown>)
  if (input.paymentRequirement !== 'COD') throw new PaymentError('No verified payment provider is configured for advance payment.', 'NOT_ENABLED')
  const provider: PaymentProvider = 'COD'
  const status: PaymentStatus = 'NOT_REQUIRED'
  const { data, error } = await db.from('payment_transactions').insert({ order_id: input.orderId, provider, amount: input.amount, currency: 'BDT', payment_requirement: input.paymentRequirement, status, idempotency_key: input.idempotencyKey, expires_at: input.expiresAt ?? null }).select('*').single()
  if (error || !data) {
    if (error?.code === '23505') {
      const { data: retry } = await db.from('payment_transactions').select('*').eq('idempotency_key', input.idempotencyKey).maybeSingle()
      if (retry) return asPaymentIntent(retry as Record<string, unknown>)
    }
    throw new PaymentError('Payment state could not be recorded.', 'PROVIDER_ERROR')
  }
  return asPaymentIntent(data as Record<string, unknown>)
}

export async function getPaymentsForOrder(orderId: string): Promise<PaymentIntent[]> {
  const db = createAdminClient()
  const { data, error } = await db.from('payment_transactions').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).limit(10)
  if (error) throw new PaymentError('Payment history could not be loaded.', 'PROVIDER_ERROR')
  return (data ?? []).map((row: Record<string, unknown>) => asPaymentIntent(row))
}

export function verifyServerAmount(expected: number, received: number) {
  return Number.isFinite(expected) && Number.isFinite(received) && Math.abs(expected - received) < 0.01
}

export function normalizePaymentStatus(input: { provider: PaymentProvider; status: PaymentStatus; transactionId?: string | null; providerReference?: string | null; amount?: number | null; currency?: string | null; failureCategory?: PaymentFailureCategory | null }): PaymentStatusResult {
  return { provider: input.provider, status: input.status, transactionId: input.transactionId ?? null, providerReference: input.providerReference ?? null, amount: input.amount ?? null, currency: input.currency ?? null, failureCategory: input.failureCategory ?? null }
}
