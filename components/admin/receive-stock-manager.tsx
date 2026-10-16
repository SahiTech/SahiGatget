'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { Save } from 'lucide-react'
import { receiveStock, initializeCost } from '@/lib/admin/actions'

const inputClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100'
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-600'

type VariantRow = {
  id: string
  sku: string | null
  variant_title: string | null
  stock_quantity: number
  products: { name: string | null } | null
}

type ReceiptRow = {
  id: string
  variant_id: string
  received_at: string
  receipt_type: string
  quantity: number
  unit_cost: number
  supplier_name: string | null
  supplier_reference: string | null
  note: string | null
}

type CostRow = { variant_id: string; average_cost: number | string | null }

type ReceiveStockFormValues = {
  variantId: string
  quantity: number
  unitCost: number
  supplierName: string
  supplierReference: string
  receivedAt: string
  note: string
}

export function ReceiveStockManager({ variants, receipts, costs }: { variants: VariantRow[]; receipts: ReceiptRow[]; costs: CostRow[] }) {
  const [mode, setMode] = useState<'receive' | 'initialize'>('receive')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const form = useForm<ReceiveStockFormValues>({ defaultValues: { variantId: variants[0]?.id ?? '', quantity: 1, unitCost: 0, supplierName: '', supplierReference: '', receivedAt: new Date().toISOString().slice(0,16), note: '' } })
  const variantId = form.watch('variantId')
  const selected = variants.find((v) => v.id === variantId)
  const cost = costs.find((v) => v.variant_id === variantId)

  function submit(values: ReceiveStockFormValues) {
    startTransition(async () => {
      const result = mode === 'receive'
        ? await receiveStock(values)
        : await initializeCost({ variantId: values.variantId, unitCost: values.unitCost, note: values.note })
      setMessage(result.message)
      if (result.ok && mode === 'receive') form.reset({ ...form.getValues(), quantity: 1, unitCost: 0, supplierName: '', supplierReference: '', note: '' })
    })
  }

  return <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex gap-2">
        <button type="button" onClick={() => setMode('receive')} className={`rounded-full px-4 py-2 text-sm font-bold ${mode === 'receive' ? 'bg-slate-950 text-white' : 'bg-slate-100'}`}>Receive Stock</button>
        <button type="button" onClick={() => setMode('initialize')} className={`rounded-full px-4 py-2 text-sm font-bold ${mode === 'initialize' ? 'bg-slate-950 text-white' : 'bg-slate-100'}`}>Opening Cost</button>
      </div>
      <p className="text-sm text-slate-500">{mode === 'receive' ? 'Add incoming inventory without overwriting current stock.' : 'Use this only when existing stock has no recorded purchase cost.'}</p>
      <form className="mt-5 space-y-4" onSubmit={form.handleSubmit(submit)}>
        <div><label className={labelClass}>Product / Variant</label><select className={inputClass} {...form.register('variantId')}>{variants.map((v) => <option key={v.id} value={v.id}>{v.products?.name ?? 'Product'} · {v.variant_title} · {v.sku}</option>)}</select></div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm"><b>Current stock:</b> {selected?.stock_quantity ?? 0} units · <b>Current cost:</b> {cost?.average_cost != null ? `৳${Number(cost.average_cost).toFixed(2)}` : 'Cost not recorded'}</div>
        {mode === 'receive' ? <><div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>Incoming quantity</label><input type="number" min="1" step="1" className={inputClass} {...form.register('quantity')} /></div><div><label className={labelClass}>Purchase cost / unit</label><input type="number" min="0" step="0.01" className={inputClass} {...form.register('unitCost')} /></div></div><div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>Supplier (optional)</label><input className={inputClass} {...form.register('supplierName')} /></div><div><label className={labelClass}>Invoice / reference</label><input className={inputClass} {...form.register('supplierReference')} /></div></div><div><label className={labelClass}>Received date</label><input type="datetime-local" className={inputClass} {...form.register('receivedAt')} /></div></> : <div><label className={labelClass}>Opening purchase cost / unit</label><input type="number" min="0" step="0.01" className={inputClass} {...form.register('unitCost')} /></div>}
        <div><label className={labelClass}>Note</label><textarea className="min-h-20 w-full rounded-lg border border-slate-200 p-3 text-sm" {...form.register('note')} /></div>
        <button disabled={isPending || !variants.length} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white"><Save className="h-4 w-4" />{isPending ? 'Saving…' : mode === 'receive' ? 'Receive stock' : 'Set opening cost'}</button>
      </form>
      {message ? <p role="status" className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm">{message}</p> : null}
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">Inventory receipts</h2><p className="mt-1 text-sm text-slate-500">Receipts are append-only records linked to the existing stock movement ledger.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">When</th><th className="px-5 py-3">Variant</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Qty</th><th className="px-5 py-3">Cost</th><th className="px-5 py-3">Supplier / Ref</th><th className="px-5 py-3">Note</th></tr></thead><tbody>{receipts.map((r) => { const v=variants.find((item)=>item.id===r.variant_id); return <tr key={r.id} className="border-t border-slate-100"><td className="px-5 py-3 text-xs text-slate-500">{new Date(r.received_at).toLocaleString('en-BD')}</td><td className="px-5 py-3"><p className="font-semibold">{v?.products?.name ?? 'Product'}</p><p className="font-mono text-xs text-slate-500">{v?.sku}</p></td><td className="px-5 py-3 text-xs font-semibold">{r.receipt_type}</td><td className="px-5 py-3 font-bold">+{r.quantity}</td><td className="px-5 py-3 font-semibold">৳{Number(r.unit_cost).toLocaleString('en-BD', {minimumFractionDigits:2,maximumFractionDigits:2})}</td><td className="px-5 py-3">{r.supplier_name ?? '—'}{r.supplier_reference ? ` · ${r.supplier_reference}` : ''}</td><td className="px-5 py-3 text-slate-600">{r.note ?? '—'}</td></tr> })}</tbody></table></div></section>
  </div>
}
