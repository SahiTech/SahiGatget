/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase relation responses are normalized at render time. */
import { AlertTriangle, Banknote, CheckCircle2, ClipboardList, PackageCheck, PackageX } from 'lucide-react'

import { AdminEmptyState, AdminPageHeader } from '@/components/admin/admin-shell'
import { getAdminDashboardData } from '@/lib/admin/data'

const currency = new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 })

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Banknote; tone: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span></div></div>
}

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData()
  return (
    <div>
      <AdminPageHeader eyebrow="Store pulse" title="Operational overview" description="Live summaries use current store records only. Empty states are shown when the business has no matching activity." />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Today's orders" value={data.todayOrders} icon={ClipboardList} tone="bg-blue-50 text-blue-700" />
        <MetricCard label="Today's sales" value={currency.format(data.todaySales)} icon={Banknote} tone="bg-emerald-50 text-emerald-700" />
        <MetricCard label="Pending orders" value={data.pendingOrders} icon={PackageCheck} tone="bg-amber-50 text-amber-700" />
        <MetricCard label="Low-stock variants" value={data.lowStock.length} icon={AlertTriangle} tone="bg-rose-50 text-rose-700" />
      </section>
      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <MetricCard label="Processing" value={data.processingOrders} icon={ClipboardList} tone="bg-violet-50 text-violet-700" />
        <MetricCard label="Delivered" value={data.deliveredOrders} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700" />
        <MetricCard label="Cancelled" value={data.cancelledOrders} icon={PackageX} tone="bg-slate-100 text-slate-700" />
      </section>
      <section className="mt-7 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-950">Recent orders</h2><p className="mt-1 text-sm text-slate-500">Latest customer orders requiring operational attention.</p></div>{data.recentOrders.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Total</th></tr></thead><tbody>{data.recentOrders.map((order) => <tr key={order.id} className="border-t border-slate-100"><td className="px-5 py-3 font-mono text-xs font-semibold text-slate-800">{order.order_number}</td><td className="px-5 py-3 text-slate-700">{order.customer_name_snapshot}</td><td className="px-5 py-3"><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{order.order_status}</span></td><td className="px-5 py-3 text-right font-semibold text-slate-900">{currency.format(Number(order.grand_total))}</td></tr>)}</tbody></table></div> : <AdminEmptyState title="No orders yet" description="New Cash on Delivery orders will appear here as soon as customers place them." icon={ClipboardList} />}</div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-950">Inventory alerts</h2><p className="mt-1 text-sm text-slate-500">Active variants at or under their configured threshold.</p></div>{data.lowStock.length ? <ul className="divide-y divide-slate-100">{data.lowStock.slice(0, 8).map((variant) => <li key={variant.id} className="flex items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{(Array.isArray((variant as any).products) ? (variant as any).products[0]?.name : (variant as any).products?.name) ?? 'Product'} · {variant.variant_title}</p><p className="mt-1 font-mono text-xs text-slate-500">{variant.sku}</p></div><span className="shrink-0 rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">{variant.stock_quantity} left</span></li>)}</ul> : <AdminEmptyState title="Inventory is healthy" description="No active variant is currently at or below its low-stock threshold." icon={CheckCircle2} />}</div>
      </section>
    </div>
  )
}
