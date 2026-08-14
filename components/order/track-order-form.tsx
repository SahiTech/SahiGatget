'use client'

import { useState } from 'react'
import { ClipboardCheck, Download, LoaderCircle, PackageCheck, ShieldCheck } from 'lucide-react'

import { lookupGuestOrder } from '@/lib/orders/actions'
import type { TrackingSummary } from '@/lib/orders/schema'

function statusLabel(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function money(value: number) {
  return `৳${new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(value)}`
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' }).format(date)
}

export function TrackOrderForm() {
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [invoiceMessage, setInvoiceMessage] = useState('')
  const [result, setResult] = useState<TrackingSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [invoiceBusy, setInvoiceBusy] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setInvoiceMessage('')
    setErrors({})
    setResult(null)
    const response = await lookupGuestOrder({ orderNumber, phone })
    setBusy(false)
    if (!response.ok) {
      setMessage(response.message)
      setErrors(response.fieldErrors ?? {})
      return
    }
    setResult(response.data)
  }

  async function downloadInvoice() {
    setInvoiceBusy(true)
    setInvoiceMessage('')
    try {
      const response = await fetch('/api/invoices/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, phone }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(body?.message || 'We could not prepare this invoice.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${result?.orderNumber || 'sahigadget-invoice'}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setInvoiceMessage(error instanceof Error ? error.message : 'We could not prepare this invoice.')
    } finally {
      setInvoiceBusy(false)
    }
  }

  return <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><ClipboardCheck className="h-6 w-6" /></span><div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Secure tracking</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">Track your order</h1><p className="mt-2 text-sm leading-6 text-slate-500">Enter both the SahiGadget order number and the mobile number used during checkout.</p></div></div>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block"><span className="text-sm font-black text-slate-800">Order number</span><input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value.toUpperCase())} placeholder="SG-YYYYMMDD-XXXXXXXX" className={`mt-2 h-12 w-full rounded-xl border bg-white px-4 font-mono text-sm uppercase text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${errors.orderNumber ? 'border-rose-400' : 'border-slate-200'}`} />{errors.orderNumber && <p className="mt-1.5 text-xs font-bold text-rose-600">{errors.orderNumber}</p>}</label>
        <label className="block"><span className="text-sm font-black text-slate-800">Mobile number</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="01XXXXXXXXX" type="tel" className={`mt-2 h-12 w-full rounded-xl border bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${errors.phone ? 'border-rose-400' : 'border-slate-200'}`} />{errors.phone && <p className="mt-1.5 text-xs font-bold text-rose-600">{errors.phone}</p>}</label>
        {message && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">{message}</p>}
        <button type="submit" disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-emerald-600 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60">{busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Finding order</> : <>Track order <PackageCheck className="h-4 w-4" /></>}</button>
      </form>
      {result && <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">Order found</p>
            <p className="mt-2 break-all font-mono text-sm font-black text-slate-950">{result.orderNumber}</p>
            <p className="mt-1 text-xs text-slate-500">Placed {dateLabel(result.createdAt)}</p>
          </div>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-800">{statusLabel(result.status)}</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-white/70 p-3"><p className="text-xs text-slate-500">Order total</p><p className="mt-1 font-black text-slate-950">{money(result.grandTotal)}</p></div><div className="rounded-xl bg-white/70 p-3"><p className="text-xs text-slate-500">Delivery</p><p className="mt-1 font-black text-slate-950">{money(result.deliveryCharge)}</p></div></div>
        <p className="mt-4 text-sm font-bold text-slate-950">Payment: Cash on Delivery · {statusLabel(result.paymentStatus)}</p>
        <div className="mt-4 border-t border-emerald-200 pt-4"><p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">Items</p><ul className="mt-3 space-y-2 text-sm text-slate-700">
            {result.items.map((item) => (
              <li key={`${item.productName}-${item.variantTitle}`} className="flex justify-between gap-4">
                <span className="min-w-0 flex-1 break-words">{item.productName} · {item.variantTitle}</span>
                <strong className="shrink-0">×{item.quantity}</strong>
              </li>
            ))}
          </ul></div>
        {result.timeline.length > 0 && <div className="mt-5 border-t border-emerald-200 pt-4"><p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">Order timeline</p><ol className="mt-3 space-y-3">{result.timeline.map((entry, index) => <li key={`${entry.status}-${entry.createdAt}`} className="flex gap-3 text-sm"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600 ring-4 ring-emerald-100" /><span><strong className="text-slate-800">{statusLabel(entry.status)}</strong><span className="ml-2 text-xs text-slate-500">{dateLabel(entry.createdAt)}</span>{index === result.timeline.length - 1 && <span className="ml-2 text-xs font-bold text-emerald-700">Current</span>}</span></li>)}</ol></div>}
        {result.warrantyPolicy && <div className="mt-5 rounded-xl border border-white bg-white/70 p-4"><p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">Warranty</p><p className="mt-2 text-sm leading-6 text-slate-600">{result.warrantyPolicy}</p></div>}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={downloadInvoice} disabled={invoiceBusy} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60">{invoiceBusy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Preparing PDF</> : <><Download className="h-4 w-4" /> Download invoice</>}</button></div>
        {invoiceMessage && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-700">{invoiceMessage}</p>}
        <p className="mt-5 text-xs leading-5 text-slate-500">For privacy, this page does not show address details, contact data, IMEI, serial numbers, internal notes, or operational records.</p>
      </div>}
    </section>
    <aside className="rounded-[1.5rem] bg-slate-950 p-6 text-white"><ShieldCheck className="h-6 w-6 text-emerald-300" /><p className="mt-5 text-lg font-black">Your privacy matters</p><p className="mt-2 text-sm leading-6 text-slate-300">We use the order number and matching phone number together before returning a safe status update or generating your invoice. Please do not share your order number publicly.</p></aside>
  </div>
}
