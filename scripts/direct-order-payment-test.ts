import Module from 'node:module'
import assert from 'node:assert/strict'

type ModuleLoader = (request: string, parent: unknown, isMain: boolean) => unknown
const runtimeModule = Module as unknown as { _load: ModuleLoader }
const originalLoad = runtimeModule._load
runtimeModule._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'server-only') return {}
  if (request === '@/lib/supabase/admin') return { createAdminClient: () => { throw new Error('database access is prohibited in this test') } }
  if (request === '@/lib/analytics/events') return { recordCommerceEvent: async () => undefined }
  return originalLoad.call(this, request, parent, isMain)
}

process.env.BDGATE_LIVE_API_KEY = ['bd', 'live', 'synthetic_test_only'].join('_')

function testRiskAndPaymentHelpers() {
  const signals = (overrides: Record<string, unknown> = {}) => ({ totalOrders: 0, cancelledOrders: 0, returnedOrders: 0, paymentFailures: 0, rapidAttempts: 0, recentCancellation: false, successfulDeliveries: 0, ...overrides })
  return import('../lib/risk/service.ts').then(async ({ DEFAULT_RISK_POLICY, scoreCustomerRisk, riskCategoryForLevel }) => {
    const { unavailableFraudIntelligence } = await import('../lib/risk/fraud.ts')
    const { businessRiskCategoryForAction } = await import('../lib/risk/categories.ts')
    const { paymentRequirementForRiskAction, verifyServerAmount, normalizePaymentStatus } = await import('../lib/payments/service.ts')
    assert.equal(scoreCustomerRisk(signals(), DEFAULT_RISK_POLICY).action, 'ALLOW')
    assert.equal(scoreCustomerRisk(signals({ cancelledOrders: 1, recentCancellation: true }), DEFAULT_RISK_POLICY).action, 'ALLOW_WITH_VERIFICATION')
    assert.equal(scoreCustomerRisk(signals({ returnedOrders: 1, paymentFailures: 1, rapidAttempts: 1 }), DEFAULT_RISK_POLICY).action, 'REQUIRE_PREPAYMENT')
    assert.equal(scoreCustomerRisk(signals({ cancelledOrders: 3, returnedOrders: 1, paymentFailures: 1, rapidAttempts: 1, recentCancellation: true }), DEFAULT_RISK_POLICY).action, 'BLOCK')
    assert.equal(riskCategoryForLevel('LOW'), 'GOOD')
    assert.equal(riskCategoryForLevel('MEDIUM'), 'MEDIUM')
    assert.equal(riskCategoryForLevel('HIGH'), 'BAD')
    assert.equal(riskCategoryForLevel('CRITICAL'), 'BLOCK')
    assert.equal(paymentRequirementForRiskAction('ALLOW'), 'COD')
    assert.equal(paymentRequirementForRiskAction('ALLOW_WITH_VERIFICATION'), 'FULL_ADVANCE')
    assert.equal(paymentRequirementForRiskAction('REQUIRE_PREPAYMENT'), 'FULL_ADVANCE')
    assert.equal(paymentRequirementForRiskAction('MANUAL_REVIEW'), 'MANUAL_REVIEW')
    assert.equal(paymentRequirementForRiskAction('BLOCK'), 'MANUAL_REVIEW')
    assert.equal(paymentRequirementForRiskAction('TEMPORARILY_RESTRICT'), 'MANUAL_REVIEW')
    assert.equal(verifyServerAmount(1500, 1500), true)
    assert.equal(verifyServerAmount(1500, 1499), false)
    assert.equal(verifyServerAmount(1500, 1501), false)
    assert.equal(verifyServerAmount(1500, Number.NaN), false)
    assert.deepEqual(normalizePaymentStatus({ provider: 'BDGATE', status: 'PAID', amount: 1500, currency: 'BDT' }), { provider: 'BDGATE', status: 'PAID', transactionId: null, providerReference: null, amount: 1500, currency: 'BDT', failureCategory: null })
    assert.deepEqual(unavailableFraudIntelligence(), { provider: 'none', status: 'UNAVAILABLE', signal: 'UNKNOWN', reference: null })
    assert.deepEqual(['ALLOW', 'ALLOW_WITH_VERIFICATION', 'REQUIRE_PREPAYMENT', 'MANUAL_REVIEW', 'TEMPORARILY_RESTRICT', 'BLOCK'].map((action) => businessRiskCategoryForAction(action as never)), ['GOOD', 'MEDIUM', 'BAD', 'BAD', 'BAD', 'BLOCK'])
  })
}

async function testBdGateAdapter() {
  let calls = 0
  let mode: 'create' | 'status' | 'malformed' | 'timeout' = 'create'
  globalThis.fetch = (async () => {
    calls += 1
    if (mode === 'timeout') throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    if (mode === 'malformed') return new Response('{}', { status: 200 })
    if (mode === 'create') return new Response(JSON.stringify({ success: true, payment_url: 'https://sandbox.invalid/checkout', session_token: 'synthetic-session', amount: 1500, currency: 'BDT' }), { status: 200 })
    return new Response(JSON.stringify({ status: 'paid', amount: 1499, currency: 'BDT', order_id: 'different-order', transaction_id: 'synthetic-tx', payment_id: 'synthetic-payment' }), { status: 200 })
  }) as typeof fetch
  const { createBdGateAdapter } = await import('../lib/payments/bdgate.ts')
  const adapter = createBdGateAdapter()
  const created = await adapter.createPayment!({ orderId: 'synthetic-order', amount: 1500, idempotencyKey: 'synthetic-key', customerName: 'Synthetic Customer', successUrl: 'https://sandbox.invalid/success', failUrl: 'https://sandbox.invalid/fail', cancelUrl: 'https://sandbox.invalid/cancel' })
  assert.equal(created.providerPaymentId, 'synthetic-session')
  assert.equal(created.redirectUrl, 'https://sandbox.invalid/checkout')
  mode = 'status'
  const mismatch = await adapter.verifyPayment!({ providerPaymentId: 'synthetic-session', expectedAmount: 1500, expectedCurrency: 'BDT', expectedOrderId: 'synthetic-order' })
  assert.equal(mismatch.status, 'FAILED')
  assert.equal(mismatch.failureCategory, 'PAYMENT_AMOUNT_MISMATCH')
  mode = 'malformed'
  const malformed = await adapter.createPayment!({ orderId: 'synthetic-order', amount: 1500, idempotencyKey: 'synthetic-key-2', customerName: 'Synthetic Customer', successUrl: 'https://sandbox.invalid/success', failUrl: 'https://sandbox.invalid/fail', cancelUrl: 'https://sandbox.invalid/cancel' }).catch((error: Error) => error.message)
  assert.equal(malformed, 'PAYMENT_PROVIDER_UNAVAILABLE')
  mode = 'timeout'
  const timeout = await adapter.getPaymentStatus!({ providerPaymentId: 'synthetic-session' })
  assert.equal(timeout.status, 'FAILED')
  assert.equal(timeout.failureCategory, 'PAYMENT_TIMEOUT')
  assert.ok(calls >= 4)
}

Promise.all([testRiskAndPaymentHelpers(), testBdGateAdapter()]).then(() => {
  console.log('direct-order risk/payment synthetic tests: PASS')
  console.log('four-tier risk routing: GOOD→COD, MEDIUM→FULL_ADVANCE, BAD→FULL_ADVANCE, BLOCK→MANUAL_REVIEW')
  console.log('external network calls: 0')
  console.log('database mutations: 0')
  console.log('real customer/payment data: 0')
}).catch((error) => {
  console.error(error)
  process.exit(1)
})
