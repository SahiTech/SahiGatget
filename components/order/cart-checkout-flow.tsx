'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, LoaderCircle, PackageCheck, Search, ShieldCheck, UserRound } from 'lucide-react'
import { quoteCartOrder, createCartOrder } from '@/lib/commerce/order-actions'
import { saveCheckoutRecoveryDraft } from '@/lib/commerce/checkout-recovery-actions'
import { getAnalyticsConsent, trackClientEvent } from '@/lib/analytics/client'
import type { OrderSuccessSummary } from '@/lib/orders/schema'
import { formatPrice } from '@/lib/services/storefront-utils'
import { isValidBangladeshMobile, normalizePhone } from '@/lib/orders/phone'

type CartSummary = { itemCount: number; subtotal: number; deliveryCharges: { dhakaCharge: number; outsideDhakaCharge: number } }
type FormState = { fullName: string; phone: string; division: string; district: string; area: string; address: string }
type Step = 'contact' | 'delivery' | 'review'
type Quote = { items: Array<{ name: string; variantTitle: string; color: string | null; imageUrl: string | null; sku: string; quantity: number; unitPrice: number; compareAtPrice: number | null; discountAmount: number; lineTotal: number }>; subtotal: number; deliveryCharge: number; grandTotal: number; risk: { level: string; action: string } }

const DIVISIONS = ['Dhaka', 'Chattogram', 'Rajshahi', 'Khulna', 'Barishal', 'Sylhet', 'Rangpur', 'Mymensingh'] as const
const DISTRICTS_BY_DIVISION: Record<string, string[]> = {
  Dhaka: ['Dhaka', 'Faridpur', 'Gazipur', 'Gopalganj', 'Kishoreganj', 'Madaripur', 'Manikganj', 'Munshiganj', 'Narayanganj', 'Narsingdi', 'Rajbari', 'Shariatpur', 'Tangail'],
  Chattogram: ['Bandarban', 'Brahmanbaria', 'Chandpur', 'Chattogram', 'Cox’s Bazar', 'Cumilla', 'Feni', 'Khagrachhari', 'Lakshmipur', 'Noakhali', 'Rangamati'],
  Rajshahi: ['Bogura', 'Chapainawabganj', 'Joypurhat', 'Naogaon', 'Natore', 'Pabna', 'Rajshahi', 'Sirajganj'],
  Khulna: ['Bagerhat', 'Chuadanga', 'Jashore', 'Jhenaidah', 'Khulna', 'Kushtia', 'Magura', 'Meherpur', 'Narail', 'Satkhira'],
  Barishal: ['Barguna', 'Barishal', 'Bhola', 'Jhalokathi', 'Patuakhali', 'Pirojpur'],
  Sylhet: ['Habiganj', 'Moulvibazar', 'Sunamganj', 'Sylhet'],
  Rangpur: ['Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Rangpur', 'Thakurgaon'],
  Mymensingh: ['Jamalpur', 'Mymensingh', 'Netrokona', 'Sherpur'],
}

