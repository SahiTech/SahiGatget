'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, LoaderCircle, MapPin, PackageCheck, ShieldCheck, Truck } from 'lucide-react'

import { createGuestOrderWithRisk, quoteGuestCodOrder, saveGuestOrderDraft } from '@/lib/orders/actions'
import { getAnalyticsConsent } from '@/lib/analytics/client'
import type { OrderSuccessSummary, Quote } from '@/lib/orders/schema'

type FormState = {
  fullName: string
  phone: string
  email: string
  division: string
  district: string
  area: string
  address: string
  postalCode: string
  notes: string
  quantity: number
}

const initialForm: FormState = {
  fullName: '', phone: '', email: '', division: '', district: '', area: '', address: '', postalCode: '', notes: '', quantity: 1,
}

function money(value: number) {
  return `৳${new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(value)}`
}

function Input({ label, name, value, onChange, error, optional = false, type = 'text', placeholder = '' }: { label: string; name: keyof FormState; value: string | number; onChange: (value: string) => void; error?: string; optional?: boolean; type?: string; placeholder?: string }) {
  return <label className="block"><span className="flex items-center justify-between text-sm font-black text-slate-800">{label}{optional && <span className="text-xs font-medium text-slate-400">Optional</span>}</span><input name={name} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`mt-2 h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${error ? 'border-rose-400' : 'border-slate-200'}`} />{error && <span className="mt-1.5 block text-xs font-bold text-rose-600">{error}</span>}</label>
}

