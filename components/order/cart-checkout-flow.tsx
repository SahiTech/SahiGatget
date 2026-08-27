'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react'
import { quoteCartOrder, createCartOrder, saveCartCheckoutDraft } from '@/lib/commerce/order-actions'
import { getAnalyticsConsent } from '@/lib/analytics/client'
import type { OrderSuccessSummary } from '@/lib/orders/schema'
import { formatPrice } from '@/lib/services/storefront-utils'

type CartSummary = { itemCount: number; subtotal: number; deliveryCharges: { dhakaCharge: number; outsideDhakaCharge: number } }
type FormState = { fullName: string; phone: string; email: string; division: string; district: string; area: string; address: string; postalCode: string; notes: string }
type Quote = { items: Array<{ name: string; variantTitle: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }>; subtotal: number; deliveryCharge: number; grandTotal: number; risk: { level: string; action: string } }

export function CartCheckoutFlow({ cart }: { cart: CartSummary }) {
  const [form, setForm] = useState<FormState>({ fullName: '', phone: '', email: '', division: 'Dhaka', district: '', area: '', address: '', postalCode: '', notes: '' })
  const [quote, setQuote] = useState<Quote | null>(null)
  const [step, setStep] = useState<'details' | 'review'>('details')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [checkoutRequestId] = useState(() => crypto.randomUUID())
  const router = useRouter()

  function update(key: keyof FormState, value: string) { setForm((current) => ({ ...current, [key]: value })); setMessage('') }

  useEffect(() => {
    if (!Object.values(form).some(Boolean)) return
    const timer = window.setTimeout(() => { void saveCartCheckoutDraft({ ...form, checkoutRequestId }) }, 700)
    return () => window.clearTimeout(timer)
  }, [checkoutRequestId, form])

  async function requestQuote() {
    setBusy(true); setMessage('')
    const result = await quoteCartOrder({ checkoutRequestId, phone: form.phone, division: form.division })
    setBusy(false)
    if (!result.ok) { setMessage(result.message); return }
    setQuote(result.data); setStep('review')
  }

  async function submitOrder(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    const consent = getAnalyticsConsent()
    const result = await createCartOrder({ ...form, checkoutRequestId, analyticsConsent: consent.analytics, marketingConsent: consent.marketing })
    setBusy(false)
    if (!result.ok) { setMessage(result.message); return }
    if ('paymentRequired' in result.data) { window.location.assign(result.data.redirectUrl); return }
    window.sessionStorage.setItem('sahigatget-last-order', JSON.stringify(result.data satisfies OrderSuccessSummary)); router.push('/order/success')
  }

  return <form onSubmit={submitOrder} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Secure cart checkout</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">Delivery details</h1>
      <p className="mt-2 text-sm text-slate-500">Your quote, risk decision, stock, and payment route are rechecked securely by the server.</p>
      {message ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{message}</p> : null}
      {step === 'details' ? <>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">{([['fullName','Full name'],['phone','Mobile number'],['email','Email (optional)'],['division','Division'],['district','District'],['area','Area / upazila'],['postalCode','Postal code (optional)']] as const).map(([key,label]) => <label key={key} className="text-sm font-semibold text-slate-700">{label}<input value={form[key]} onChange={(event) => update(key, event.target.value)} required={!['email','postalCode'].includes(key)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-emerald-500" /></label>)}<label className="text-sm font-semibold text-slate-700 sm:col-span-2">Full delivery address<textarea value={form.address} onChange={(event) => update('address', event.target.value)} required rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-emerald-500" /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Notes (optional)<textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-emerald-500" /></label></div>
        <button type="button" disabled={busy || !cart.itemCount} onClick={requestQuote} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600 hover:text-slate-950 disabled:opacity-50">{busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Checking securely…</> : <>Review secure quote <CheckCircle2 className="h-4 w-4" /></>}</button>
      </> : <>
        <div className="mt-7 rounded-2xl bg-slate-950 p-5 text-white"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" /><div><p className="font-black">Server-controlled payment routing</p><p className="mt-1 text-xs leading-5 text-slate-300">Cash on Delivery remains available when permitted. If verification requires advance payment, you will be redirected to the configured secure provider.</p></div></div></div>
        <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 p-5">{quote?.items.map((item) => <div key={`${item.sku}-${item.variantTitle}`} className="flex justify-between gap-4 text-sm"><span className="min-w-0"><span className="block font-black text-slate-950">{item.name}</span><span className="text-xs text-slate-500">{item.variantTitle || item.sku} × {item.quantity}</span></span><span className="shrink-0 font-bold text-slate-950">{formatPrice(item.lineTotal)}</span></div>)}<div className="flex justify-between border-t border-slate-100 pt-4 text-sm"><span>Subtotal</span><span className="font-bold">{formatPrice(quote?.subtotal ?? 0)}</span></div><div className="flex justify-between text-sm"><span>Delivery</span><span className="font-bold">{formatPrice(quote?.deliveryCharge ?? 0)}</span></div><div className="flex justify-between border-t border-slate-100 pt-4 text-base font-black"><span>Grand total</span><span>{formatPrice(quote?.grandTotal ?? 0)}</span></div></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" disabled={busy} onClick={() => setStep('details')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-sm font-black text-slate-700"><ArrowLeft className="h-4 w-4" /> Edit details</button><button type="submit" disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Confirming…</> : <>Confirm order <CheckCircle2 className="h-4 w-4" /></>}</button></div>
      </>}
    </section>
    <aside className="h-fit rounded-[1.5rem] bg-slate-950 p-6 text-white"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Order summary</p><div className="mt-6 flex justify-between text-sm text-slate-300"><span>{cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}</span><span>{formatPrice(quote?.subtotal ?? cart.subtotal)}</span></div><p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-slate-400">Delivery is calculated from your location and revalidated from current server data.</p></aside>
  </form>
}
