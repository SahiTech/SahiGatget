import type { Metadata } from 'next'

import { AdminPageHeader } from '@/components/admin/admin-shell'
import { OrdersManager } from '@/components/admin/orders-manager'
import { getOrderManagementData } from '@/lib/admin/data'

export const metadata: Metadata = { title: 'Order operations', robots: { index: false, follow: false } }

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const orders = await getOrderManagementData(q)
  return <div><AdminPageHeader eyebrow="Order operations" title="Customer orders & fulfilment" description="Order snapshots remain historically accurate. Status changes are server-authorized, append-only in history, and audited." action={<form className="flex w-full gap-2 sm:w-auto" method="get"><input name="q" defaultValue={q ?? ''} placeholder="Order, customer, or phone" className="h-10 w-full min-w-56 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 sm:w-64" /><button className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">Search</button></form>} /><OrdersManager orders={orders} /></div>
}
