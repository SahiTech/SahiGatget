'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, LoaderCircle, PackageCheck, ShieldCheck } from 'lucide-react'
import Image from 'next/image'

import { createGuestOrderWithRisk, prepareGuestCheckout, quoteDeliveryZones } from '@/lib/orders/actions'
import { saveCheckoutRecoveryDraft } from '@/lib/commerce/checkout-recovery-actions'
import { isValidBangladeshMobile, normalizePhone } from '@/lib/orders/phone'
import { getDeliveryZoneForDivision, DIVISIONS } from '@/lib/orders/locations'
import { getAnalyticsConsent, trackClientEvent } from '@/lib/analytics/client'
import type { DeliveryZonesQuote, OrderSuccessSummary } from '@/lib/orders/schema'
import { SearchSelect } from '@/components/order/search-select'

type FormState = {
  fullName: string
  phone: string
  division: string
  address: string
}

const initialForm: FormState = { fullName: '', phone: '', division: '', address: '' }

function money(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : '৳' + value.toLocaleString('bn-BD')
}

function localizedOrderError(message: string) {
  if (/INSUFFICIENT_STOCK|no longer available|not currently available|unavailable to order/i.test(message)) return 'দুঃখিত, এই পণ্যটি বর্তমানে পর্যাপ্ত স্টকে নেই।'
  if (/price|total|quote|মোট মূল্য/i.test(message)) return 'পণ্যের মূল্য বা ডেলিভারি চার্জ বদলেছে। নতুন মোট মূল্য দেখে আবার অর্ডার কনফার্ম করুন।'
  if (/verify|manual review|restricted|prepayment/i.test(message)) return 'অর্ডারটি নিশ্চিত করার আগে কিছু তথ্য যাচাই করতে হবে। প্রয়োজনে আমাদের সঙ্গে যোগাযোগ করুন।'
  if (/quantity/i.test(message)) return 'অনুগ্রহ করে সঠিক পরিমাণ নির্বাচন করুন।'
  return 'এই মুহূর্তে অর্ডার নেওয়া যাচ্ছে না। তথ্য যাচাই করে আবার চেষ্টা করুন।'
}

