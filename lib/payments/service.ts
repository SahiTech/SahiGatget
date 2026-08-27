import 'server-only'

import { PAYMENT_CAPABILITIES, type PaymentAdapter, type PaymentCapability, type PaymentFailureCategory, type PaymentIntent, type PaymentProvider, type PaymentRequirement, type PaymentStatus, type PaymentStatusResult } from './contracts'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBdGateAdapter } from './bdgate'

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
if (process.env.BDGATE_LIVE_API_KEY) registerPaymentAdapter(createBdGateAdapter())

export function listPaymentMethods() {
  return PAYMENT_CAPABILITIES.map((capability) => capability).length > 0
    ? [
        { provider: 'COD' as const, enabled: true, capabilities: [...codAdapter.capabilities] },
        { provider: 'BDGATE' as const, enabled: Boolean(process.env.BDGATE_LIVE_API_KEY), capabilities: ['CREATE_PAYMENT', 'VERIFY_PAYMENT', 'QUERY_STATUS'] },
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

export function paymentPolicyForRiskDecision(action: string): PaymentRequirement {
  return paymentRequirementForRiskAction(action)
}

async function configuredPaymentProvider(requirement: PaymentRequirement): Promise<PaymentProvider> {
  if (requirement === 'COD') return 'COD'
  const db = createAdminClient()
  const { data } = await db.from('settings').select('value').eq('key', 'payment_policy').maybeSingle()
  const policy = data?.value && typeof data.value === 'object' ? data.value as Record<string, unknown> : null
  if (policy?.defaultProvider !== 'BDGATE' || policy.bdgateEnabled === false) throw new PaymentError('No enabled online payment provider is configured.', 'NOT_ENABLED')
  return 'BDGATE'
}

export async function paymentProviderForPaymentRequirement(requirement: PaymentRequirement): Promise<PaymentProvider> {
  return configuredPaymentProvider(requirement)
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


const terminalPaymentStatuses = new Set<PaymentStatus>(['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'])
const allowedPaymentTransitions: Record<PaymentStatus, PaymentStatus[]> = {
  NOT_REQUIRED: ['NOT_REQUIRED'], PENDING: ['PENDING', 'INITIATED', 'FAILED', 'CANCELLED', 'EXPIRED'], INITIATED: ['INITIATED', 'PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'], AUTHORIZED: ['AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED'], PAID: ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'], FAILED: ['FAILED', 'PENDING', 'INITIATED'], CANCELLED: ['CANCELLED', 'PENDING', 'INITIATED'], EXPIRED: ['EXPIRED', 'PENDING', 'INITIATED'], REFUNDED: ['REFUNDED'], PARTIALLY_REFUNDED: ['PARTIALLY_REFUNDED', 'REFUNDED'],
}

function assertPaymentTransition(current: PaymentStatus, next: PaymentStatus) {
  if (!allowedPaymentTransitions[current]?.includes(next)) throw new PaymentError('This payment state transition is not allowed.', 'NOT_SUPPORTED')
}

export async function initiatePaymentForOrder(input: { orderId: string; amount: number; paymentRequirement: PaymentRequirement; idempotencyKey: string; customerName: string; customerEmail?: string | null; customerPhone?: string | null; successUrl: string; failUrl: string; cancelUrl: string }): Promise<PaymentIntent> {
  if (input.paymentRequirement === 'COD') return createPaymentRecord(input)
  if (input.paymentRequirement === 'MANUAL_REVIEW') throw new PaymentError('Manual review is required before payment initiation.', 'NOT_SUPPORTED')
  const db = createAdminClient()
  const provider = await paymentProviderForPaymentRequirement(input.paymentRequirement)
  const adapter = getPaymentAdapter(provider)
  if (!adapter) throw new PaymentError('No verified payment provider is configured.', 'NOT_ENABLED')
  assertPaymentCapability(adapter, 'CREATE_PAYMENT')
  const created = await adapter.createPayment?.({ orderId: input.orderId, amount: input.amount, idempotencyKey: input.idempotencyKey, customerName: input.customerName, customerEmail: input.customerEmail, customerPhone: input.customerPhone, successUrl: input.successUrl, failUrl: input.failUrl, cancelUrl: input.cancelUrl })
  if (!created) throw new PaymentError('The payment provider cannot create a checkout session.', 'NOT_SUPPORTED')
  const { data: existing } = await db.from('payment_transactions').select('*').eq('idempotency_key', input.idempotencyKey).maybeSingle()
  if (existing) return asPaymentIntent(existing as Record<string, unknown>)
  const { data, error } = await db.from('payment_transactions').insert({ order_id: input.orderId, provider: adapter.provider, provider_payment_id: created.providerPaymentId, amount: input.amount, currency: 'BDT', payment_requirement: input.paymentRequirement, status: 'INITIATED', idempotency_key: input.idempotencyKey, payment_url: created.redirectUrl, expires_at: created.expiresAt ?? null }).select('*').single()
  if (error || !data) throw new PaymentError('The payment checkout could not be recorded safely.', 'PROVIDER_ERROR')
  return asPaymentIntent(data as Record<string, unknown>)
}

export async function refreshPaymentStatus(input: { paymentId: string; orderId: string; expectedAmount: number }) {
  const db = createAdminClient()
  const { data: payment, error: paymentError } = await db.from('payment_transactions').select('*').eq('id', input.paymentId).eq('order_id', input.orderId).maybeSingle()
  if (paymentError || !payment) throw new PaymentError('Payment record could not be found.', 'PROVIDER_ERROR')
  const current = String(payment.status) as PaymentStatus
  if (terminalPaymentStatuses.has(current) && current !== 'PAID') return asPaymentIntent(payment as Record<string, unknown>)
  const provider = String(payment.provider) as PaymentProvider
  const adapter = getPaymentAdapter(provider)
  if (!adapter?.getPaymentStatus || !payment.provider_payment_id) throw new PaymentError('Payment status verification is not available.', 'NOT_SUPPORTED')
  assertPaymentCapability(adapter, 'QUERY_STATUS')
  const result = await adapter.getPaymentStatus({ providerPaymentId: String(payment.provider_payment_id) })
  const next: PaymentStatus = result.status
  assertPaymentTransition(current, next)
  if (next === 'PAID' && (!verifyServerAmount(input.expectedAmount, Number(result.amount)) || result.currency !== 'BDT')) {
    const { data } = await db.from('payment_transactions').update({ status: 'FAILED', failure_category: 'PAYMENT_AMOUNT_MISMATCH', failure_message: 'Provider amount or currency did not match the server order.', updated_at: new Date().toISOString() }).eq('id', input.paymentId).eq('order_id', input.orderId).select('*').single()
    throw new PaymentError(data ? 'Payment verification failed because the amount or currency did not match.' : 'Payment verification failed.', 'PROVIDER_ERROR')
  }
  const { data, error } = await db.from('payment_transactions').update({ status: next, provider_transaction_id: result.transactionId, failure_category: result.failureCategory, updated_at: new Date().toISOString(), paid_at: next === 'PAID' ? new Date().toISOString() : payment.paid_at }).eq('id', input.paymentId).eq('order_id', input.orderId).select('*').single()
  if (error || !data) throw new PaymentError('Payment status could not be saved.', 'PROVIDER_ERROR')
  if (next === 'PAID') {
    const { error: orderError } = await db.from('orders').update({ payment_status: 'paid', updated_at: new Date().toISOString() }).eq('id', input.orderId).eq('payment_status', 'pending')
    if (orderError) throw new PaymentError('Payment was verified but order confirmation is pending review.', 'PROVIDER_ERROR')
  }
  return asPaymentIntent(data as Record<string, unknown>)
}
