import Image from 'next/image'
import QRCode from 'qrcode'

import type { InvoiceDocument } from '@/lib/invoices/types'

function money(value: number, currency = 'BDT') {
  return `${currency === 'BDT' ? '৳' : currency} ${new Intl.NumberFormat('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' }).format(date)
}

function statusLabel(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export async function InvoiceDocumentView({ invoice }: { invoice: InvoiceDocument }) {
  const qrUrl = invoice.verificationToken ? `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sahigadget.shop').replace(/\/$/, '')}/verify-order/${encodeURIComponent(invoice.verificationToken)}` : null
  let qrDataUrl: string | null = null
  if (qrUrl) {
    try { qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 160, margin: 1, errorCorrectionLevel: 'M' }) } catch { qrDataUrl = null }
  }

  return <article id="invoice-preview" className="invoice-paper mx-auto max-w-[794px] bg-white p-6 text-slate-950 shadow-xl shadow-slate-950/10 print:max-w-none print:p-0 print:shadow-none">
    <div className="h-1.5 rounded-full bg-emerald-600 print:rounded-none" />
    <header className="flex items-start justify-between gap-6 border-b border-slate-200 py-5">
      <div><p className="text-xl font-black tracking-[-0.04em]">{invoice.storeProfile.businessName}</p><p className="mt-1 text-xs font-bold text-emerald-700">{invoice.storeProfile.tagline}</p><p className="mt-1 text-[11px] text-slate-500">{invoice.storeProfile.brandPromise}</p><p className="mt-2 text-[10px] leading-4 text-slate-500">{invoice.storeProfile.location}<br />{invoice.storeProfile.phone} · {invoice.storeProfile.publicEmail}</p></div>
      <div className="text-right"><p className="text-2xl font-black uppercase tracking-[-0.05em] text-emerald-700">Invoice</p><p className="mt-1 font-mono text-xs font-bold">{invoice.invoiceNumber}</p><p className="mt-1 text-[10px] text-slate-500">Issued {dateLabel(invoice.issuedAt)}</p><p className="mt-2 text-[10px] text-slate-500">Order {invoice.orderNumber} · {statusLabel(invoice.orderStatus)}</p></div>
    </header>

    <div className="grid gap-3 py-4 sm:grid-cols-2 print:grid-cols-2"><section className="rounded-xl bg-slate-50 p-3"><h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Customer information</h2><p className="mt-2 text-sm font-black">{invoice.customer.name}</p><p className="text-[11px] text-slate-600">{invoice.customer.phone}</p>{invoice.customer.email && <p className="text-[11px] text-slate-600">{invoice.customer.email}</p>}</section><section className="rounded-xl bg-slate-50 p-3"><h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Delivery information</h2><p className="mt-2 text-[11px] font-semibold leading-4">{invoice.delivery.address}</p><p className="text-[11px] leading-4 text-slate-600">{[invoice.delivery.area, invoice.delivery.district, invoice.delivery.division, invoice.delivery.postalCode].filter(Boolean).join(', ')}</p></section></div>

    <div className="invoice-table overflow-hidden rounded-xl border border-slate-200"><table className="w-full text-left text-[11px]"><thead className="bg-slate-950 text-[9px] uppercase tracking-wider text-white"><tr><th className="px-2.5 py-2">Product / বিবরণ</th><th className="px-2.5 py-2">SKU</th><th className="px-2.5 py-2 text-center">Qty</th><th className="px-2.5 py-2 text-right">Unit</th><th className="px-2.5 py-2 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{invoice.items.map((item) => <tr key={item.id} className="break-inside-avoid align-top"><td className="px-2.5 py-2"><p className="font-bold leading-4">{item.productName}</p><p className="text-[9px] text-slate-500">{item.variantTitle}</p>{(item.imei || item.imei2 || item.serialNumber) && <p className="text-[9px] font-semibold text-emerald-700">{[item.imei && `IMEI: ${item.imei}`, item.imei2 && `IMEI 2: ${item.imei2}`, item.serialNumber && `Serial: ${item.serialNumber}`].filter(Boolean).join(' · ')}</p>}</td><td className="px-2.5 py-2 font-mono text-[9px] text-slate-500">{item.sku || '—'}</td><td className="px-2.5 py-2 text-center font-bold">{item.quantity}</td><td className="px-2.5 py-2 text-right text-slate-600">{money(item.unitPrice, invoice.storeProfile.currency)}</td><td className="px-2.5 py-2 text-right font-black">{money(item.lineTotal, invoice.storeProfile.currency)}</td></tr>)}</tbody></table></div>

    <div className="mt-4 grid gap-5 sm:grid-cols-[1fr_210px] print:grid-cols-[1fr_210px]"><section className="flex items-end gap-4"><div className="invoice-qr flex min-h-[120px] items-center gap-3">{qrDataUrl ? <Image src={qrDataUrl} alt="Scan to verify this invoice" width={92} height={92} unoptimized className="h-[92px] w-[92px]" /> : <div className="flex h-[92px] w-[92px] items-center justify-center border border-dashed border-slate-300 text-center text-[9px] text-slate-500">Invoice<br />{invoice.invoiceNumber}</div>}<div><p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">QR verification</p><p className="mt-1 text-[10px] text-slate-600">Scan to verify this invoice.</p><p className="mt-1 text-[9px] text-slate-500">Read-only public summary.</p></div></div></section><dl className="space-y-2 text-[11px]"><div className="flex justify-between gap-4"><dt className="text-slate-500">Subtotal</dt><dd className="font-semibold">{money(invoice.financials.subtotal, invoice.storeProfile.currency)}</dd></div>{invoice.financials.discountTotal ? <div className="flex justify-between gap-4"><dt className="text-slate-500">Discount</dt><dd className="font-semibold text-emerald-700">− {money(invoice.financials.discountTotal, invoice.storeProfile.currency)}</dd></div> : null}<div className="flex justify-between gap-4"><dt className="text-slate-500">Delivery charge</dt><dd className="font-semibold">{money(invoice.financials.deliveryCharge, invoice.storeProfile.currency)}</dd></div><div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-sm"><dt className="font-black">Grand total</dt><dd className="font-black text-emerald-700">{money(invoice.financials.grandTotal, invoice.storeProfile.currency)}</dd></div><div className="pt-1 text-[9px] text-slate-500">Payment: {statusLabel(invoice.paymentMethod)} · {statusLabel(invoice.paymentStatus)}</div></dl></div>

    {(invoice.warrantyPolicy || invoice.returnRefundPolicy) && <section className="invoice-policy mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"><h2 className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Policy note</h2>{invoice.warrantyPolicy && <p className="mt-1 text-[10px] leading-4 text-slate-700">{invoice.warrantyPolicy}</p>}{invoice.returnRefundPolicy && <p className="mt-1 text-[10px] leading-4 text-slate-600">{invoice.returnRefundPolicy}</p>}</section>}
    <footer className="invoice-footer mt-4 border-t border-slate-200 pt-3 text-[9px] leading-4 text-slate-500">Please retain this invoice for order and warranty reference. SahiGadget · {invoice.storeProfile.location} · {invoice.storeProfile.phone} · {invoice.storeProfile.publicEmail}</footer>
  </article>
}
