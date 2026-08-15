'use client'

import { useState } from 'react'
import { Download, Eye, Printer } from 'lucide-react'

export function InvoiceActions({ orderId }: { orderId: string }) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [message, setMessage] = useState('')

  function previewInvoice() {
    document.getElementById('invoice-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function printInvoice() {
    setMessage('Opening print dialog…')
    window.print()
  }

  async function downloadPdf() {
    if (isDownloading) return
    setIsDownloading(true)
    setMessage('Preparing PDF…')
    try {
      const response = await fetch(`/api/invoices/${encodeURIComponent(orderId)}`, { credentials: 'same-origin' })
      if (!response.ok) throw new Error('The invoice PDF could not be prepared.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'sahigadget-invoice.pdf'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setMessage('PDF downloaded successfully.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The invoice PDF could not be prepared.')
    } finally {
      setIsDownloading(false)
    }
  }

  return <div className="mx-auto flex max-w-[860px] flex-wrap items-center justify-between gap-3 px-4 pb-4 print:hidden sm:px-6">
    <button type="button" onClick={previewInvoice} className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"><Eye className="h-4 w-4" /> Preview</button>
    <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={printInvoice} className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"><Printer className="h-4 w-4" /> Print invoice</button><button type="button" onClick={downloadPdf} disabled={isDownloading} className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-emerald-600 hover:text-slate-950 disabled:cursor-wait disabled:opacity-60"><Download className="h-4 w-4" /> {isDownloading ? 'Preparing PDF…' : 'Download PDF'}</button></div>
    <p className="w-full text-right text-xs text-slate-500" aria-live="polite">{message}</p>
  </div>
}
