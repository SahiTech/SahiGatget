'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Barcode,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  Save,
  ShieldCheck,
  Truck,
} from 'lucide-react'

import { adjustInventory, saveImei } from '@/lib/admin/actions'
import { ReceiveStockManager } from '@/components/admin/receive-stock-manager'
import { imeiSchema, stockAdjustmentSchema } from '@/lib/admin/schema'

const inputClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100'
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-slate-600'

type Tab = 'inventory' | 'receiving' | 'ledger' | 'devices'

export function InventoryManager({
  variants, costs, receipts, movements, imei, lowStock, canManageImei, canManageCosts, metrics,
}: {
  variants: any[]; costs: any[]; receipts: any[]; movements: any[]; imei: any[]; lowStock: any[]
  canManageImei: boolean; canManageCosts: boolean; metrics: any
}) {
  const [tab, setTab] = useState<Tab>('inventory')
  const outOfStock = variants.filter((v) => Number(v.stock_quantity) <= 0).length
  const activeVariants = variants.filter((v) => v.is_active !== false).length
  const costedVariants = costs.filter((v) => Number(v.average_cost) > 0).length

  const tabs: { id: Tab; label: string; description: string; icon: typeof Boxes; count?: number; hidden?: boolean }[] = [
    { id: 'inventory', label: 'Inventory', description: 'Stock health & valuation', icon: Boxes, count: variants.length },
    { id: 'receiving', label: 'Receive stock', description: 'Purchase & weighted cost', icon: Truck, count: receipts.length, hidden: !canManageCosts },
    { id: 'ledger', label: 'Movement ledger', description: 'Controlled stock events', icon: ClipboardList, count: movements.length },
    { id: 'devices', label: 'IMEI & serials', description: 'Device-level control', icon: Barcode, count: imei.length, hidden: !canManageImei },
  ]

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-[#151C2F] text-white shadow-sm">
        <div className="relative p-5 sm:p-6">
          <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                <ShieldCheck className="h-3.5 w-3.5 text-orange-400" /> Controlled inventory workspace
              </div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Inventory control center</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Monitor stock health, receive inventory, audit every movement, and manage device identifiers without weakening server-side stock controls.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Active variants" value={activeVariants.toLocaleString()} />
              <MiniStat label="Low stock" value={lowStock.length.toLocaleString()} tone={lowStock.length ? 'warn' : 'normal'} />
              <MiniStat label="Out of stock" value={outOfStock.toLocaleString()} tone={outOfStock ? 'danger' : 'normal'} />
              <MiniStat label="Costed" value={`${costedVariants}/${variants.length}`} />
            </div>
          </div>
        </div>
      </section>

      {metrics ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={Boxes} label="Units in stock" value={Number(metrics.unitsInStock).toLocaleString()} />
          <MetricCard icon={CircleDollarSign} label="Inventory value" value={formatMoney(metrics.inventoryValue)} />
          <MetricCard icon={ArrowUpRight} label="Costed revenue" value={formatMoney(metrics.revenue)} />
          <MetricCard icon={ArrowDownRight} label="COGS" value={formatMoney(metrics.cogs)} />
          <MetricCard icon={CircleDollarSign} label="Gross profit" value={formatMoney(metrics.grossProfit)} />
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tabs.filter((item) => !item.hidden).map((item) => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`group rounded-2xl border p-4 text-left transition ${active ? 'border-orange-200 bg-orange-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700'}`}><Icon className="h-5 w-5" /></span>
                {item.count != null ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{item.count}</span> : null}
              </div>
              <p className="mt-3 text-sm font-bold text-slate-950">{item.label}</p>
              <p className="mt-1 text-xs text-slate-500">{item.description}</p>
            </button>
          )
        })}
      </div>

      {tab === 'inventory' ? <InventoryTab variants={variants} costs={costs} lowStock={lowStock} /> : null}
      {tab === 'receiving' ? <ReceiveStockManager variants={variants} receipts={receipts} costs={costs} /> : null}
      {tab === 'ledger' ? <LedgerTab variants={variants} movements={movements} /> : null}
      {tab === 'devices' && canManageImei ? <ImeiTab variants={variants} imei={imei} /> : null}
    </div>
  )
}

