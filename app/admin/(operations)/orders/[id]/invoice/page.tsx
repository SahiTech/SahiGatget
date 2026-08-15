import type { Metadata } from 'next'

import { InvoiceActions } from '@/components/invoices/invoice-actions'
import { InvoiceDocumentView } from '@/components/invoices/invoice-document-view'
import { getAdminInvoiceDocument } from '@/lib/invoices/service'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Invoice preview · SahiGadget Admin',
  robots: { index: false, follow: false },
}

export default async function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await getAdminInvoiceDocument(id)
  return <main className="invoice-page min-h-screen bg-slate-100 py-8"><InvoiceActions orderId={invoice.orderId} />{await InvoiceDocumentView({ invoice })}</main>
}