function recoveryTokenFor(checkoutRequestId: string) {
  const key = 'sahigadget-recovery-token:' + checkoutRequestId
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

export function CheckoutFlow({ productId, variantId, initialQuantity = 1, initialCheckoutRequestId }: { productId: string; variantId: string; initialQuantity?: number; initialCheckoutRequestId?: string }) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(initialForm)
  const [quantity, setQuantity] = useState(() => Math.min(10, Math.max(1, initialQuantity || 1)))
  const [quote, setQuote] = useState<DeliveryZonesQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [quoteError, setQuoteError] = useState('')
  const [quoteAttempt, setQuoteAttempt] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [recoveryConsent, setRecoveryConsent] = useState(true)
  const [checkoutRequestId] = useState(() => initialCheckoutRequestId || crypto.randomUUID())
  const [recoveryToken] = useState(() => typeof window === 'undefined' ? crypto.randomUUID() + crypto.randomUUID() : recoveryTokenFor(checkoutRequestId))
  const quoteSequence = useRef(0)
  const startedCheckout = useRef(Boolean(initialCheckoutRequestId))
  const formInteracted = useRef(false)
  const submittingRef = useRef(false)
  const funnelEventsSent = useRef(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLTextAreaElement>(null)

  function startCheckout() {
    formInteracted.current = true
    if (startedCheckout.current) return
    startedCheckout.current = true
    void prepareGuestCheckout({
      productId,
      variantId,
      quantity,
      checkoutRequestId,
      source: 'QUICK_ORDER',
    }).catch(() => undefined)
  }

  // Reset the previous quote synchronously with the new product/variant/quantity request.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const request = ++quoteSequence.current
    let active = true
    setQuote(null)
    setQuoteError('')
    setQuoteLoading(true)
    void quoteDeliveryZones({ productId, variantId, quantity }).then((result) => {
      if (!active || request !== quoteSequence.current) return
      if (!result.ok) {
        setQuoteError(localizedOrderError(result.message))
        return
      }
      setQuote(result.data)
    }).catch(() => {
      if (active && request === quoteSequence.current) setQuoteError('সঠিক মূল্য হিসাব করা যাচ্ছে না। আবার চেষ্টা করুন।')
    }).finally(() => {
      if (active && request === quoteSequence.current) setQuoteLoading(false)
    })
    return () => { active = false }
  }, [productId, variantId, quantity, quoteAttempt])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!formInteracted.current || (!form.fullName.trim() && !form.phone.trim() && !form.division && !form.address.trim())) return
    const timer = window.setTimeout(() => {
      void saveCheckoutRecoveryDraft({
        checkoutRequestId,
        recoveryToken,
        source: 'QUICK_ORDER',
        productId,
        variantId,
        quantity,
        fullName: form.fullName,
        phone: form.phone,
        division: form.division,
        address: form.address,
        recoveryConsent,
      }).catch(() => undefined)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [checkoutRequestId, recoveryToken, productId, variantId, quantity, form, recoveryConsent])

  const selectedDeliveryCharge = quote && form.division
    ? getDeliveryZoneForDivision(form.division) === 'dhaka' ? quote.dhakaCharge : quote.outsideDhakaCharge
    : null
  const displayedTotal = quote && selectedDeliveryCharge !== null ? quote.subtotal + selectedDeliveryCharge : null
  const phoneIsValid = Boolean(form.phone.trim() && isValidBangladeshMobile(form.phone))

  function update<K extends keyof FormState>(name: K, value: FormState[K]) {
    formInteracted.current = true
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: '' }))
    setMessage('')
  }

  function focusInvalid(errors: Record<string, string>) {
    const next = ['fullName', 'phone', 'division', 'address'].find((field) => errors[field])
    if (!next) return
    const target = next === 'fullName' ? nameRef.current
      : next === 'phone' ? phoneRef.current
      : next === 'division' ? document.getElementById('product-checkout-division')
      : addressRef.current
    target?.focus()
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  function validateForm() {
    const errors: Record<string, string> = {}
    if (form.fullName.trim().length < 2) errors.fullName = 'আপনার নাম অন্তত ২ অক্ষরে লিখুন।'
    if (!isValidBangladeshMobile(form.phone)) errors.phone = 'সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন।'
    if (!form.division) errors.division = 'ডেলিভারির বিভাগ নির্বাচন করুন।'
    if (form.address.trim().length < 8) errors.address = 'বাড়ি/রোড, এলাকা/থানা, জেলা ও কাছের পরিচিত স্থানসহ ঠিকানা লিখুন।'
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      focusInvalid(errors)
      return false
    }
    setForm((current) => ({ ...current, phone: normalizePhone(current.phone) }))
    return true
  }

  async function submitOrder() {
    if (busy || submittingRef.current) return
    startCheckout()
    if (!validateForm()) return
    if (quoteLoading || !quote || displayedTotal === null) {
      setMessage('মোট মূল্য প্রস্তুত হচ্ছে। একটু পর আবার চেষ্টা করুন।')
      return
    }
    if (!quote.available) {
      setMessage('এই ভ্যারিয়েন্টটি বর্তমানে পর্যাপ্ত স্টকে নেই। অন্য পরিমাণ বা ভ্যারিয়েন্ট বেছে নিন।')
      return
    }

    submittingRef.current = true
    setBusy(true)
    setMessage('')
    if (!funnelEventsSent.current) {
      const commerce = {
        currency: 'BDT',
        value: quote.subtotal,
        items: [{ item_id: quote.sku, item_name: quote.productName, price: quote.unitPrice, quantity: quote.quantity }],
      }
      trackClientEvent({ eventName: 'begin_checkout', commerce })
      trackClientEvent({
        eventName: 'add_shipping_info',
        commerce: { ...commerce, shipping_tier: getDeliveryZoneForDivision(form.division) },
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
        email: '',
        productId,
        variantId,
        quantity,
        checkoutRequestId,
        checkoutSource: 'QUICK_ORDER',
        analyticsConsent: consent.analytics,
        marketingConsent: consent.marketing,
        expectedGrandTotal: displayedTotal,
      })
    } catch (error) {
      console.error('[product-checkout] confirm order failed', error)
      setMessage('সংযোগে সমস্যা হয়েছে। একই অর্ডারটি আবার নিশ্চিত করার চেষ্টা করুন।')
      submittingRef.current = false
      setBusy(false)
      return
    }

    if (!result.ok) {
      const nextErrors: Record<string, string> = {}
      if (result.fieldErrors) {
        if (result.fieldErrors.fullName) nextErrors.fullName = 'আপনার নাম সঠিকভাবে লিখুন।'
        if (result.fieldErrors.phone) nextErrors.phone = 'সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন।'
        if (result.fieldErrors.division) nextErrors.division = 'ডেলিভারির বিভাগ নির্বাচন করুন।'
        if (result.fieldErrors.address) nextErrors.address = 'সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন।'
      }
      setFieldErrors(nextErrors)
      const staleTotal = /price|total|quote|মোট মূল্য/i.test(result.message)
      setMessage(staleTotal
        ? 'পণ্যের মূল্য বা ডেলিভারি চার্জ বদলেছে। নতুন মোট মূল্য দেখে আবার অর্ডার কনফার্ম করুন।'
        : localizedOrderError(result.message))
      submittingRef.current = false
      setBusy(false)
      if (staleTotal || /INSUFFICIENT_STOCK|no longer available|not currently available/i.test(result.message)) setQuoteAttempt((value) => value + 1)
      if (Object.keys(nextErrors).length) focusInvalid(nextErrors)
      return
    }

    if ('paymentRequired' in result.data) {
      window.location.assign(result.data.redirectUrl)
      return
    }

    try {
      window.sessionStorage.setItem('sahigatget-last-order', JSON.stringify(result.data satisfies OrderSuccessSummary))
      window.sessionStorage.removeItem('sahigadget-recovery-token:' + checkoutRequestId)
      window.sessionStorage.removeItem('sahigadget-recovery-consent:' + checkoutRequestId)
    } catch {
      // Navigation must not be blocked after the server accepts the order.
    }
    router.replace('/order/success')
  }

  const disabledReason = busy ? 'অর্ডার হচ্ছে…'
    : quoteLoading ? 'পণ্যের মূল্য যাচাই হচ্ছে…'
    : quoteError ? 'মূল্য দেখা যাচ্ছে না — আবার চেষ্টা করুন'
    : !quote ? 'মোট মূল্য প্রস্তুত নয়'
    : !form.division ? 'ডেলিভারির বিভাগ নির্বাচন করুন'
    : !quote.available ? 'এই ভ্যারিয়েন্টটি স্টকে নেই'
    : null

  return <section className="mx-auto max-w-6xl px-3 py-3 pb-32 sm:px-6 sm:py-6 sm:pb-8">
    <form noValidate onSubmit={(event) => { event.preventDefault(); void submitOrder() }} onFocusCapture={startCheckout} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><PackageCheck className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0"><h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">অর্ডার কনফার্ম করুন</h1><p className="mt-1 text-sm leading-5 text-slate-600">শুধু ৪টি তথ্য দিন। ক্যাশ অন ডেলিভারি।</p></div>
        </div>

        {message && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-semibold leading-6 text-rose-700">{message}</div>}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block min-w-0" htmlFor="product-checkout-name">
            <span className="text-sm font-bold text-slate-800">আপনার নাম</span>
            <input ref={nameRef} id="product-checkout-name" name="name" required value={form.fullName} onChange={(event) => update('fullName', event.target.value)} autoComplete="name" aria-invalid={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? 'product-name-error' : undefined} className={'mt-1.5 h-12 w-full rounded-xl border bg-white px-3.5 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 ' + (fieldErrors.fullName ? 'border-rose-400' : 'border-slate-200')} placeholder="আপনার পুরো নাম" />
            {fieldErrors.fullName && <span id="product-name-error" className="mt-1 block text-xs font-bold text-rose-600">{fieldErrors.fullName}</span>}
          </label>
          <label className="block min-w-0" htmlFor="product-checkout-phone">
            <span className="text-sm font-bold text-slate-800">মোবাইল নম্বর</span>
            <span className="relative block">
              <input ref={phoneRef} id="product-checkout-phone" name="phone" type="tel" inputMode="tel" required value={form.phone} onChange={(event) => update('phone', event.target.value)} onBlur={() => { const phone = normalizePhone(form.phone); if (isValidBangladeshMobile(phone)) update('phone', phone); else setFieldErrors((current) => ({ ...current, phone: 'সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন।' })) }} autoComplete="tel" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'product-phone-error' : undefined} className={'mt-1.5 h-12 w-full rounded-xl border bg-white px-3.5 pr-10 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 ' + (fieldErrors.phone ? 'border-rose-400' : 'border-slate-200')} placeholder="01XXXXXXXXX" />
              {phoneIsValid && !fieldErrors.phone && <CheckCircle2 className="absolute right-3 top-4 h-4 w-4 text-emerald-600" aria-label="মোবাইল নম্বর সঠিক" />}
            </span>
            {fieldErrors.phone && <span id="product-phone-error" className="mt-1 block text-xs font-bold text-rose-600">{fieldErrors.phone}</span>}
          </label>
          <SearchSelect label="বিভাগ" id="product-checkout-division" value={form.division} options={DIVISIONS} placeholder="বিভাগ নির্বাচন করুন" autoComplete="address-level1" error={fieldErrors.division} onChange={(value) => update('division', value)} />
          <label className="block min-w-0 sm:col-span-2" htmlFor="product-checkout-address">
            <span className="text-sm font-bold text-slate-800">ডেলিভারি ঠিকানা</span>
            <textarea ref={addressRef} id="product-checkout-address" name="address" required value={form.address} onChange={(event) => update('address', event.target.value)} rows={3} autoComplete="street-address" aria-invalid={Boolean(fieldErrors.address)} aria-describedby={fieldErrors.address ? 'product-address-error' : undefined} className={'mt-1.5 w-full resize-y rounded-xl border bg-white px-3.5 py-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 ' + (fieldErrors.address ? 'border-rose-400' : 'border-slate-200')} placeholder="বাড়ি/রোড, এলাকা/থানা, জেলা ও কাছের পরিচিত স্থান লিখুন" />
            {fieldErrors.address && <span id="product-address-error" className="mt-1 block text-xs font-bold text-rose-600">{fieldErrors.address}</span>}
          </label>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
          <input type="checkbox" checked={recoveryConsent} onChange={(event) => { formInteracted.current = true; startCheckout(); setRecoveryConsent(event.target.checked) }} className="mt-0.5 h-4 w-4 shrink-0 accent-orange-600" />
          <span>অসম্পূর্ণ অর্ডারে সহায়তার জন্য SahiGadget যোগাযোগ করতে পারবে <span className="font-semibold text-slate-500">(ঐচ্ছিক; যেকোনো সময় বন্ধ করতে পারবেন)</span></span>
        </label>

        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" /> নিরাপদ অর্ডার · ক্যাশ অন ডেলিভারি</p>
      </section>

      <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-live="polite">
        <div className="flex items-start gap-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-50">
            {quote?.imageUrl ? <Image src={quote.imageUrl} alt={quote.productName} fill sizes="80px" className="object-contain p-1" /> : <div className="flex h-full items-center justify-center"><PackageCheck className="h-7 w-7 text-slate-300" aria-hidden="true" /></div>}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-slate-950">অর্ডারের সারাংশ</h2>
            <p className="mt-1 text-sm font-bold leading-5 text-slate-800">{quote?.productName ?? 'আপনার পণ্য'}</p>
            <p className="mt-0.5 break-words text-xs leading-5 text-slate-500">{quote?.variantTitle ?? 'নির্বাচিত ভ্যারিয়েন্ট'} · {quantity}টি</p>
            {quote?.available === false && <p className="mt-1 text-xs font-bold text-rose-600">স্টকে নেই</p>}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <span className="text-xs font-semibold text-slate-600">পরিমাণ</span>
          <div className="flex items-center gap-3">
            <button type="button" disabled={busy || quantity <= 1} aria-label="পরিমাণ কমান" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold disabled:opacity-40">−</button>
            <span className="min-w-4 text-center text-sm font-black tabular-nums">{quantity.toLocaleString('bn-BD')}</span>
            <button type="button" disabled={busy || quantity >= 10} aria-label="পরিমাণ বাড়ান" onClick={() => setQuantity((value) => Math.min(10, value + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold disabled:opacity-40">+</button>
          </div>
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3"><dt className="text-slate-600">পণ্যের মূল্য</dt><dd className="shrink-0 font-bold text-slate-900">{quote ? money(quote.subtotal) : '—'}</dd></div>
          {quote && quote.discountTotal > 0 && <div className="flex items-center justify-between gap-3 text-emerald-700"><dt>আপনার সাশ্রয়</dt><dd className="shrink-0 font-semibold">{money(quote.discountTotal)}</dd></div>}
          <div className="flex items-center justify-between gap-3"><dt className="text-slate-600">ডেলিভারি চার্জ</dt><dd className="shrink-0 font-bold text-slate-900">{selectedDeliveryCharge === null ? 'বিভাগ নির্বাচন করুন' : money(selectedDeliveryCharge)}</dd></div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3"><dt className="font-black text-slate-950">সর্বমোট</dt><dd className="shrink-0 text-lg font-black text-emerald-800">{displayedTotal === null ? '—' : money(displayedTotal)}</dd></div>
        </dl>
        {quoteLoading && <p className="mt-3 text-xs text-slate-500">সঠিক মূল্য যাচাই হচ্ছে…</p>}
        {quoteError && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-rose-700"><span>{quoteError}</span><button type="button" onClick={() => setQuoteAttempt((value) => value + 1)} className="min-h-10 rounded-lg px-2 underline underline-offset-2">আবার চেষ্টা করুন</button></div>}
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/98 px-3 pt-2.5 pb-[calc(.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-18px_rgba(15,23,42,.35)] backdrop-blur lg:static lg:col-span-2 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-0">
        <button type="submit" disabled={busy || quoteLoading || !quote || !form.division || !quote.available || Boolean(quoteError)} className="mx-auto flex min-h-12 w-full max-w-6xl items-center justify-center gap-2 rounded-xl bg-[var(--brand-orange)] px-5 text-sm font-black text-slate-950 shadow-md transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none">
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {busy ? 'অর্ডার হচ্ছে...' : 'অর্ডার কনফার্ম করুন'}
        </button>
        {disabledReason && !busy && <p className="mx-auto mt-1.5 max-w-6xl text-center text-xs leading-5 text-slate-500">{disabledReason}</p>}
      </div>
    </form>
  </section>
}
