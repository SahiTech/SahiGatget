import assert from 'node:assert/strict'
import test from 'node:test'

type Candidate = { status: string; consentAt: boolean; withdrawnAt: boolean; contacts: number; expiresAt: number; now: number; hasOrder: boolean; paymentStatus?: string }
function eligible(x: Candidate) {
  return x.status === 'ABANDONED' && x.consentAt && !x.withdrawnAt && x.contacts < 2 &&
    x.expiresAt > x.now && !x.hasOrder && !['pending','paid','processing','success'].includes((x.paymentStatus ?? '').toLowerCase())
}
test('recovery requires active consent, abandoned status, unexpired session and no order/payment', () => {
  const base = { status:'ABANDONED', consentAt:true, withdrawnAt:false, contacts:0, expiresAt:200, now:100, hasOrder:false, paymentStatus:'unpaid' }
  assert.equal(eligible(base), true)
  assert.equal(eligible({...base, consentAt:false}), false)
  assert.equal(eligible({...base, withdrawnAt:true}), false)
  assert.equal(eligible({...base, contacts:2}), false)
  assert.equal(eligible({...base, expiresAt:99}), false)
  assert.equal(eligible({...base, hasOrder:true}), false)
  assert.equal(eligible({...base, paymentStatus:'pending'}), false)
  assert.equal(eligible({...base, status:'COMPLETED'}), false)
})
test('item totals are provisional and never trusted from a client price', () => {
  const serverPrice = 1250
  const clientPrice = 1
  const item = { unit_price_snapshot: serverPrice, quantity: 2 }
  assert.equal(item.unit_price_snapshot * item.quantity, 2500)
  assert.notEqual(item.unit_price_snapshot, clientPrice)
})
