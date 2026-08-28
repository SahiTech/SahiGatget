import assert from 'node:assert/strict'
import Module from 'node:module'

type ModuleLoader = (request: string, parent: unknown, isMain: boolean) => unknown
const runtimeModule = Module as unknown as { _load: ModuleLoader }
const originalLoad = runtimeModule._load
runtimeModule._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === 'server-only') return {}
  if (request === '@/lib/supabase/admin') return { createAdminClient: () => { throw new Error('database access is prohibited in this test') } }
  if (request === '@/lib/analytics/events') return { recordCommerceEvent: async () => undefined }
  return originalLoad.call(this, request, parent, isMain)
}

async function main() {
  const { scoreCustomerRisk, DEFAULT_RISK_POLICY, riskCategoryForLevel } = await import('../lib/risk/service.ts')

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
  assert.equal(scoreCustomerRisk({ ...base, cancelledOrders: 3, returnedOrders: 1 }, DEFAULT_RISK_POLICY).category, 'BAD')
  assert.equal(scoreCustomerRisk({ ...base, cancelledOrders: 3, returnedOrders: 1, paymentFailures: 1, rapidAttempts: 1, recentCancellation: true }, DEFAULT_RISK_POLICY).category, 'BLOCK')
  assert.equal(riskCategoryForLevel('LOW'), 'GOOD')
  assert.equal(riskCategoryForLevel('MEDIUM'), 'MEDIUM')
  assert.equal(riskCategoryForLevel('HIGH'), 'BAD')
  assert.equal(riskCategoryForLevel('CRITICAL'), 'BLOCK')

  console.log('SAHIGADGET RISK BUSINESS CATEGORIES: PASS')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
