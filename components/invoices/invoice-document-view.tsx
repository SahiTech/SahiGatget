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

export function InvoiceDocumentView({ invoice }: { invoice: InvoiceDocument }) {
  return <article className="mx-auto max-w-4xl bg-white p-6 text-slate-950 shadow-xl shadow-slate-950/10 print:max-w-none print:p-0 print:shadow-none">
    <div className="h-2 rounded-full bg-emerald-600 print:rounded-none" />
    <header className="flex flex-col justify-between gap-6 border-b border-slate-200 py-7 sm:flex-row">
      <div><p className="text-2xl font-black tracking-[-0.04em]">{invoice.storeProfile.businessName}</p><p className="mt-1 font-semibold text-emerald-700">{invoice.storeProfile.tagline}</p><p className="mt-2 text-sm text-slate-500">{invoice.storeProfile.brandPromise}</p><p className="mt-3 text-xs leading-5 text-slate-500">{invoice.storeProfile.location}<br />{invoice.storeProfile.phone} · {invoice.storeProfile.publicEmail}</p></div>
      <div className="sm:text-right"><p className="text-3xl font-black uppercase tracking-[-0.05em] text-emerald-700">Invoice</p><p className="mt-2 font-mono text-sm font-bold">{invoice.invoiceNumber}</p><p className="mt-1 text-xs text-slate-500">Issued {dateLabel(invoice.issuedAt)}</p><p className="mt-3 text-xs text-slate-500">Order {invoice.orderNumber} · {statusLabel(invoice.orderStatus)}</p></div>
    </header>

    <div className="grid gap-4 py-6 sm:grid-cols-2"><section className="rounded-2xl bg-slate-50 p-5"><h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Bill to / গ্রাহক</h2><p className="mt-3 font-black">{invoice.customer.name}</p><p className="mt-1 text-sm text-slate-600">{invoice.customer.phone}</p>{invoice.customer.email && <p className="text-sm text-slate-600">{invoice.customer.email}</p>}</section><section className="rounded-2xl bg-slate-50 p-5"><h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Deliver to / ঠিকানা</h2><p className="mt-3 text-sm font-semibold leading-6">{invoice.delivery.address}</p><p className="text-sm leading-6 text-slate-600">{[invoice.delivery.area, invoice.delivery.district, invoice.delivery.division, invoice.delivery.postalCode].filter(Boolean).join(', ')}</p></section></div>

    <div className="overflow-hidden rounded-2xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-950 text-xs uppercase tracking-wider text-white"><tr><th className="px-4 py-3">Item / বিবরণ</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3 text-center">Qty</th><th className="px-4 py-3 text-right">Unit</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{invoice.items.map((item) => <tr key={item.id} className="align-top"><td className="px-4 py-4"><p className="font-bold">{item.productName}</p><p className="mt-1 text-xs text-slate-500">{item.variantTitle}</p>{(item.imei || item.imei2 || item.serialNumber) && <p className="mt-2 text-xs font-semibold text-emerald-700">{[item.imei && `IMEI: ${item.imei}`, item.imei2 && `IMEI 2: ${item.imei2}`, item.serialNumber && `Serial: ${item.serialNumber}`].filter(Boolean).join(' · ')}</p>}</td><td className="px-4 py-4 font-mono text-xs text-slate-500">{item.sku}</td><td className="px-4 py-4 text-center font-bold">{item.quantity}</td><td className="px-4 py-4 text-right text-slate-600">{money(item.unitPrice, invoice.storeProfile.currency)}</td><td className="px-4 py-4 text-right font-black">{money(item.lineTotal, invoice.storeProfile.currency)}</td></tr>)}</tbody></table></div>

    <div className="mt-6 flex justify-end"><dl className="w-full max-w-xs space-y-3 text-sm"><div className="flex justify-between gap-6"><dt className="text-slate-500">Subtotal</dt><dd className="font-semibold">{money(invoice.financials.subtotal, invoice.storeProfile.currency)}</dd></div><div className="flex justify-between gap-6"><dt className="text-slate-500">Discount</dt><dd className="font-semibold text-emerald-700">− {money(invoice.financials.discountTotal, invoice.storeProfile.currency)}</dd></div><div className="flex justify-between gap-6"><dt className="text-slate-500">Delivery charge</dt><dd className="font-semibold">{money(invoice.financials.deliveryCharge, invoice.storeProfile.currency)}</dd></div><div className="flex justify-between gap-6 border-t border-slate-200 pt-3 text-base"><dt className="font-black">Grand total</dt><dd className="font-black text-emerald-700">{money(invoice.financials.grandTotal, invoice.storeProfile.currency)}</dd></div></dl></div>

    {(invoice.warrantyPolicy || invoice.returnRefundPolicy) && <section className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5"><h2 className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Warranty & returns / ওয়ারেন্টি ও রিটার্ন</h2>{invoice.warrantyPolicy && <p className="mt-3 text-sm leading-6 text-slate-700">{invoice.warrantyPolicy}</p>}{invoice.returnRefundPolicy && <p className="mt-2 text-sm leading-6 text-slate-600">{invoice.returnRefundPolicy}</p>}</section>}
    <footer className="mt-8 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">Keep this invoice for order identification. IMEI/serial verification applies where relevant. Manufacturer and company warranty terms apply where applicable.</footer>
  </article>
}
