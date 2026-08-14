import { NextResponse } from 'next/server'

import { getGuestInvoiceDocument } from '@/lib/invoices/service'
import { renderInvoicePdf } from '@/lib/invoices/pdf'
import { trackingLookupSchema } from '@/lib/orders/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { orderNumber?: unknown; phone?: unknown }
    const parsed = trackingLookupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: 'Enter the complete order number and the mobile number used during checkout.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    }
    const invoice = await getGuestInvoiceDocument(parsed.data.orderNumber, parsed.data.phone)
    const pdf = await renderInvoicePdf(invoice)
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    })
  } catch {
    return NextResponse.json({ ok: false, message: 'We could not verify this order for invoice access.' }, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