function MiniStat({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' | 'danger' }) {
  return <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-1 text-lg font-black ${tone === 'danger' ? 'text-rose-300' : tone === 'warn' ? 'text-orange-300' : 'text-white'}`}>{value}</p></div>
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-slate-500"><Icon className="h-4 w-4" /><p className="text-xs font-bold uppercase tracking-[0.1em]">{label}</p></div><p className="mt-2 text-xl font-black text-slate-950">{value}</p></div>
}

function formatMoney(value: number) {
  return `৳${Number(value).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function InventoryTab({ variants, costs, lowStock }: { variants: any[]; costs: any[]; lowStock: any[] }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all')
  const costByVariant = useMemo(() => new Map(costs.map((item: any) => [item.variant_id, item])), [costs])
  const rows = useMemo(() => variants.filter((variant) => {
    const q = query.trim().toLowerCase()
    const matchesQuery = !q || [variant.products?.name, variant.variant_title, variant.sku].some((v) => String(v ?? '').toLowerCase().includes(q))
    const qty = Number(variant.stock_quantity)
    const matchesFilter = filter === 'all' || (filter === 'low' && qty > 0 && qty <= Number(variant.low_stock_threshold)) || (filter === 'out' && qty <= 0)
    return matchesQuery && matchesFilter
  }), [variants, query, filter])
  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-[.72fr_1.28fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><AlertTriangle className="h-5 w-5" /></span><div><h3 className="font-bold text-slate-950">Stock attention</h3><p className="mt-1 text-sm leading-6 text-slate-500">Prioritize variants that can interrupt sales. Thresholds remain controlled per variant.</p></div></div>
        <div className="mt-5 space-y-2">{lowStock.slice(0, 6).map((variant) => <div key={variant.id} className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{variant.products?.name ?? 'Product'} · {variant.variant_title}</p><p className="font-mono text-xs text-slate-500">{variant.sku}</p></div><p className="shrink-0 text-sm font-bold text-rose-700">{variant.stock_quantity} / {variant.low_stock_threshold}</p></div>)}{!lowStock.length ? <div className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">All active variants are above their low-stock thresholds.</div> : null}</div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-slate-950">Current inventory</h3><p className="mt-1 text-sm text-slate-500">Searchable live balance with weighted-average cost where available.</p></div><span className="text-xs font-semibold text-slate-500">{rows.length} result{rows.length === 1 ? '' : 's'}</span></div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} pl-9`} placeholder="Search product, variant or SKU..." /></div><div className="flex gap-2 overflow-x-auto">{(['all', 'low', 'out'] as const).map((item) => <button type="button" key={item} onClick={() => setFilter(item)} className={`h-10 shrink-0 rounded-lg px-3 text-xs font-bold capitalize ${filter === item ? 'bg-[#151C2F] text-white' : 'bg-slate-100 text-slate-600'}`}>{item === 'out' ? 'Out of stock' : item === 'low' ? 'Low stock' : 'All'}</button>)}</div></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Product / SKU</th><th className="px-4 py-3">Variant</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">Avg. cost</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Threshold</th></tr></thead><tbody>{rows.map((variant) => { const cost = costByVariant.get(variant.id); return <tr key={variant.id} className="border-t border-slate-100"><td className="px-4 py-3"><p className="font-semibold">{variant.products?.name ?? 'Product'}</p><p className="font-mono text-xs text-slate-500">{variant.sku}</p></td><td className="px-4 py-3">{variant.variant_title}</td><td className={`px-4 py-3 font-black ${Number(variant.stock_quantity) <= 0 ? 'text-rose-700' : Number(variant.stock_quantity) <= Number(variant.low_stock_threshold) ? 'text-orange-700' : 'text-slate-900'}`}>{variant.stock_quantity}</td><td className="px-4 py-3">{cost?.average_cost != null ? formatMoney(cost.average_cost) : 'Not costed'}</td><td className="px-4 py-3">{cost?.inventory_value != null ? formatMoney(cost.inventory_value) : '—'}</td><td className="px-4 py-3 text-slate-600">{variant.low_stock_threshold}</td></tr> })}</tbody></table>{!rows.length ? <div className="p-8 text-center text-sm text-slate-500">No inventory matches this filter.</div> : null}</div>
      </section>
    </div>
  </div>
}

function LedgerTab({ variants, movements }: { variants: any[]; movements: any[] }) {
  const [message, setMessage] = useState<string | null>(null); const [query, setQuery] = useState(''); const [isPending, startTransition] = useTransition()
  const form = useForm<any>({ resolver: zodResolver(stockAdjustmentSchema), defaultValues: { variantId: variants[0]?.id ?? '', changeAmount: 1, movementType: 'RESTOCK', notes: '' } })
  const filtered = movements.filter((m) => { const q = query.trim().toLowerCase(); return !q || [m.product_variants?.sku, m.product_variants?.variant_title, m.movement_type, m.notes].some((v) => String(v ?? '').toLowerCase().includes(q)) })
  return <div className="grid gap-5 xl:grid-cols-[.68fr_1.32fr]">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><RefreshCw className="h-5 w-5" /></span><div><h3 className="font-bold">Record controlled movement</h3><p className="mt-1 text-sm leading-6 text-slate-500">Use the business movement type and document why the balance changed.</p></div></div><form className="mt-5 space-y-4" onSubmit={form.handleSubmit((values: any) => startTransition(async () => { const result = await adjustInventory(values); setMessage(result.message); if (result.ok) form.reset({ ...form.getValues(), changeAmount: 1, notes: '' }) }))}><div><label className={labelClass}>Variant</label><select className={inputClass} {...form.register('variantId')}>{variants.map((v) => <option key={v.id} value={v.id}>{v.products?.name ?? 'Product'} · {v.sku} ({v.stock_quantity})</option>)}</select></div><div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>Movement type</label><select className={inputClass} {...form.register('movementType')}><option value="RESTOCK">RESTOCK (+)</option><option value="SALE">SALE (-)</option><option value="RETURN">RETURN (+)</option><option value="DAMAGE">DAMAGE (-)</option><option value="ADJUSTMENT">ADJUSTMENT (+/-)</option><option value="RESERVATION">RESERVATION (-)</option><option value="RELEASE">RELEASE (+)</option></select></div><div><label className={labelClass}>Signed quantity</label><input type="number" className={inputClass} {...form.register('changeAmount')} /></div></div><div><label className={labelClass}>Reason / note</label><textarea className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100" {...form.register('notes')} placeholder="Supplier receipt, damage, reconciliation, return..." /></div><button disabled={isPending || !variants.length} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#151C2F] px-4 text-sm font-semibold text-white"><Save className="h-4 w-4" />{isPending ? 'Recording…' : 'Record movement'}</button></form>{message ? <p role="status" className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm">{message}</p> : null}</section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold">Movement ledger</h3><p className="mt-1 text-sm text-slate-500">Append-only operational history for stock changes.</p></div><span className="text-xs font-semibold text-slate-500">{filtered.length} events</span></div><div className="relative mt-4"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} pl-9`} placeholder="Search SKU, movement or note..." /></div></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Variant</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Change</th><th className="px-4 py-3">Note</th></tr></thead><tbody>{filtered.map((m) => <tr key={m.id} className="border-t border-slate-100"><td className="px-4 py-3 text-xs text-slate-500">{new Date(m.created_at).toLocaleString('en-BD')}</td><td className="px-4 py-3"><p className="font-mono text-xs">{m.product_variants?.sku}</p><p className="text-xs text-slate-500">{m.product_variants?.variant_title}</p></td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{m.movement_type}</span></td><td className={`px-4 py-3 font-black ${Number(m.change_amount) > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{Number(m.change_amount) > 0 ? '+' : ''}{m.change_amount}</td><td className="max-w-48 truncate px-4 py-3 text-slate-600">{m.notes ?? '—'}</td></tr>)}</tbody></table>{!filtered.length ? <div className="p-8 text-center text-sm text-slate-500">No movement events match your search.</div> : null}</div></section>
  </div>
}

function ImeiTab({ variants, imei }: { variants: any[]; imei: any[] }) {
  const [message, setMessage] = useState<string | null>(null); const [query, setQuery] = useState(''); const [isPending, startTransition] = useTransition()
  const form = useForm<any>({ resolver: zodResolver(imeiSchema), defaultValues: { variantId: variants[0]?.id ?? '', imei1: '', imei2: '', serialNumber: '', status: 'in_stock', orderId: null } })
  const filtered = imei.filter((item) => { const q = query.trim().toLowerCase(); return !q || [item.product_variants?.sku, item.product_variants?.variant_title, item.imei_1, item.imei_2, item.serial_number, item.status].some((v) => String(v ?? '').toLowerCase().includes(q)) })
  return <div className="grid gap-5 xl:grid-cols-[.68fr_1.32fr]">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#151C2F] text-white"><Barcode className="h-5 w-5" /></span><div><h3 className="font-bold">Register a device</h3><p className="mt-1 text-sm leading-6 text-slate-500">IMEI and serial data stay restricted to OWNER and ADMIN workflows.</p></div></div><form className="mt-5 space-y-4" onSubmit={form.handleSubmit((values: any) => startTransition(async () => { const result = await saveImei(values); setMessage(result.message); if (result.ok) form.reset({ ...form.getValues(), imei1: '', imei2: '', serialNumber: '' }) }))}><div><label className={labelClass}>Variant</label><select className={inputClass} {...form.register('variantId')}>{variants.map((v) => <option key={v.id} value={v.id}>{v.products?.name ?? 'Product'} · {v.sku}</option>)}</select></div><div><label className={labelClass}>IMEI 1</label><input className={inputClass} inputMode="numeric" autoComplete="off" {...form.register('imei1')} /></div><div><label className={labelClass}>IMEI 2 (optional)</label><input className={inputClass} inputMode="numeric" autoComplete="off" {...form.register('imei2')} /></div><div><label className={labelClass}>Serial number (optional)</label><input className={inputClass} autoComplete="off" {...form.register('serialNumber')} /></div><div><label className={labelClass}>Status</label><select className={inputClass} {...form.register('status')}><option value="in_stock">In stock</option><option value="allocated">Allocated</option><option value="sold">Sold</option><option value="returned">Returned</option><option value="defective">Defective</option></select></div><button disabled={isPending || !variants.length} className="inline-flex h-10 items-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" />{isPending ? 'Saving…' : 'Add device'}</button></form>{message ? <p role="status" className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm">{message}</p> : null}</section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold">Device registry</h3><p className="mt-1 text-sm text-slate-500">Sensitive identifiers for operational device tracking.</p></div><span className="text-xs font-semibold text-slate-500">{filtered.length} records</span></div><div className="relative mt-4"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} pl-9`} placeholder="Search SKU, IMEI, serial or status..." /></div></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Variant</th><th className="px-4 py-3">IMEI 1</th><th className="px-4 py-3">IMEI 2 / Serial</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Added</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-3"><p className="font-mono text-xs">{item.product_variants?.sku}</p><p className="text-xs text-slate-500">{item.product_variants?.variant_title}</p></td><td className="px-4 py-3 font-mono text-xs">{item.imei_1}</td><td className="px-4 py-3 font-mono text-xs">{item.imei_2 ?? item.serial_number ?? '—'}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{item.status}</span></td><td className="px-4 py-3 text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString('en-BD')}</td></tr>)}</tbody></table>{!filtered.length ? <div className="p-8 text-center text-sm text-slate-500">No device records match your search.</div> : null}</div></section>
  </div>
}
