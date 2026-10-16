'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { CircleCheck, LoaderCircle, ShieldCheck, Truck } from 'lucide-react'
import { siteConfig } from '@/config/site'
import { createGuestOrderWithRisk, prepareGuestCheckout, quoteDeliveryZones } from '@/lib/orders/actions'
import { saveCheckoutRecoveryDraft } from '@/lib/commerce/checkout-recovery-actions'
import { isValidBangladeshMobile, normalizePhone } from '@/lib/orders/phone'
import { DIVISIONS, isDivision } from '@/lib/orders/locations'
import { getAnalyticsConsent, trackClientEvent } from '@/lib/analytics/client'
import { SearchSelect } from '@/components/order/search-select'
import type { DeliveryZonesQuote, OrderSuccessSummary } from '@/lib/orders/schema'
import type { StorefrontProduct, StorefrontVariant } from '@/lib/services/storefront-utils'

type FormState = { fullName: string; phone: string; division: string; address: string }
type ReturningCustomer = FormState
const initialForm: FormState = { fullName: '', phone: '', division: '', address: '' }
const CUSTOMER_PREFILL_KEY = 'sahigadget-customer-prefill-v1'
const RECOVERY_CONSENT_KEY = 'sahigadget-recovery-consent:'

function money(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `৳${value.toLocaleString('bn-BD')}`
}
function variantLabel(variant: StorefrontVariant) {
  return [variant.ram, variant.storage, variant.color].filter(Boolean).join(' / ') || variant.variant_title
}
function translateMessage(message: string) {
  if (/INSUFFICIENT_STOCK|no longer available|not currently available|unavailable to order/i.test(message)) return 'দুঃখিত, এই ভ্যারিয়েন্টটি এখন স্টকে নেই। পরিমাণ বা ভ্যারিয়েন্ট পরিবর্তন করে আবার চেষ্টা করুন।'
  if (/price|total|quote|মোট মূল্য/i.test(message)) return 'পণ্যের মূল্য বা ডেলিভারি চার্জ বদলেছে। নতুন মোট মূল্য দেখে আবার কনফার্ম করুন।'
  if (/verify|manual review|support|restricted|prepayment/i.test(message)) return 'অর্ডারটি নিশ্চিত করার আগে কিছু তথ্য যাচাই করতে হবে। সহায়তার জন্য আমাদের সঙ্গে যোগাযোগ করুন।'
  if (/quantity/i.test(message)) return 'অনুগ্রহ করে ১–১০ এর মধ্যে সঠিক পরিমাণ নির্বাচন করুন।'
  if (/delivery configuration|calculate your order total/i.test(message)) return 'ডেলিভারি চার্জ এখন হিসাব করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।'
  return 'এই মুহূর্তে অর্ডার নেওয়া যাচ্ছে না। আপনার তথ্য ঠিক আছে কি না দেখে আবার চেষ্টা করুন।'
}

function translateFieldErrors(errors: Record<string, string>) {
  const bengali: Record<string, string> = {
    fullName: 'আপনার নাম অন্তত ২ অক্ষরে লিখুন।',
    phone: 'সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন।',
    division: 'ডেলিভারির বিভাগ নির্বাচন করুন।',
    district: 'আপনার জেলা নির্বাচন করুন।',
    area: 'এলাকা বা উপজেলা লিখুন।',
    address: 'বাড়ি, সড়ক বা কাছের পরিচিত স্থানসহ সম্পূর্ণ ঠিকানা লিখুন।',
  }
  return Object.fromEntries(Object.keys(errors).map((field) => [field, bengali[field] ?? 'তথ্যটি যাচাই করে আবার চেষ্টা করুন।']))
}

