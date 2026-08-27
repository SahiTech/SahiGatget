import 'server-only'

import type { PaymentAdapter, PaymentFailureCategory, PaymentStatusResult } from './contracts'

const BDGATE_API_ROOT = 'https://api.bdgate.net/api'
const REQUEST_TIMEOUT_MS = 8000

type BdGateCheckoutResponse = {
  success?: boolean
  payment_url?: unknown
  checkout_url?: unknown
  session_token?: unknown
  slug?: unknown
  order_id?: unknown
  amount?: unknown
  currency?: unknown
  expires_at?: unknown
}

type BdGateSessionResponse = {
  session_token?: unknown
  amount?: unknown
  currency?: unknown
  status?: unknown
  transaction_id?: unknown
  payment_id?: unknown
  order_id?: unknown
}

function apiKey() {
  const key = process.env.BDGATE_LIVE_API_KEY
  if (!key || !/^bd_live_[A-Za-z0-9_\-]+$/.test(key)) throw new Error('BDGATE_NOT_CONFIGURED')
  return key
}

async function request(path: string, init: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${BDGATE_API_ROOT}${path}`, { ...init, signal: controller.signal, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-API-Key': apiKey(), ...(init.headers ?? {}) }, cache: 'no-store' })
    const body = await response.json().catch(() => null) as unknown
    if (!response.ok) throw new Error(`BDGATE_HTTP_${response.status}`)
    if (!body || typeof body !== 'object') throw new Error('BDGATE_MALFORMED_RESPONSE')
    return body
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('BDGATE_TIMEOUT')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function numberValue(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function failureCategory(error: unknown): PaymentFailureCategory {
  const message = error instanceof Error ? error.message : ''
  if (message === 'BDGATE_TIMEOUT') return 'PAYMENT_TIMEOUT'
  if (message === 'BDGATE_NOT_CONFIGURED') return 'PAYMENT_PROVIDER_UNAVAILABLE'
  return 'PAYMENT_PROVIDER_UNAVAILABLE'
}

function mapStatus(status: unknown): PaymentStatusResult['status'] {
  const value = String(status ?? '').toLowerCase()
  if (['completed', 'paid', 'success', 'successful'].includes(value)) return 'PAID'
  if (['failed', 'failure', 'declined'].includes(value)) return 'FAILED'
  if (['cancelled', 'canceled'].includes(value)) return 'CANCELLED'
  if (['expired'].includes(value)) return 'EXPIRED'
  return 'PENDING'
}

export function createBdGateAdapter(): PaymentAdapter {
  return {
    provider: 'BDGATE',
    capabilities: new Set(['CREATE_PAYMENT', 'VERIFY_PAYMENT', 'QUERY_STATUS']),
    createPayment: async (input) => {
      try {
        const body = await request('/v1/checkout', { method: 'POST', body: JSON.stringify({ amount: input.amount, order_id: input.orderId, customer_name: input.customerName, customer_email: input.customerEmail ?? undefined, customer_phone: input.customerPhone ?? undefined, currency: 'BDT', description: `SahiGadget order ${input.orderId}`, success_url: input.successUrl, fail_url: input.failUrl, cancel_url: input.cancelUrl, webhook_url: input.webhookUrl, metadata: { idempotency_key: input.idempotencyKey } }) }) as BdGateCheckoutResponse
        const redirectUrl = textValue(body.payment_url) ?? textValue(body.checkout_url)
        const providerPaymentId = textValue(body.session_token) ?? textValue(body.slug)
        if (body.success !== true || !redirectUrl || !providerPaymentId) throw new Error('BDGATE_MALFORMED_RESPONSE')
        return { providerPaymentId, redirectUrl, status: 'PENDING' as const, expiresAt: textValue(body.expires_at) }
      } catch (error) {
        throw new Error(failureCategory(error))
      }
    },
    verifyPayment: async (input) => {
      try {
        const body = await request(`/bdgate-pay/sessions/${encodeURIComponent(input.providerPaymentId)}`, { method: 'GET' }) as BdGateSessionResponse
        const status = mapStatus(body.status)
        const amount = numberValue(body.amount)
        const currency = textValue(body.currency)
        const orderId = textValue(body.order_id)
        if (status === 'PAID' && ((input.expectedAmount !== undefined && amount !== input.expectedAmount) || currency !== (input.expectedCurrency ?? 'BDT') || (input.expectedOrderId && orderId && orderId !== input.expectedOrderId))) return { status: 'FAILED' as const, amount: amount ?? undefined, currency: currency ?? undefined, providerReference: input.providerPaymentId, failureCategory: 'PAYMENT_AMOUNT_MISMATCH' as const }
        return { status: status === 'PAID' ? 'VERIFIED' as const : status === 'FAILED' ? 'FAILED' as const : 'PENDING' as const, amount: amount ?? undefined, currency: currency ?? undefined, transactionId: textValue(body.transaction_id), providerReference: textValue(body.payment_id) ?? input.providerPaymentId, failureCategory: null }
      } catch (error) {
        return { status: 'FAILED' as const, providerReference: input.providerPaymentId, failureCategory: failureCategory(error) }
      }
    },
    getPaymentStatus: async ({ providerPaymentId }) => {
      try {
        const body = await request(`/bdgate-pay/sessions/${encodeURIComponent(providerPaymentId)}`, { method: 'GET' }) as BdGateSessionResponse
        return { provider: 'BDGATE' as const, status: mapStatus(body.status), transactionId: textValue(body.transaction_id), providerReference: textValue(body.payment_id) ?? providerPaymentId, amount: numberValue(body.amount), currency: textValue(body.currency), failureCategory: null }
      } catch (error) {
        return { provider: 'BDGATE' as const, status: 'FAILED' as const, transactionId: null, providerReference: providerPaymentId, amount: null, currency: null, failureCategory: failureCategory(error) }
      }
    },
  }
}
