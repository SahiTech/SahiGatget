import fs from 'node:fs/promises'

import { renderInvoicePdf } from '../lib/invoices/pdf-renderer.ts'

const fixture = {
  id: '00000000-0000-0000-0000-000000000001',
  invoiceNumber: 'INV-20260813-000001',
  orderId: '00000000-0000-0000-0000-000000000002',
  orderNumber: 'SG-20260813-ABCDEF12',
  issuedAt: '2026-08-13T08:00:00.000Z',
  orderDate: '2026-08-13T08:00:00.000Z',
  orderStatus: 'PENDING',
  paymentMethod: 'COD',
  paymentStatus: 'pending',
  customer: { name: 'Test Customer', phone: '+8801700000000', email: 'test@example.invalid' },
  delivery: { address: 'Test address, Bangladesh', division: 'Dhaka', district: 'Dhaka', area: 'Dhanmondi', postalCode: '1209' },
  financials: { subtotal: 25000, discountTotal: 500, deliveryCharge: 80, grandTotal: 25080 },
  warrantyPolicy: '7 Days Guarantee & 1 Year Service Warranty.',
  returnRefundPolicy: 'A valid invoice or order identification is required.',
  storeProfile: { businessName: 'SahiGadget', established: 2019, tagline: 'সঠিক দাম, সঠিক গ্যাজেট', brandPromise: 'আসল পণ্য', location: 'Dhaka, Bangladesh', phone: '+8801601654316', publicEmail: 'test@example.invalid', currency: 'BDT' },
  items: [{ id: 'item-1', sku: 'TEST-SKU', productName: 'Test Phone', variantTitle: '8GB / 128GB · Black', imei: '123456789012345', imei2: null, serialNumber: 'SN-TEST', unitPrice: 25000, compareAtPrice: 25500, discountAmount: 500, quantity: 1, lineTotal: 25000, warrantyPolicy: '7 Days Guarantee & 1 Year Service Warranty.' }],
}

const pdf = await renderInvoicePdf(fixture)
if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('PDF header missing')
if (pdf.length < 1000) throw new Error('PDF output unexpectedly small')
await fs.writeFile('/tmp/sahigatget-phase7-invoice-fixture.pdf', pdf)
console.log(JSON.stringify({ ok: true, bytes: pdf.length, output: '/tmp/sahigatget-phase7-invoice-fixture.pdf' }))
