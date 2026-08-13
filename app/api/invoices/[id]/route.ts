import { NextResponse } from 'next/server'

import { getAdminInvoiceDocument } from '@/lib/invoices/service'
import { renderInvoicePdf } from '@/lib/invoices/pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const invoice = await getAdminInvoiceDocument(id)
    const pdf = await renderInvoicePdf(invoice)
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    })
  } catch {
    return NextResponse.json({ ok: false, message: 'This invoice is unavailable or you are not authorized to access it.' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