function checkoutStorageKey(pathname: string, productId: string, variantId: string) {
  return `sahigadget-landing-checkout-request:${pathname}:${productId}:${variantId}`
}
function storedCheckoutId(pathname: string, productId: string, variantId: string) {
  const key = checkoutStorageKey(pathname, productId, variantId)
  try {
    const saved = window.sessionStorage.getItem(key)
    if (saved) return saved
    const id = crypto.randomUUID()
    window.sessionStorage.setItem(key, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}
function storedRecoveryToken(checkoutRequestId: string) {
  const key = `sahigadget-recovery-token:${checkoutRequestId}`
  try {
    const saved = window.sessionStorage.getItem(key)
    if (saved) return saved
    const token = crypto.randomUUID() + crypto.randomUUID()
    window.sessionStorage.setItem(key, token)
    return token
  } catch {
    return crypto.randomUUID() + crypto.randomUUID()
  }
}
function subscribeReturningCustomer(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}
function getReturningCustomerSnapshot() {
  try { return window.localStorage.getItem(CUSTOMER_PREFILL_KEY) } catch { return null }
}
function getServerReturningCustomerSnapshot() { return null }

function readReturningCustomer(raw: string | null): { values: FormState; applied: boolean } {
  try {
    if (!raw) return { values: initialForm, applied: false }
    const value = JSON.parse(raw) as Partial<ReturningCustomer>
    const division = typeof value.division === 'string' && isDivision(value.division) ? value.division : ''
    return {
      values: {
        fullName: typeof value.fullName === 'string' ? value.fullName.slice(0, 120) : '',
        phone: typeof value.phone === 'string' ? value.phone.slice(0, 32) : '',
        division,
        address: typeof value.address === 'string' ? value.address.slice(0, 500) : '',
      },
      applied: true,
    }
  } catch {
    return { values: initialForm, applied: false }
  }
}
function saveReturningCustomer(values: FormState) {
  try {
    const safeValues: ReturningCustomer = {
      fullName: values.fullName.trim().slice(0, 120),
      phone: normalizePhone(values.phone).slice(0, 32),
      division: isDivision(values.division) ? values.division : '',
      address: values.address.trim().slice(0, 500),
    }
    window.localStorage.setItem(CUSTOMER_PREFILL_KEY, JSON.stringify(safeValues))
  } catch {
    // Ordering must continue even when the browser blocks local storage.
  }
}

type OrderFormProps = { product: StorefrontProduct; variant: StorefrontVariant; quantity: number }
export function LandingOrderForm({ product, variant, quantity }: OrderFormProps) {
  const router = useRouter()
  const [checkoutRequestId] = useState(() => typeof window === 'undefined' ? crypto.randomUUID() : storedCheckoutId(window.location.pathname, product.id, variant.id))
  const [recoveryToken] = useState(() => typeof window === 'undefined' ? crypto.randomUUID() + crypto.randomUUID() : storedRecoveryToken(checkoutRequestId))
  const returningCustomerSnapshot = useSyncExternalStore(subscribeReturningCustomer, getReturningCustomerSnapshot, getServerReturningCustomerSnapshot)
  const returningCustomer = useMemo(() => readReturningCustomer(returningCustomerSnapshot), [returningCustomerSnapshot])
  const [formOverride, setFormOverride] = useState<FormState | null>(null)
  const form = formOverride ?? returningCustomer.values
  const setForm = (next: FormState | ((current: FormState) => FormState)) => {
    setFormOverride((current) => {
      const baseline = current ?? returningCustomer.values
      return typeof next === 'function' ? next(baseline) : next
    })
  }
  const [prefillDismissed, setPrefillDismissed] = useState(false)
  const prefillApplied = returningCustomer.applied && !prefillDismissed
  const [quoteFailure, setQuoteFailure] = useState<{ key: string; message: string } | null>(null)
  const [refreshingQuoteKey, setRefreshingQuoteKey] = useState('')
  const [quoteAttempt, setQuoteAttempt] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [recoveryConsent, setRecoveryConsent] = useState(true)
  const [quoteCache, setQuoteCache] = useState<Map<string, DeliveryZonesQuote>>(() => new Map())
  const quoteSequence = useRef(0)
  const funnelEventsSent = useRef(false)
  const [availabilityFailure, setAvailabilityFailure] = useState<{ key: string; message: string } | null>(null)
  const startedCheckout = useRef(false)
  const formInteracted = useRef(false)
  const submittingRef = useRef(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLTextAreaElement>(null)
  const quoteKey = `${product.id}:${variant.id}:${quantity}`
  const quote = quoteCache.get(quoteKey) ?? null
  const quoteError = quoteFailure?.key === quoteKey ? quoteFailure.message : ''
  const quoteLoading = refreshingQuoteKey === quoteKey || (!quote && !quoteError)
  const availabilityError = availabilityFailure?.key === quoteKey ? availabilityFailure.message : ''

  useEffect(() => {
    const key = quoteKey
    const cached = quoteCache.get(key)
    const sequence = ++quoteSequence.current
    let active = true
    if (cached) return () => { active = false }
    const timer = window.setTimeout(() => {
      void quoteDeliveryZones({ productId: product.id, variantId: variant.id, quantity }).then((result) => {
        if (!active || sequence !== quoteSequence.current) return
        if (!result.ok) {
          setQuoteFailure({ key, message: translateMessage(result.message) })
          return
        }
        setQuoteCache((current) => new Map(current).set(key, result.data))
        setQuoteFailure(null)
        setAvailabilityFailure(null)
      }).catch(() => {
        if (!active || sequence !== quoteSequence.current) return
        setQuoteFailure({ key, message: 'মোট মূল্য হিসাব করা যাচ্ছে না। আবার চেষ্টা করুন।' })
      })
    }, 100)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [quoteKey, quoteAttempt, quoteCache, product.id, variant.id, quantity])

  useEffect(() => {
    // Persist recovery data only after a real product/variant is selected and a valid mobile is entered.
    if (!product.id || !variant.id || !form.phone.trim() || !isValidBangladeshMobile(form.phone)) return
    try {
      window.sessionStorage.setItem(RECOVERY_CONSENT_KEY + checkoutRequestId, String(recoveryConsent))
    } catch {
      // Session storage is optional; checkout remains usable.
    }
    const timer = window.setTimeout(() => {
      void saveCheckoutRecoveryDraft({
        checkoutRequestId,
        recoveryToken,
        source: 'LANDING_PAGE',
        productId: product.id,
        variantId: variant.id,
        quantity,
        fullName: form.fullName,
        phone: form.phone,
        division: form.division,
        address: form.address,
        recoveryConsent,
      }).catch(() => undefined)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [checkoutRequestId, recoveryToken, product.id, variant.id, quantity, form, recoveryConsent])

  const selectedDeliveryCharge = quote && form.division
    ? form.division === 'Dhaka' ? quote.dhakaCharge : quote.outsideDhakaCharge
    : null
  const displayedTotal = quote && selectedDeliveryCharge !== null ? quote.subtotal + selectedDeliveryCharge : null
  const phoneIsValid = Boolean(form.phone.trim() && isValidBangladeshMobile(form.phone))

  function startCheckout() {
    formInteracted.current = true
    if (startedCheckout.current) return
    startedCheckout.current = true
    void prepareGuestCheckout({
      productId: product.id,
      variantId: variant.id,
      quantity,
      checkoutRequestId,
      source: 'LANDING_PAGE',
    }).catch(() => undefined)
  }

  function update(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: '' }))
    setMessage('')
  }

  function clearReturningCustomer() {
    try {
      window.localStorage.removeItem(CUSTOMER_PREFILL_KEY)
    } catch {
      // The form can still be cleared locally if storage is blocked.
    }
    setForm(initialForm)
    setPrefillDismissed(true)
    setFieldErrors({})
    setMessage('')
  }

  function focusInvalid(errors: Record<string, string>) {
    const next = ['fullName', 'phone', 'division', 'address'].find((name) => errors[name])
    if (!next) return
    const target = next === 'fullName' ? nameRef.current
      : next === 'phone' ? phoneRef.current
      : next === 'division' ? document.getElementById('landing-division')
      : addressRef.current
    target?.focus()
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  function validatePhone() {
    const normalized = normalizePhone(form.phone)
    if (!normalized.trim() || !isValidBangladeshMobile(normalized)) {
      const error = 'সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন।'
      setFieldErrors((current) => ({ ...current, phone: error }))
      setForm((current) => ({ ...current, phone: normalized }))
      return false
    }
    setForm((current) => ({ ...current, phone: normalized }))
    setFieldErrors((current) => ({ ...current, phone: '' }))
    return true
  }

  function validateForm() {
    const errors: Record<string, string> = {}
    if (form.fullName.trim().length < 2) errors.fullName = 'আপনার নাম অন্তত ২ অক্ষরে লিখুন।'
    if (!isValidBangladeshMobile(form.phone)) errors.phone = 'সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন।'
    if (!form.division) errors.division = 'ডেলিভারির বিভাগ নির্বাচন করুন।'
    if (form.address.trim().length < 8) errors.address = 'বাড়ি/রোড, এলাকা/থানা, জেলা ও কাছের পরিচিত স্থানসহ ঠিকানা লিখুন (কমপক্ষে ৮ অক্ষর)।'
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      focusInvalid(errors)
      return false
    }
    setForm((current) => ({ ...current, phone: normalizePhone(current.phone) }))
    return true
  }

  async function retryQuote() {
    if (quoteLoading) return
    setQuoteCache((current) => { const next = new Map(current); next.delete(quoteKey); return next })
    setQuoteFailure(null)
    setQuoteAttempt((attempt) => attempt + 1)
  }

  async function submitOrder() {
    if (busy || submittingRef.current) return
    startCheckout()
    if (!validateForm()) return
    if (quoteLoading || !quote) {
      setMessage('মোট মূল্য প্রস্তুত হচ্ছে। একটু পর আবার চেষ্টা করুন।')
      return
    }
    if (!quote.available) {
      setMessage('এই ভ্যারিয়েন্টটি বর্তমানে পর্যাপ্ত স্টকে নেই। অন্য ভ্যারিয়েন্ট বা পরিমাণ বেছে নিন।')
      return
    }
    if (displayedTotal === null) {
      setMessage('ডেলিভারি এলাকা নির্বাচন করে চার্জ দেখুন।')
      return
    }

    submittingRef.current = true
    setBusy(true)
    setMessage('')
    if (!funnelEventsSent.current && quote) {
      const commerce = {
        currency: 'BDT',
        value: quote.subtotal,
        items: [{ item_id: quote.sku, item_name: quote.productName, price: quote.unitPrice, quantity: quote.quantity }],
      }
      trackClientEvent({ eventName: 'begin_checkout', commerce })
      trackClientEvent({
        eventName: 'add_shipping_info',
        commerce: { ...commerce, shipping_tier: form.division === 'Dhaka' ? 'dhaka' : 'outside_dhaka' },
      })
      funnelEventsSent.current = true
    }
    let result
    try {
      const consent = getAnalyticsConsent()
      result = await createGuestOrderWithRisk({
        fullName: form.fullName.trim(),
        phone: normalizePhone(form.phone),
        division: form.division,
        address: form.address.trim(),
        productId: product.id,
        variantId: variant.id,
        quantity,
        checkoutRequestId,
        checkoutSource: 'LANDING_PAGE',
        analyticsConsent: consent.analytics,
        marketingConsent: consent.marketing,
        expectedGrandTotal: displayedTotal,
      })
    } catch (error) {
      console.error('[landing-checkout] confirm order failed', error)
      setMessage('সংযোগে সমস্যা হয়েছে। একই অর্ডার নম্বর ব্যবহার করে আবার চেষ্টা করুন।')
      submittingRef.current = false
      setBusy(false)
      return
    }

    if (!result.ok) {
      const nextErrors = translateFieldErrors(result.fieldErrors ?? {})
      setFieldErrors(nextErrors)
      setMessage(translateMessage(result.message))
      if (/INSUFFICIENT_STOCK|no longer available|not currently available|unavailable to order/i.test(result.message)) setAvailabilityFailure({ key: quoteKey, message: translateMessage(result.message) })
      submittingRef.current = false
      setBusy(false)
      if (result.quote) {
        setRefreshingQuoteKey(quoteKey)
        try {
          const refreshed = await quoteDeliveryZones({ productId: product.id, variantId: variant.id, quantity })
          if (refreshed.ok) {
            setQuoteCache((current) => new Map(current).set(quoteKey, refreshed.data))
            setQuoteFailure(null)
            setAvailabilityFailure(null)
          } else {
            setQuoteCache((current) => { const next = new Map(current); next.delete(quoteKey); return next })
            setQuoteFailure({ key: quoteKey, message: translateMessage(refreshed.message) })
          }
        } catch {
          setQuoteCache((current) => { const next = new Map(current); next.delete(quoteKey); return next })
          setQuoteFailure({ key: quoteKey, message: 'নতুন মূল্য যাচাই করা যায়নি। আবার চেষ্টা করুন।' })
        } finally {
          setRefreshingQuoteKey((current) => current === quoteKey ? '' : current)
        }
      }
      if (Object.keys(nextErrors).length) focusInvalid(nextErrors)
      return
    }

    setBusy(false)
    saveReturningCustomer(form)
    if ('paymentRequired' in result.data) {
      window.location.assign(result.data.redirectUrl)
      return
    }

    try {
      window.sessionStorage.setItem('sahigatget-last-order', JSON.stringify(result.data satisfies OrderSuccessSummary))
      window.sessionStorage.removeItem(checkoutStorageKey(window.location.pathname, product.id, variant.id))
      window.sessionStorage.removeItem('sahigadget-recovery-token:' + checkoutRequestId)
      window.sessionStorage.removeItem(RECOVERY_CONSENT_KEY + checkoutRequestId)
    } catch {
      // The server has accepted the order; navigation should not be blocked by storage restrictions.
    }
    router.replace('/order/success')
  }

  const unavailable = Boolean(quote && !quote.available)
  const disabledReason = busy ? 'অর্ডার পাঠানো হচ্ছে…'
    : quoteLoading ? 'পণ্যের মূল্য যাচাই হচ্ছে…'
    : quoteError ? 'মূল্য দেখা যাচ্ছে না — আবার চেষ্টা করুন'
    : !quote ? 'মোট মূল্য প্রস্তুত নয়'
    : unavailable ? 'এই ভ্যারিয়েন্টটি স্টকে নেই'
    : availabilityError ? 'পণ্যের প্রাপ্যতা যাচাই করুন'
    : !form.division ? 'ডেলিভারির বিভাগ নির্বাচন করুন'
    : null

  return <section id="order-form" className="mx-auto max-w-5xl scroll-mt-4 px-4 py-6 pb-8 sm:px-6 sm:py-8">
    <form noValidate onSubmit={(event) => { event.preventDefault(); void submitOrder() }} onFocusCapture={startCheckout} className="border border-slate-200 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Truck className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0"><h2 className="text-xl font-black text-slate-950 sm:text-2xl">অর্ডার ফর্ম</h2><p className="mt-1 text-sm leading-6 text-slate-600">ক্যাশ অন ডেলিভারি। পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন।</p></div>
      </div>

      {prefillApplied && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-800">
        <span>আগের তথ্য ব্যবহার করা হয়েছে</span>
        <button type="button" onClick={clearReturningCustomer} className="min-h-11 rounded-lg px-2 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">মুছে ফেলুন</button>
      </div>}

      {message && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-semibold leading-6 text-rose-700">{message}</div>}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block min-w-0" htmlFor="landing-full-name">
          <span className="text-sm font-bold text-slate-800">আপনার নাম</span>
          <input ref={nameRef} id="landing-full-name" name="name" required value={form.fullName} onChange={(event) => update('fullName', event.target.value)} autoComplete="name" aria-invalid={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? 'landing-name-error' : undefined} className={`mt-1.5 h-12 w-full rounded-xl border bg-white px-3.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${fieldErrors.fullName ? 'border-rose-400' : 'border-slate-200'}`} placeholder="আপনার পুরো নাম" />
          {fieldErrors.fullName && <span id="landing-name-error" className="mt-1 block text-xs font-bold text-rose-600">{'আপনার নাম সঠিকভাবে লিখুন।'}</span>}
        </label>
        <label className="block min-w-0" htmlFor="landing-mobile">
          <span className="text-sm font-bold text-slate-800">মোবাইল নম্বর</span>
          <span className="relative block">
            <input ref={phoneRef} id="landing-mobile" name="phone" type="tel" inputMode="tel" required value={form.phone} onChange={(event) => update('phone', event.target.value)} onBlur={validatePhone} autoComplete="tel" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'landing-phone-error' : undefined} className={`mt-1.5 h-12 w-full rounded-xl border bg-white px-3.5 pr-10 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${fieldErrors.phone ? 'border-rose-400' : 'border-slate-200'}`} placeholder="01XXXXXXXXX" />
            {phoneIsValid && !fieldErrors.phone && <CircleCheck className="absolute right-3 top-4 h-4 w-4 text-emerald-600" aria-label="মোবাইল নম্বর সঠিক" />}
          </span>
          {fieldErrors.phone && <span id="landing-phone-error" className="mt-1 block text-xs font-bold text-rose-600">{fieldErrors.phone}</span>}
        </label>

        <SearchSelect label="বিভাগ" id="landing-division" value={form.division} options={DIVISIONS} placeholder="বিভাগ নির্বাচন করুন" autoComplete="address-level1" accent="emerald" error={fieldErrors.division} onChange={(value) => update('division', value)} />


        <label className="block min-w-0 sm:col-span-2" htmlFor="landing-address">
          <span className="text-sm font-bold text-slate-800">ডেলিভারি ঠিকানা</span>
          <textarea ref={addressRef} id="landing-address" name="address" required value={form.address} onChange={(event) => update('address', event.target.value)} rows={3} autoComplete="street-address" aria-invalid={Boolean(fieldErrors.address)} aria-describedby={fieldErrors.address ? 'landing-address-error' : undefined} className={`mt-1.5 w-full resize-y rounded-xl border bg-white px-3.5 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${fieldErrors.address ? 'border-rose-400' : 'border-slate-200'}`} placeholder="বাড়ি/রোড, এলাকা/থানা, জেলা ও কাছের পরিচিত স্থান লিখুন" />
          {fieldErrors.address && <span id="landing-address-error" className="mt-1 block text-xs font-bold text-rose-600">{fieldErrors.address}</span>}
        </label>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
        <input type="checkbox" checked={recoveryConsent} onChange={(event) => { formInteracted.current = true; startCheckout(); setRecoveryConsent(event.target.checked) }} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600" />
        <span>অসম্পূর্ণ অর্ডারে সহায়তার জন্য SahiGadget যোগাযোগ করতে পারবে</span>
      </label>

      <section aria-labelledby="landing-order-summary-title" aria-live="polite" className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 sm:p-4">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h3 id="landing-order-summary-title" className="text-sm font-black text-slate-950">অর্ডারের সারাংশ</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="min-w-0 break-words text-sm font-bold leading-5 text-slate-900">{quote?.productName ?? product.name}</p>
              <span className="text-xs text-slate-500">{quote?.variantTitle ?? variantLabel(variant)} · {quantity}টি</span>
              {variant.is_low_stock && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">স্টক সীমিত</span>}
            </div>
          </div>
        </div>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex items-center justify-between gap-3"><dt className="text-slate-600">পণ্যের মূল্য</dt><dd className="shrink-0 font-semibold tabular-nums text-slate-900">{quote ? money(quote.subtotal) : '—'}</dd></div>
          {quote && quote.discountTotal > 0 && <div className="flex items-center justify-between gap-3 text-emerald-700"><dt>আপনার সাশ্রয়</dt><dd className="shrink-0 font-semibold tabular-nums">{money(quote.discountTotal)}</dd></div>}
          <div className="flex items-center justify-between gap-3"><dt className="text-slate-600">ডেলিভারি চার্জ</dt><dd className="shrink-0 text-right font-semibold tabular-nums text-slate-900">{selectedDeliveryCharge === null ? 'বিভাগ নির্বাচন করুন' : money(selectedDeliveryCharge)}</dd></div>
          <div className="flex items-center justify-between gap-3 border-t border-emerald-100 pt-2"><dt className="font-black text-slate-950">সর্বমোট</dt><dd className="shrink-0 text-lg font-black tabular-nums text-emerald-800">{displayedTotal === null ? '—' : money(displayedTotal)}</dd></div>
        </dl>
        {!form.division && <p className="mt-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs leading-5 text-slate-600">ডেলিভারি এলাকা নির্বাচন করলে চার্জ দেখা যাবে</p>}
        {quoteLoading && <p className="mt-1.5 text-xs text-slate-500">সঠিক মূল্য যাচাই হচ্ছে…</p>}
        {quoteError && <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-rose-700"><span>{quoteError}</span><button type="button" onClick={() => { void retryQuote() }} className="min-h-9 rounded-lg px-2 underline underline-offset-2">আবার চেষ্টা করুন</button></div>}
        {unavailable && <p className="mt-1.5 text-xs font-bold text-rose-700">এই ভ্যারিয়েন্টে নির্বাচিত পরিমাণের পণ্য স্টকে নেই। অন্য ভ্যারিয়েন্ট বা পরিমাণ নির্বাচন করুন।</p>}
        {availabilityError && <p className="mt-1.5 text-xs font-bold leading-5 text-rose-700">{availabilityError}</p>}
      </section>

      <div className="mt-4 border-t border-slate-100 pt-4 sm:mt-5 sm:border-0 sm:pt-0">
        <button type="submit" disabled={busy || quoteLoading || !quote || !form.division || !quote.available || Boolean(quoteError) || Boolean(availabilityError)} className="mx-auto flex min-h-12 w-full max-w-6xl items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-5 text-sm font-black text-white shadow-[0_8px_20px_rgba(234,88,12,0.28)] ring-1 ring-orange-400/70 transition hover:from-orange-600 hover:via-amber-600 hover:to-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:bg-none disabled:text-slate-600 disabled:shadow-none disabled:ring-0">
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {busy ? 'অর্ডার হচ্ছে...' : 'অর্ডার কনফার্ম করুন'}
        </button>
        {disabledReason && !busy && <p className="mx-auto mt-1.5 max-w-6xl text-center text-xs leading-5 text-slate-500">{disabledReason}</p>}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3 text-center">
        <a
          href={`https://wa.me/${(process.env.NEXT_PUBLIC_WHATSAPP_PHONE || siteConfig.contact.phone).replace(/\D/g, '')}?text=${encodeURIComponent([
            `হ্যালো, আমি ${siteConfig.name} থেকে অর্ডার করতে চাই:`,
            `- পণ্য: ${quote?.productName ?? product.name}`,
            `- কালার/ভ্যারিয়েন্ট: ${quote?.variantTitle || variantLabel(variant) || 'ডিফল্ট/সিলেক্ট করা হয়নি'}`,
            `- পরিমাণ: ${quantity}`,
            `- প্রতি পিস মূল্য: ${money(quote?.unitPrice ?? variant.price)}`,
            `- পণ্যের মোট মূল্য: ${money(quote?.subtotal ?? variant.price * quantity)}`,
            'অনুগ্রহ করে আমার অর্ডারটি কনফার্ম করতে সহায়তা করুন।',
          ].join('\n'))}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="হোয়াটসঅ্যাপে পণ্যের অর্ডারের তথ্য পাঠান"
          className="mx-auto inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 transition-colors hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:w-auto sm:min-w-72"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden="true">
            <path d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.5 0 .16 5.34.16 11.91c0 2.1.55 4.15 1.59 5.96L.06 24l6.28-1.65a11.9 11.9 0 0 0 5.72 1.46h.01c6.56 0 11.9-5.34 11.9-11.91a11.83 11.83 0 0 0-3.45-8.42ZM12.07 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.73.98.99-3.64-.24-.37a9.86 9.86 0 0 1-1.52-5.27c0-5.47 4.45-9.92 9.92-9.92a9.86 9.86 0 0 1 7.02 2.91 9.86 9.86 0 0 1 2.9 7.02c0 5.47-4.45 9.92-9.93 9.92Zm5.44-7.43c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.8-1.49-1.78-1.67-2.08-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.09 4.5.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.08-.13-.27-.2-.57-.35Z" />
          </svg>
          হোয়াটসঅ্যাপে অর্ডার করুন
        </a>
      </div>
    </form>
  </section>
}
