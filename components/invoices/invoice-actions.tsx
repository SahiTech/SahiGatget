'use client'

import { Download, Printer } from 'lucide-react'

export function InvoiceActions({ orderId }: { orderId: string }) {
  return <div className="mx-auto flex max-w-4xl justify-end gap-3 px-6 pb-4 print:hidden"><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"><Printer className="h-4 w-4" /> Print invoice</button><a href={`/api/invoices/${orderId}`} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600 hover:text-slate-950"><Download className="h-4 w-4" /> Download PDF</a></div>
}
