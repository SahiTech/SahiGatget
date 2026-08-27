import assert from 'node:assert/strict'

const { scoreCustomerRisk, DEFAULT_RISK_POLICY } = await import('../lib/risk/service.ts')

const base = {
  totalOrders: 0,
  cancelledOrders: 0,
  returnedOrders: 0,
  paymentFailures: 0,
  rapidAttempts: 0,
  recentCancellation: false,
  successfulDeliveries: 0,
}

assert.equal(scoreCustomerRisk(base, DEFAULT_RISK_POLICY).category, 'GOOD')
assert.equal(scoreCustomerRisk({ ...base, cancelledOrders: 1, recentCancellation: true }, DEFAULT_RISK_POLICY).category, 'MEDIUM')
assert.equal(scoreCustomerRisk({ ...base, cancelledOrders: 3 }, DEFAULT_RISK_POLICY).category, 'BAD')
assert.equal(scoreCustomerRisk({ ...base, cancelledOrders: 3, returnedOrders: 1, paymentFailures: 1, rapidAttempts: 1, recentCancellation: true }, DEFAULT_RISK_POLICY).category, 'BLOCK')

console.log('SAHIGADGET RISK BUSINESS CATEGORIES: PASS')