export function CheckoutFlow({ productId, variantId, initialQuantity = 1 }: { productId: string; variantId: string; initialQuantity?: number }) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(() => ({ ...initialForm, quantity: Math.min(10, Math.max(1, initialQuantity || 1)) }))
  const [step, setStep] = useState<'details' | 'review'>('details')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [checkoutRequestId] = useState(() => crypto.randomUUID())

  function update(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: name === 'quantity' ? Math.max(1, Number(value) || 1) : value }))
    setFieldErrors((current) => ({ ...current, [name]: '' }))
    setMessage('')
  }

  useEffect(() => {
    const hasDraftData = Boolean(form.fullName || form.phone || form.email || form.division || form.district || form.area || form.address || form.postalCode || form.notes)
    if (!hasDraftData) return
    const timer = window.setTimeout(() => {
      void saveGuestOrderDraft({ ...form, productId, variantId, checkoutRequestId, stage: step === 'review' ? 'QUOTED' : 'DETAILS_ENTERED' })
    }, 700)
    return () => window.clearTimeout(timer)
  }, [checkoutRequestId, form, productId, step, variantId])

  async function requestQuote() {
    setBusy(true)
    setMessage('')
    const result = await quoteGuestCodOrder({ productId, variantId, quantity: form.quantity, division: form.division })
    setBusy(false)
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {})
      setMessage(result.message)
      return
    }
    setQuote(result.data)
    setStep('review')
  }

  async function submitOrder() {
    setBusy(true)
    setMessage('')
    const consent = getAnalyticsConsent(); const result = await createGuestOrderWithRisk({ ...form, productId, variantId, checkoutRequestId, analyticsConsent: consent.analytics, marketingConsent: consent.marketing })
    setBusy(false)
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {})
      setMessage(result.message)
      if (result.fieldErrors && Object.keys(result.fieldErrors).length) setStep('details')
      return
    }
    if ('paymentRequired' in result.data) {
      window.location.assign(result.data.redirectUrl)
      return
    }
    window.sessionStorage.setItem('sahigatget-last-order', JSON.stringify(result.data satisfies OrderSuccessSummary))
    router.push('/order/success')
  }

  const disabled = busy
  return <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 sm:text-xs">Guest checkout</p>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">Place your order</h1>
          <p className="mt-2 max-w-lg text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">No account is required. We verify price, delivery, and availability securely before confirmation.</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 sm:h-11 sm:w-11">
          <PackageCheck className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-6 flex items-center gap-3 text-[10px] font-bold sm:text-xs">
        <span className={`rounded-full px-3 py-1.5 ${step === 'details' ? 'bg-slate-950 text-white' : 'bg-emerald-100 text-emerald-800'}`}>1. Details</span>
        <span className="h-px flex-1 bg-slate-200" />
        <span className={`rounded-full px-3 py-1.5 ${step === 'review' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500'}`}>2. Review & confirm</span>
      </div>

      {message && <div role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold leading-6 text-rose-700 sm:text-sm">{message}</div>}

      {step === 'details' ? (
        <div className="mt-7 space-y-9">
          <section>
            <h2 className="text-base font-black text-slate-950 sm:text-lg">Customer information</h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">আপনার তথ্য সঠিকভাবে দিন, যেন আমরা অর্ডার নিশ্চিত করতে পারি।</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Input label="Full name" name="fullName" value={form.fullName} onChange={(value) => update('fullName', value)} error={fieldErrors.fullName} placeholder="Your full name" />
              <Input label="Mobile number" name="phone" value={form.phone} onChange={(value) => update('phone', value)} error={fieldErrors.phone} type="tel" placeholder="01XXXXXXXXX" />
              <div className="sm:col-span-2">
                <Input label="Email address" name="email" value={form.email} onChange={(value) => update('email', value)} error={fieldErrors.email} optional type="email" placeholder="you@example.com" />
              </div>
            </div>
          </section>
          <section className="border-t border-slate-100 pt-8">
            <h2 className="text-base font-black text-slate-950 sm:text-lg">Delivery information</h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">আপনার ঠিকানা অনুযায়ী ডেলিভারি চার্জ স্বয়ংক্রিয়ভাবে হিসাব হবে।</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Input label="Division" name="division" value={form.division} onChange={(value) => update('division', value)} error={fieldErrors.division} placeholder="Dhaka" />
              <Input label="District" name="district" value={form.district} onChange={(value) => update('district', value)} error={fieldErrors.district} placeholder="Narayanganj" />
              <Input label="Area / Upazila" name="area" value={form.area} onChange={(value) => update('area', value)} error={fieldErrors.area} placeholder="Araihazar" />
              <Input label="Postal code" name="postalCode" value={form.postalCode} onChange={(value) => update('postalCode', value)} error={fieldErrors.postalCode} optional placeholder="1460" />
              <label className="block sm:col-span-2">
                <span className="flex items-center justify-between text-sm font-black text-slate-800">Full delivery address</span>
                <textarea name="address" value={form.address} onChange={(event) => update('address', event.target.value)} rows={3} placeholder="House, road, landmark, village or area" className={`mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${fieldErrors.address ? 'border-rose-400' : 'border-slate-200'}`} />
                {fieldErrors.address && <span className="mt-1.5 block text-xs font-bold text-rose-600">{fieldErrors.address}</span>}
              </label>
              <label className="block sm:col-span-2">
                <span className="flex items-center justify-between text-sm font-black text-slate-800">Delivery instructions <span className="text-xs font-medium text-slate-400">Optional</span></span>
                <textarea name="notes" value={form.notes} onChange={(event) => update('notes', event.target.value)} rows={2} placeholder="Landmark, preferred delivery time, or any useful note" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
              </label>
            </div>
          </section>
          <section className="rounded-2xl bg-slate-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-black text-slate-950">Quantity</p>
                <p className="mt-1 text-xs text-slate-500">The final stock check happens during confirmation.</p>
              </div>
              <input aria-label="Quantity" type="number" min="1" max="10" value={form.quantity} onChange={(event) => update('quantity', event.target.value)} className="h-11 w-20 rounded-xl border border-slate-200 bg-white px-3 text-center font-black outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
            </div>
            {fieldErrors.quantity && <p className="mt-3 text-xs font-bold text-rose-600">{fieldErrors.quantity}</p>}
          </section>
          <button type="button" disabled={disabled} onClick={requestQuote} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-emerald-600 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Checking order details</> : <>Continue to review <CheckCircle2 className="h-4 w-4" /></>}
          </button>
        </div>
      ) : (
        <div className="mt-7">
          <div className="rounded-2xl bg-slate-950 p-5 text-white">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <div>
                <p className="font-black">Secure payment routing</p>
                <p className="mt-1 text-xs leading-5 text-slate-300 sm:text-sm sm:leading-6">The server confirms the safest available payment method. You may pay on delivery or be securely redirected for advance payment if required.</p>
              </div>
            </div>
          </div>
          <div className="mt-7 rounded-2xl border border-slate-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-slate-950">{quote?.productName}</p>
                <p className="mt-1 truncate text-xs text-slate-500 sm:text-sm">{quote?.variantTitle} · {quote?.sku}</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700 sm:text-xs">{form.quantity} item{form.quantity === 1 ? '' : 's'}</span>
            </div>
            <dl className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="font-bold text-slate-950">{money(quote?.subtotal ?? 0)}</dd>
              </div>
              {(quote?.discountTotal ?? 0) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <dt>Saved from regular price</dt>
                  <dd className="font-bold">{money(quote?.discountTotal ?? 0)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Delivery ({quote?.deliveryZone === 'dhaka' ? 'Dhaka' : 'Outside Dhaka'})</dt>
                <dd className="font-bold text-slate-950">{money(quote?.deliveryCharge ?? 0)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-4 text-base">
                <dt className="font-black text-slate-950">Grand total</dt>
                <dd className="font-black text-slate-950">{money(quote?.grandTotal ?? 0)}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-6 rounded-2xl bg-slate-50 p-5">
            <p className="font-black text-slate-950">Delivery to</p>
            <p className="mt-2 break-words text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">
              {form.fullName} · {form.phone}<br />
              {form.address}, {form.area}, {form.district}, {form.division}{form.postalCode ? ` – ${form.postalCode}` : ''}
            </p>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={disabled} onClick={() => setStep('details')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-60">
              <ArrowLeft className="h-4 w-4" /> Edit details
            </button>
            <button type="button" disabled={disabled} onClick={submitOrder} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Confirming securely</> : <>Confirm order <CheckCircle2 className="h-4 w-4" /></>}
            </button>
          </div>
          <p className="mt-4 text-center text-[10px] leading-4 text-slate-500 sm:text-xs sm:leading-5">By confirming, you agree that the final availability, totals, risk decision, and payment route are validated securely by SahiGadget’s server.</p>
        </div>
      )}
    </section>
    <aside className="space-y-4 lg:sticky lg:top-24">
      <div className="rounded-[1.5rem] bg-emerald-500 p-6 text-slate-950">
        <Truck className="h-6 w-6" />
        <p className="mt-5 text-lg font-black">Clear delivery pricing</p>
        <p className="mt-2 text-sm leading-6 text-slate-800">Your location determines the delivery zone. The displayed amount is always calculated by the server from current business settings.</p>
      </div>
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <MapPin className="h-5 w-5 text-emerald-600" />
        <p className="mt-4 font-black text-slate-950">Need help?</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">If you need assistance before ordering, contact SahiGadget. Never share card or payment credentials in this form.</p>
      </div>
    </aside>
  </div>
}