function SearchSelect({ label, value, options, placeholder, disabled = false, error, onChange }: { label: string; value: string; options: string[]; placeholder: string; disabled?: boolean; error?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filtered = options.filter((option) => option.toLowerCase().includes(search.trim().toLowerCase()))
  return <div className="relative min-w-0">
    <span className="text-xs font-black text-slate-800">{label}</span>
    <button type="button" disabled={disabled} onClick={() => { setOpen((v) => !v); setSearch('') }} className={`mt-1.5 flex h-12 w-full items-center justify-between rounded-xl border bg-white px-3.5 text-left text-sm outline-none focus:border-[var(--brand-orange)] focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${error ? 'border-rose-400' : 'border-slate-200'}`}>
      <span className={value ? 'font-semibold text-slate-950' : 'text-slate-400'}>{value || placeholder}</span><ChevronDown className="h-4 w-4 text-slate-400" />
    </button>
    {open && !disabled && <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3"><Search className="h-4 w-4 text-slate-400" /><input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
      <div className="max-h-52 overflow-y-auto p-1.5">{filtered.length ? filtered.map((option) => <button key={option} type="button" onClick={() => { onChange(option); setOpen(false) }} className={`flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm ${option === value ? 'bg-orange-50 font-black text-orange-700' : 'text-slate-700 hover:bg-orange-50'}`}>{option}</button>) : <p className="px-3 py-4 text-xs text-slate-500">No matching options.</p>}</div>
    </div>}
    {error && <span className="mt-1 block text-[11px] font-bold text-rose-600">{error}</span>}
  </div>
}

function Progress({ step }: { step: Step }) {
  const active = step === 'contact' ? 1 : step === 'delivery' ? 2 : 3
  return <div className="flex items-center gap-2 text-[10px] font-black sm:text-xs">
    {['Contact', 'Delivery', 'Review'].map((label, index) => {
      const n = index + 1
      return <div key={label} className="flex min-w-0 flex-1 items-center gap-2"><span className={`whitespace-nowrap ${n === active ? 'text-orange-600' : n < active ? 'text-slate-800' : 'text-slate-400'}`}>{n < active ? '✓' : n} {label}</span>{n < 3 && <span className={`h-px flex-1 ${n < active ? 'bg-slate-800' : 'bg-slate-200'}`} />}</div>
    })}
  </div>
}

export function CartCheckoutFlow({ cart }: { cart: CartSummary }) {
  const [form, setForm] = useState<FormState>({ fullName: '', phone: '', division: '', district: '', area: '', address: '' })
  const [quote, setQuote] = useState<Quote | null>(null)
  const [step, setStep] = useState<Step>('contact')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [checkoutRequestId] = useState(() => { if (typeof window === 'undefined') return crypto.randomUUID(); const key = 'sahigadget-cart-checkout-request'; const saved = window.sessionStorage.getItem(key); if (saved) return saved; const id = crypto.randomUUID(); window.sessionStorage.setItem(key, id); return id })
  const [recoveryToken] = useState(() => { if (typeof window === 'undefined') return crypto.randomUUID() + crypto.randomUUID(); const key = 'sahigadget-recovery-token:' + checkoutRequestId; const saved = window.sessionStorage.getItem(key); if (saved) return saved; const token = crypto.randomUUID() + crypto.randomUUID(); window.sessionStorage.setItem(key, token); return token })
  const [recoveryConsent, setRecoveryConsent] = useState(false)

  useEffect(() => {
    if (!form.fullName.trim() && !form.phone.trim() && !recoveryConsent) return
    const timer = window.setTimeout(() => {
      void saveCheckoutRecoveryDraft({
        checkoutRequestId, recoveryToken, source: 'CART', fullName: form.fullName,
        phone: form.phone, division: form.division, district: form.district,
        area: form.area, address: form.address, recoveryConsent,
      }).catch(() => undefined)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [checkoutRequestId, recoveryToken, form, recoveryConsent])
  const router = useRouter()

  function update(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
    setMessage('')
  }

  function validatePhone() {
    if (!form.phone.trim()) { setMessage('Enter your mobile number.'); return false }
    if (!isValidBangladeshMobile(form.phone)) { setMessage('Please enter a valid Bangladesh mobile number.'); return false }
    setForm((current) => ({ ...current, phone: normalizePhone(current.phone) }))
    setMessage('')
    return true
  }

  function continueToDelivery() {
    if (!form.fullName.trim()) { setMessage('Enter your name.'); return }
    if (!validatePhone()) return
    setStep('delivery')
  }

  async function requestQuote() {
    if (busy || !cart.itemCount) return
    if (!form.division || !form.district || !form.area.trim() || !form.address.trim()) { setMessage('Please complete your delivery details.'); return }
    setBusy(true); setMessage('')
    const result = await quoteCartOrder({ checkoutRequestId, phone: form.phone, division: form.division })
    setBusy(false)
    if (!result.ok) { setMessage(result.message); return }
    setQuote(result.data)
    trackClientEvent({ eventName: 'begin_checkout', commerce: { currency: 'BDT', value: result.data.subtotal, item_count: result.data.items.length, items: result.data.items.map((item) => ({ item_id: item.sku, item_name: item.name, price: item.unitPrice, quantity: item.quantity })) } })
    trackClientEvent({ eventName: 'add_shipping_info', commerce: { currency: 'BDT', shipping_tier: form.division, value: result.data.subtotal, item_count: result.data.items.length, items: result.data.items.map((item) => ({ item_id: item.sku, item_name: item.name, price: item.unitPrice, quantity: item.quantity })) } })
    setStep('review')
  }

  async function submitOrder(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setMessage('')
    const consent = getAnalyticsConsent()
    let result
    try {
      result = await createCartOrder({ ...form, email: '', postalCode: '', notes: '', checkoutRequestId, analyticsConsent: consent.analytics, marketingConsent: consent.marketing })
    } catch (error) {
      console.error('[checkout] cart confirm order failed', error)
      setBusy(false)
      setMessage('We could not place your order right now. Please try again.')
      return
    }
    setBusy(false)
    if (!result.ok) { setMessage(result.message); return }
    if ('paymentRequired' in result.data) { window.location.assign(result.data.redirectUrl); return }
    window.sessionStorage.setItem('sahigatget-last-order', JSON.stringify(result.data satisfies OrderSuccessSummary))
    router.replace('/order/success')
  }

  const total = quote?.grandTotal ?? 0
  return <form onSubmit={submitOrder} className="mx-auto grid max-w-6xl gap-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
    <section className="min-w-0 bg-white sm:rounded-2xl sm:border sm:border-slate-200 sm:p-6 sm:shadow-sm">
      <div className="px-0.5 pb-4">
        <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><PackageCheck className="h-4 w-4" /></span><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-600">SahiGadget checkout</p><h1 className="text-xl font-black text-slate-950 sm:text-2xl">{step === 'contact' ? 'Complete your order' : step === 'delivery' ? 'Where should we deliver?' : 'Review your order'}</h1><p className="mt-1 text-xs text-slate-500">{step === 'contact' ? 'No account needed. Just a few details.' : step === 'delivery' ? 'Choose your location so we can calculate delivery correctly.' : 'Everything looks good? Confirm when ready.'}</p></div></div>
        <div className="mt-4"><Progress step={step} /></div>
      </div>
      {message && <div role="alert" className="mx-0.5 mb-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold leading-5 text-rose-700">{message}</div>}

      {step === 'contact' && <div className="space-y-4 px-0.5 pb-24">
        <section><div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-orange-600" /><h2 className="text-base font-black">Almost there 👋</h2></div><p className="mt-1 text-xs text-slate-500">Just a few details to confirm your order.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-black text-slate-800">Full name<input autoComplete="name" value={form.fullName} onChange={(e)=>update('fullName',e.target.value)} placeholder="Your full name" className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-normal outline-none focus:border-orange-500" /></label>
            <label className="text-xs font-black text-slate-800">Mobile number<input autoComplete="tel" inputMode="tel" value={form.phone} onChange={(e)=>update('phone',e.target.value)} onBlur={validatePhone} type="tel" placeholder="01XXXXXXXXX" className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-normal outline-none focus:border-orange-500" /></label>
          </div>
        </section>
        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-[11px] leading-5 text-slate-600">
          <input type="checkbox" checked={recoveryConsent} onChange={(event) => setRecoveryConsent(event.target.checked)} className="mt-1 accent-orange-600" />
          <span>আমি চাইলে অর্ডার সম্পন্ন করতে সহায়তার জন্য SahiGadget WhatsApp-এ যোগাযোগ করতে পারবে। এটি ঐচ্ছিক; যেকোনো সময় সম্মতি প্রত্যাহার করতে পারি।</span>
        </label>
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[10px] font-semibold text-slate-600"><span>✓ Cash on Delivery</span><span>✓ Secure order</span><span className="hidden min-[375px]:inline">✓ No account</span></div>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/98 px-3 pt-2.5 pb-[calc(.625rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-18px_rgba(15,23,42,.35)] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"><button type="button" disabled={busy} onClick={continueToDelivery} className="mx-auto flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-orange)] px-5 text-sm font-black text-slate-950 shadow-md disabled:opacity-60">Continue to delivery →</button></div>
      </div>}

      {step === 'delivery' && <div className="space-y-4 px-0.5 pb-24">
        <button type="button" onClick={() => setStep('contact')} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><ArrowLeft className="h-3.5 w-3.5" /> Edit contact</button>
        <div className="grid gap-3 sm:grid-cols-2">
          <SearchSelect label="Division" value={form.division} options={[...DIVISIONS]} placeholder="Select division" onChange={(v)=>{update('division',v);update('district','');update('area','')}} />
          <SearchSelect label="District" value={form.district} options={DISTRICTS_BY_DIVISION[form.division]??[]} placeholder="Select district" disabled={!form.division} onChange={(v)=>{update('district',v);update('area','')}} />
          <label className="text-xs font-black text-slate-800">Area / Upazila<input value={form.area} onChange={(e)=>update('area',e.target.value)} disabled={!form.district} placeholder={form.district?'Area / thana':'Select district first'} className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-normal outline-none focus:border-orange-500 disabled:bg-slate-50 disabled:text-slate-400" /></label>
          <label className="text-xs font-black text-slate-800 sm:col-span-2">Full delivery address<textarea value={form.address} onChange={(e)=>update('address',e.target.value)} rows={2} placeholder="House, road, landmark or village" className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-orange-500" /></label>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] text-slate-500">Your delivery charge is calculated from your selected location.</div>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/98 px-3 pt-2.5 pb-[calc(.625rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-18px_rgba(15,23,42,.35)] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"><button type="button" disabled={busy} onClick={requestQuote} className="mx-auto flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-orange)] px-5 text-sm font-black text-slate-950 shadow-md disabled:opacity-60">{busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Reviewing order...</> : <>Review order →</>}</button></div>
      </div>}

      {step === 'review' && <div className="px-0.5 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        <button type="button" disabled={busy} onClick={() => setStep('delivery')} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500"><ArrowLeft className="h-3.5 w-3.5" /> Edit delivery</button>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          <div className="p-3.5"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Delivery</p><p className="mt-1 text-xs font-bold text-slate-800">{form.fullName} · {form.phone}</p><p className="text-xs text-slate-500">{[form.area, form.district, form.division].filter(Boolean).join(', ')}</p><p className="break-words text-xs leading-5 text-slate-600">{form.address}</p></div>
          <div className="p-3.5"><p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Order</p>{quote?.items.map((item) => <div key={item.sku + '-' + item.variantTitle} className="flex gap-3 py-2">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-50">{item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill sizes="64px" className="object-contain p-1" /> : <div className="flex h-full items-center justify-center text-[9px] font-bold text-slate-400">No image</div>}</div>
            <div className="min-w-0 flex-1"><p className="break-words text-sm font-bold">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.color ? 'Color: ' + item.color : item.variantTitle ? 'Variant: ' + item.variantTitle : 'Selected variant'}</p><p className="mt-1 text-xs text-slate-500">Qty: {item.quantity}</p></div>
            <span className="shrink-0 text-sm font-black">{formatPrice(item.lineTotal)}</span>
          </div>)}</div>
          <div className="p-3.5 text-sm"><div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-bold">{formatPrice(quote?.subtotal ?? 0)}</span></div>{(quote?.items ?? []).reduce((sum, item) => sum + item.discountAmount, 0) > 0 ? <div className="mt-2 flex justify-between text-orange-700"><span>Discount saved</span><span className="font-bold">−{formatPrice((quote?.items ?? []).reduce((sum, item) => sum + item.discountAmount, 0))}</span></div> : null}<div className="mt-2 flex justify-between"><span className="text-slate-500">Delivery</span><span className="font-bold">{formatPrice(quote?.deliveryCharge ?? 0)}</span></div><div className="mt-2 flex justify-between border-t border-slate-100 pt-2"><span className="font-black">Total</span><span className="text-lg font-black">{formatPrice(total)}</span></div></div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" /> <span>Final stock, delivery and order details are securely verified before confirmation.</span></div>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/98 px-3 pt-2.5 pb-[calc(.625rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-18px_rgba(15,23,42,.35)] backdrop-blur sm:static sm:mt-4 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"><div className="mx-auto grid w-full max-w-6xl grid-cols-[auto_1fr] gap-2"><button type="button" disabled={busy} onClick={()=>setStep('delivery')} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-700">Edit</button><button type="submit" disabled={busy} className="inline-flex min-h-12 items-center justify-between gap-2 rounded-xl bg-[var(--brand-orange)] px-4 text-sm font-black text-slate-950 shadow-md disabled:opacity-60"><span>{busy?'Confirming order...':'✓ Confirm order'}</span><span>{formatPrice(total)}</span></button></div></div>
      </div>}
    </section>
    <aside className="hidden lg:block lg:sticky lg:top-24"><div className="rounded-2xl bg-[#172033] p-5 text-white"><ShieldCheck className="h-5 w-5 text-orange-400" /><p className="mt-4 text-base font-black">Secure checkout</p><p className="mt-1.5 text-xs leading-5 text-white/60">Delivery, stock, risk, and payment rules are revalidated on the server.</p></div></aside>
  </form>
}
