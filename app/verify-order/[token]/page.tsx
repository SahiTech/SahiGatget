import type { Metadata } from 'next'
import Link from 'next/link'

import { getPublicInvoiceVerification } from '@/lib/invoices/service'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Verify SahiGadget order',
  robots: { index: false, follow: false },
}

function money(value: number) {
  return `৳ ${new Intl.NumberFormat('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
}

function label(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' }).format(date)
}

export default async function VerifyOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const verification = await getPublicInvoiceVerification(token)

  return <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6">
    <section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5 sm:p-8">
      <div className="flex items-start justify-between gap-5 border-b border-slate-200 pb-6">
        <div>
          <p className="text-lg font-black tracking-[-0.04em] text-slate-950">SahiGadget</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Order verification</p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-bold ${verification ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {verification ? 'Order verified' : 'Not found'}
        </div>
      </div>

      {verification ? <>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Invoice number</p><p className="mt-1 font-mono text-sm font-bold text-slate-950">{verification.orderNumber}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Order date</p><p className="mt-1 text-sm font-semibold text-slate-950">{dateLabel(verification.createdAt)}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Order status</p><p className="mt-1 text-sm font-semibold text-slate-950">{label(verification.status)}</p></div>
          <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Items</p><p className="mt-1 text-sm font-semibold text-slate-950">{verification.itemCount}</p></div>
        </div>
        <div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Verified total</p><p className="mt-2 text-3xl font-black tracking-[-0.04em]">{money(verification.grandTotal)}</p><p className="mt-2 text-xs text-slate-400">Payment status: {label(verification.paymentStatus)}</p></div>
        <p className="mt-5 text-sm leading-6 text-slate-600">This page confirms that the invoice reference exists in SahiGadget’s order system. Customer phone numbers, delivery addresses, private notes, and administration data are not displayed.</p>
      </> : <div className="mt-8 rounded-2xl bg-rose-50 p-5 text-sm leading-6 text-rose-800">This verification link is invalid or no longer available. Please contact SahiGadget support if you need help checking an invoice.</div>}

      <div className="mt-7 flex flex-wrap gap-3 border-t border-slate-200 pt-5"><Link href="/" className="inline-flex h-10 items-center rounded-full bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">Return to SahiGadget</Link><Link href="/contact" className="inline-flex h-10 items-center rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-emerald-300 hover:text-emerald-700">Contact support</Link></div>
    </section>
  </main>
}
