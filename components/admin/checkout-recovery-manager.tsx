'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createOrderFromIncompleteCheckout, permanentlyDeleteCheckoutRecovery, getRecoveryProductVariants, updateCheckoutRecoveryOutcome } from '@/lib/commerce/checkout-recovery-actions'

type RecoveryVariant = { id: string; variant_title: string; color: string | null; ram: string | null; storage: string | null; price: number; stock_quantity: number }
type RecoveryDeliveryCharges = { dhaka: number; outsideDhaka: number }
type RecoveryRow = {
  id: string; checkout_request_id: string; source: string; status: string; customer_name: string | null;
  customer_phone: string | null; customer_email?: string | null; quote_snapshot: Record<string, unknown> | null; delivery_snapshot: Record<string, unknown> | null;
  last_activity_at: string; expires_at: string; recovery_consent_at: string | null; recovery_consent_withdrawn_at: string | null;
  recovery_contact_count: number; recovery_last_contacted_at: string | null; recovery_outcome: string | null; completed_order_id: string | null;
  history?: Array<{ id: string; action: string; notes: string | null; created_at: string; linked_order_id: string | null }>
}
function formatDate(value: string) { return new Date(value).toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' }) }
function phoneForWhatsApp(value: string) { const digits = value.replace(/\D/g, ''); return digits.startsWith('880') ? digits : digits.startsWith('0') ? '88' + digits : '880' + digits }
export function CheckoutRecoveryManager({ rows, count, page, pageSize, status, q, now }: { rows: RecoveryRow[]; count: number; page: number; pageSize: number; status?: string; q?: string; now: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState('')
  const [paymentLink, setPaymentLink] = useState('')
  const [converting, setConverting] = useState<RecoveryRow | null>(null)
  const [variants, setVariants] = useState<RecoveryVariant[]>([])
  const [variantLoading, setVariantLoading] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [deliveryCharges, setDeliveryCharges] = useState<RecoveryDeliveryCharges | null>(null)
  const [conversionDivision, setConversionDivision] = useState('')
  function openWhatsApp(row: RecoveryRow) {
    const saved = row.quote_snapshot ?? {}
    const savedItems = Array.isArray(saved.items) ? saved.items as Array<{ product_name?: string; variant_title?: string; color?: string; quantity?: number; unit_price_snapshot?: number }> : []
    const itemLines = savedItems.map((item) => `• ${item.product_name || 'Product'}${item.variant_title ? ' · ' + item.variant_title : ''}${item.color ? ' · ' + item.color : ''} × ${item.quantity ?? 1}`).join('\n')
    const message = `আসসালামু আলাইকুম! SahiGadget থেকে বলছি। আপনার নির্বাচিত পণ্য${itemLines ? ':\n' + itemLines : ''} সম্পর্কে যোগাযোগ করছি। অর্ডার সম্পন্ন করতে কোনো সাহায্য লাগলে জানাবেন। ধন্যবাদ।`
    const url = 'https://wa.me/' + phoneForWhatsApp(row.customer_phone ?? '') + '?text=' + encodeURIComponent(message)
    const popup = window.open('about:blank', '_blank')
    if (!popup) { setNotice('Allow pop-ups to open WhatsApp, then try again.'); return }
    popup.opener = null
    startTransition(() => {
      void updateCheckoutRecoveryOutcome({ sessionId: row.id, outcome: 'CONTACTED', notes: 'WhatsApp link opened by admin; message delivery is not confirmed.' })
        .then((result) => { if (!result.ok) { popup.close(); setNotice(result.message); return } popup.location.href = url; setNotice('WhatsApp link opened. Message sending is not confirmed.') })
        .catch(() => { popup.close(); setNotice('Could not record the recovery action.') })
    })
  }
  function updateOutcome(row: RecoveryRow, outcome: 'NOT_INTERESTED' | 'CLOSED') {
    const confirmed = outcome !== 'CLOSED' || window.confirm('Archive this incomplete checkout? It will be closed, not permanently deleted.')
    if (!confirmed) return
    startTransition(() => { void updateCheckoutRecoveryOutcome({ sessionId: row.id, outcome, notes: outcome === 'CLOSED' ? 'Archived by admin; soft close only.' : undefined }).then((result) => setNotice(result.ok ? 'Recovery outcome saved.' : result.message)).catch(() => setNotice('Unable to save recovery outcome.')) })
  }
  function openConversion(row: RecoveryRow) {
    const snapshot = row.quote_snapshot ?? {}
    const items = Array.isArray(snapshot.items) ? snapshot.items as Array<Record<string, unknown>> : []
    setConverting(row)
    setVariants([])
    setDeliveryCharges(null)
    setVariantLoading(true)
    setSelectedVariantId(String(items[0]?.variant_id ?? ''))
    setConversionDivision(String((row.delivery_snapshot ?? {}).division ?? ''))
    void getRecoveryProductVariants(row.id).then((result) => {
      if (!result.ok) { setNotice(result.message); return }
      setVariants(result.variants as RecoveryVariant[])
      setDeliveryCharges(result.deliveryCharges)
      if (!result.variants.some((variant) => variant.id === String(items[0]?.variant_id ?? ''))) setSelectedVariantId(result.variants[0]?.id ?? '')
    }).catch(() => setNotice('Unable to load product variants.')).finally(() => setVariantLoading(false))
  }
  function submitConversion(event: React.FormEvent<HTMLFormElement>, row: RecoveryRow) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const snapshot = row.quote_snapshot ?? {}
    const items = Array.isArray(snapshot.items) ? snapshot.items as Array<Record<string, unknown>> : []
    const first = items[0]
    if (!first || !first.product_id || !first.variant_id) { setNotice('Saved product/variant details are missing.'); return }
    const payload = {
      sessionId: row.id, productId: String(first.product_id), variantId: String(form.get('variantId') || selectedVariantId),
      quantity: Number(form.get('quantity') || first.quantity || 1),
      fullName: String(form.get('fullName') || ''), phone: String(form.get('phone') || ''),
      email: String(form.get('email') || ''), division: String(form.get('division') || ''),
      district: String(form.get('district') || ''), area: String(form.get('area') || ''),
      address: String(form.get('address') || ''), postalCode: String(form.get('postalCode') || ''),
      notes: String(form.get('notes') || ''),
    }
    startTransition(() => { void createOrderFromIncompleteCheckout(payload).then((result) => {
      setNotice(result.ok ? (result.message || `Order ${result.orderNumber || result.orderId} created successfully.`) : result.message)
      setPaymentLink(result.ok && 'paymentRequired' in result && result.paymentRequired ? result.redirectUrl : '')
      if (result.ok) { setConverting(null); router.refresh() }
    }).catch(() => setNotice('Unable to create order. Please refresh and retry.')) })
  }
  return <div className="space-y-4">
    <form className="flex gap-2 rounded-xl border border-slate-200 bg-white p-3" method="get">
      <input name="q" defaultValue={q ?? ''} placeholder="Search customer name or mobile" className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm" />
      <button className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">Search</button>
    </form>
    {notice && <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{notice}</p>}
    {paymentLink && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><span className="flex-1">Advance payment is pending. Share this secure link with the customer.</span><button type="button" onClick={() => { void navigator.clipboard.writeText(paymentLink).then(() => setNotice('Payment link copied. Share it with the customer.')).catch(() => setNotice('Copy failed. Open the payment link and copy it manually.')) }} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold">Copy link</button><a href={paymentLink} target="_blank" rel="noreferrer" className="rounded-lg bg-amber-800 px-3 py-2 text-xs font-semibold text-white">Open link</a></div>}
    <div className="text-xs text-slate-500">Showing {rows.length} of {count} checkout sessions · Page {page}</div>
    {converting && (() => {
      const row = converting
      const delivery = row.delivery_snapshot ?? {}
      const quote = row.quote_snapshot ?? {}
      const items = Array.isArray(quote.items) ? quote.items as Array<Record<string, unknown>> : []
      const item = items[0] ?? {}
      return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="convert-title">
        <form onSubmit={(event) => submitConversion(event, row)} className="max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><h2 id="convert-title" className="text-lg font-bold text-slate-950">Create order using checkout rules</h2><p className="mt-1 text-sm text-slate-500">{String(item.product_name ?? 'Saved product')} · {String(item.variant_title ?? '')} · Current price and stock will be validated by checkout.</p></div><button type="button" onClick={() => { setConverting(null); setVariants([]) }} className="rounded-lg border px-3 py-1.5 text-sm">Cancel</button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">Customer name<input name="fullName" required defaultValue={row.customer_name ?? ''} className="h-10 rounded-lg border px-3" /></label>
            <label className="grid gap-1 text-sm">Mobile number<input name="phone" required defaultValue={row.customer_phone ?? ''} className="h-10 rounded-lg border px-3" /></label>
            <label className="grid gap-1 text-sm">Email (optional)<input name="email" type="email" defaultValue={String(row.customer_email ?? '')} className="h-10 rounded-lg border px-3" /></label>
            <label className="grid gap-1 text-sm">Variant<select name="variantId" required value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)} disabled={variantLoading || !variants.length} className="h-10 rounded-lg border bg-white px-3"><option value="">{variantLoading ? 'Loading variants…' : 'Choose variant'}</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{[variant.variant_title, variant.color, variant.ram, variant.storage].filter(Boolean).join(' · ')} — ৳{variant.price.toLocaleString('en-BD')} · Stock {variant.stock_quantity}</option>)}</select></label>
            <label className="grid gap-1 text-sm">Quantity<input name="quantity" type="number" min="1" max="10" required defaultValue={Number(item.quantity ?? 1)} className="h-10 rounded-lg border px-3" /></label>
            <label className="grid gap-1 text-sm">Division<input name="division" required value={conversionDivision} onChange={(event) => setConversionDivision(event.target.value)} className="h-10 rounded-lg border px-3" /></label>
            <label className="grid gap-1 text-sm">District<input name="district" required defaultValue={String(delivery.district ?? '')} className="h-10 rounded-lg border px-3" /></label>
            <p className="text-xs text-slate-500 sm:col-span-2">Current delivery charge: {conversionDivision.trim() ? deliveryCharges ? `৳${(conversionDivision.trim().toLowerCase() === 'dhaka' ? deliveryCharges.dhaka : deliveryCharges.outsideDhaka).toLocaleString('en-BD')}` : 'Unavailable' : 'Select a division'} · Uses the current store setting; checkout recalculates it on submit.</p>
            <label className="grid gap-1 text-sm">Area / Thana<input name="area" required defaultValue={String(delivery.area ?? '')} className="h-10 rounded-lg border px-3" /></label>
            <label className="grid gap-1 text-sm">Postal code (optional)<input name="postalCode" defaultValue={String(delivery.postalCode ?? '')} className="h-10 rounded-lg border px-3" /></label>
            <label className="grid gap-1 text-sm sm:col-span-2">Delivery address<textarea name="address" required defaultValue={String(delivery.address ?? '')} rows={2} className="rounded-lg border px-3 py-2" /></label>
            <label className="grid gap-1 text-sm sm:col-span-2">Internal notes (optional)<textarea name="notes" rows={2} placeholder="Staff note; visible in order record" className="rounded-lg border px-3 py-2" /></label>
          </div>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Uses the existing risk-aware checkout transaction. Current prices, stock, risk policy, and delivery charges from store settings are revalidated; payment may be required by store policy.</p>
          <button type="submit" disabled={pending || variantLoading || !selectedVariantId || !variants.length} className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Creating order…' : 'Confirm and create order'}</button>
        </form>
      </div>
    })()}

    <div className="space-y-3">
      {rows.map((row) => {
        const snapshot = row.quote_snapshot ?? {}
        const items = Array.isArray(snapshot.items) ? snapshot.items as Array<{ product_name?: string; variant_title?: string; quantity?: number; unit_price_snapshot?: number }> : []
        const consent = Boolean(row.recovery_consent_at && !row.recovery_consent_withdrawn_at)
        const expired = new Date(row.expires_at).getTime() <= new Date(now).getTime()
        const eligible = ['STARTED', 'DETAILS_ENTERED', 'QUOTED', 'ABANDONED'].includes(row.status) && consent && !expired && !row.completed_order_id && !['CLOSED', 'NOT_INTERESTED', 'RECOVERED'].includes(row.recovery_outcome ?? '') && (row.recovery_contact_count ?? 0) < 2 && Boolean(row.customer_phone)
        const total = items.reduce((sum, item) => sum + Number(item.unit_price_snapshot ?? 0) * Number(item.quantity ?? 0), 0)
        return <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-semibold text-slate-950">{row.customer_name || 'Customer details incomplete'}</h2><p className="mt-1 text-sm text-slate-600">{row.customer_phone || 'No valid mobile saved'} · {row.source.replaceAll('_',' ')}</p><p className="mt-1 text-xs text-slate-500">Last activity: {formatDate(row.last_activity_at)} · Expires: {formatDate(row.expires_at)}</p></div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{row.status.replaceAll('_',' ')}</span>
          </div>
          {items.length > 0 && <div className="mt-3 border-t border-slate-100 pt-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Saved items · provisional snapshot</p><ul className="mt-1 space-y-1 text-sm text-slate-700">{items.slice(0,5).map((item,i) => <li key={i}>{item.product_name || 'Product'}{item.variant_title ? ' · '+item.variant_title : ''} × {item.quantity ?? 1} <span className="text-slate-500">· ৳{(Number(item.unit_price_snapshot ?? 0) * Number(item.quantity ?? 1)).toLocaleString('en-BD')}</span></li>)}</ul><p className="mt-2 text-sm font-semibold">Provisional items total: ৳{total.toLocaleString('en-BD')} <span className="font-normal text-slate-500">(delivery/stock/prices rechecked at order)</span></p></div>}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-600">Recovery consent: {consent ? 'Active' : 'Not active'} · Contact attempts: {row.recovery_contact_count ?? 0}/2{row.recovery_outcome ? ' · Outcome: '+row.recovery_outcome : ''}</p>
            <div className="flex flex-wrap gap-2">
              {eligible ? <button type="button" disabled={pending} onClick={() => openWhatsApp(row)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Open WhatsApp</button> : <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">Recovery contact unavailable</span>}
              {row.status !== 'COMPLETED' && row.status !== 'PAYMENT_INITIATED' && !['CLOSED', 'NOT_INTERESTED', 'RECOVERED'].includes(row.recovery_outcome ?? '') && items.length === 1 && <button type="button" disabled={pending} onClick={() => openConversion(row)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Create order</button>}
              {row.status !== 'COMPLETED' && row.status !== 'PAYMENT_INITIATED' && !row.completed_order_id && <><button type="button" disabled={pending} onClick={() => updateOutcome(row,'NOT_INTERESTED')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Not interested</button><button type="button" disabled={pending} onClick={() => updateOutcome(row,'CLOSED')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Close</button><button type="button" disabled={pending} onClick={() => { if (!window.confirm('Permanently delete this incomplete checkout and its recovery history? This cannot be undone.')) return; startTransition(() => { void permanentlyDeleteCheckoutRecovery({ sessionId: row.id }).then((result) => { setNotice(result.message); if (result.ok) router.refresh() }).catch(() => setNotice('Unable to permanently delete this checkout.')) }) }} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">Delete permanently</button></>}
            </div>
          </div>
          {row.recovery_last_contacted_at && <p className="mt-2 text-xs text-slate-500">Last WhatsApp link opened: {formatDate(row.recovery_last_contacted_at)} (not delivery confirmation)</p>}
          {row.completed_order_id && <p className="mt-2 text-xs font-semibold text-emerald-700">Linked order: {row.completed_order_id}</p>}
          {row.history && row.history.length > 0 && <details className="mt-3 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-xs font-semibold text-slate-600">Contact & outcome history ({row.history.length})</summary><ul className="mt-2 space-y-2">{row.history.map((item) => <li key={item.id} className="text-xs text-slate-600"><span className="font-semibold">{item.action.replaceAll('_',' ')}</span> · {formatDate(item.created_at)}{item.notes ? <p className="mt-0.5">{item.notes}</p> : null}{item.linked_order_id ? <p>Order: {item.linked_order_id}</p> : null}</li>)}</ul></details>}
        </article>
      })}
      {!rows.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No checkout sessions match these filters.</div>}
    </div>
    <div className="flex justify-between">
      <a aria-disabled={page <= 1} className={page <= 1 ? 'pointer-events-none rounded-lg border px-3 py-2 text-sm text-slate-400' : 'rounded-lg border px-3 py-2 text-sm'} href={'?page='+Math.max(1,page-1)+'&status='+encodeURIComponent(status ?? '')+'&q='+encodeURIComponent(q ?? '')}>Previous</a>
      <a aria-disabled={page * pageSize >= count} className={page * pageSize >= count ? 'pointer-events-none rounded-lg border px-3 py-2 text-sm text-slate-400' : 'rounded-lg border px-3 py-2 text-sm'} href={'?page='+(page+1)+'&status='+encodeURIComponent(status ?? '')+'&q='+encodeURIComponent(q ?? '')}>Next</a>
    </div>
  </div>
}
