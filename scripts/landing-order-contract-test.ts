import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import { buildDeliveryZonesQuote } from '@/lib/orders/delivery-quote'
import { ADDRESS_LOCATION_FALLBACK, getDeliveryZoneForDivision, resolveDeliveryFieldsFromAddress } from '@/lib/orders/locations'
import { isValidBangladeshMobile, normalizePhone } from '@/lib/orders/phone'
import type { Quote } from '@/lib/orders/schema'

test('normalizes Bengali digits, international prefixes, spaces and dashes to the local mobile format', () => {
  assert.equal(normalizePhone('০১৭১২৩৪৫৬৭৮'), '01712345678')
  assert.equal(normalizePhone('+880 1712-345678'), '01712345678')
  assert.equal(normalizePhone('8801712345678'), '01712345678')
  assert.equal(normalizePhone('01 712-345-678'), '01712345678')
  assert.equal(normalizePhone('008801712345678'), '01712345678')
  assert.equal(isValidBangladeshMobile('০১৭১২৩৪৫৬৭৮'), true)
  assert.equal(isValidBangladeshMobile('+880 1712-345678'), true)
  assert.equal(isValidBangladeshMobile('01912345678'), true)
  assert.equal(isValidBangladeshMobile('01112345678'), false)
})

test('resolves Bengali Dhaka spelling to the Dhaka delivery zone', () => {
  assert.equal(getDeliveryZoneForDivision('Dhaka'), 'dhaka')
  assert.equal(getDeliveryZoneForDivision(' ঢাকা '), 'dhaka')
  assert.equal(getDeliveryZoneForDivision('ঢাকা'), 'dhaka')
  assert.equal(getDeliveryZoneForDivision('Chattogram'), 'outside_dhaka')
})

test('delivery zone quote output contains both server-provided charges and authoritative item totals', () => {
  const base: Quote = {
    productName: 'Test phone',
    variantTitle: 'Black',
    color: 'Black',
    imageUrl: null,
    sku: 'TEST-01',
    quantity: 2,
    unitPrice: 1250,
    compareAtPrice: 1500,
    discountTotal: 500,
    subtotal: 2500,
    deliveryCharge: 80,
    grandTotal: 2580,
    deliveryZone: 'dhaka',
    warrantyPolicy: 'Warranty',
    available: true,
  }
  const result = buildDeliveryZonesQuote(base, { dhakaCharge: 80, outsideDhakaCharge: 130 })
  assert.deepEqual(result, {
    productName: 'Test phone',
    variantTitle: 'Black',
    color: 'Black',
    imageUrl: null,
    sku: 'TEST-01',
    quantity: 2,
    unitPrice: 1250,
    compareAtPrice: 1500,
    discountTotal: 500,
    subtotal: 2500,
    dhakaCharge: 80,
    outsideDhakaCharge: 130,
    warrantyPolicy: 'Warranty',
    available: true,
  })
})


test('landing order form loads ahead of view without an extra start-order click', () => {
  const source = readFileSync(resolve(process.cwd(), 'components/landing-pages/landing-conversion-sections.tsx'), 'utf8')
  assert.doesNotMatch(source, /অর্ডার শুরু করুন/)
  assert.match(source, /rootMargin:\s*'480px 0px'/)
  assert.match(source, /if \(!loadForm\) return <LandingOrderFormPlaceholder \/>/)
})


test('landing checkout keeps the dynamic WhatsApp action without redundant helper copy', () => {
  const source = readFileSync(resolve(process.cwd(), 'components/landing-pages/landing-order-form.tsx'), 'utf8')
  assert.match(source, /https:\/\/wa\.me\//)
  assert.match(source, /encodeURIComponent\(/)
  assert.match(source, /quote\?\.productName \?\? product\.name/)
  assert.match(source, /quote\?\.variantTitle \|\| variantLabel\(variant\)/)
  assert.match(source, /\- পরিমাণ: \$\{quantity\}/)
  assert.doesNotMatch(source, /অথবা সরাসরি হোয়াটসঅ্যাপে অর্ডার করুন/)
  assert.doesNotMatch(source, /এটি বিকল্প যোগাযোগের মাধ্যম; মূল অর্ডার ফর্ম আগের মতোই কাজ করবে।/)
  assert.match(source, /type="submit"/)
  assert.match(source, /createGuestOrderWithRisk/)
})

test('landing footer transition is compact and sticky-order clearance is reserved at the footer edge', () => {
  const renderer = readFileSync(resolve(process.cwd(), 'components/landing-pages/landing-page-renderer.tsx'), 'utf8')
  const conversion = readFileSync(resolve(process.cwd(), 'components/landing-pages/landing-conversion-sections.tsx'), 'utf8')
  const footer = readFileSync(resolve(process.cwd(), 'components/landing-pages/landing-footer.tsx'), 'utf8')
  assert.ok(renderer.indexOf('<LandingTrustBridge />') >= 0)
  assert.ok(renderer.indexOf('<LandingTrustBridge />') < renderer.indexOf('<LandingFooter'))
  assert.match(footer, /safe-area-inset-bottom/)
  assert.doesNotMatch(conversion, /min-h-screen overflow-x-clip bg-white pb-24 text-slate-950/)
  assert.match(footer, /export function LandingTrustBridge\(/)
  assert.match(footer, /ডেলিভারি চার্জ আগে দেখুন/)
})

test('landing product color options do not depend on unique gallery image URLs and wrap at narrow widths', () => {
  const source = readFileSync(resolve(process.cwd(), 'components/landing-pages/landing-conversion-sections.tsx'), 'utf8')
  assert.match(source, /const colorVariants = product\.variants\.filter/)
  assert.match(source, /\{colorVariants\.map\(\(candidate\)/)
  assert.match(source, /flex max-w-\[58%\] shrink-0 flex-wrap/)
  assert.match(source, /focus-visible:ring-emerald-500/)
})

test('derives legacy COD district and area from the free-form address without guessing unknown areas', () => {
  const inferred = resolveDeliveryFieldsFromAddress('Dhaka', 'House 10, Road 5, Mirpur, Dhaka')
  assert.equal(inferred.district, 'Dhaka')
  assert.equal(inferred.area, 'Mirpur')

  const unrecognized = resolveDeliveryFieldsFromAddress('Dhaka', 'House 10, Road 5, Block C')
  assert.equal(unrecognized.district, ADDRESS_LOCATION_FALLBACK)
  assert.equal(unrecognized.area, ADDRESS_LOCATION_FALLBACK)
})

test('risk-aware guest order path infers legacy location fields before invoking the shared order pipeline', () => {
  const source = readFileSync(resolve(process.cwd(), 'lib/orders/actions.ts'), 'utf8')
  const riskAwareAction = source.slice(source.indexOf('export async function createGuestOrderWithRisk'))
  assert.match(riskAwareAction, /resolveDeliveryFieldsFromAddress\(parsed\.data\.division, parsed\.data\.address\)/)
  assert.match(riskAwareAction, /district: parsed\.data\.district\?\.trim\(\) \|\| inferredLocation\.district/)
  assert.match(riskAwareAction, /area: parsed\.data\.area\?\.trim\(\) \|\| inferredLocation\.area/)
})
