import 'regenerator-runtime/runtime.js'

import fs from 'node:fs/promises'
import path from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import type { InvoiceDocument } from '@/lib/invoices/types'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 42
const DARK = rgb(0.07, 0.11, 0.18)
const MUTED = rgb(0.32, 0.37, 0.45)
const ACCENT = rgb(0.03, 0.62, 0.46)
const LIGHT = rgb(0.94, 0.97, 0.96)
const BORDER = rgb(0.84, 0.87, 0.88)

function money(value: number, currency = 'BDT') {
  return `${currency === 'BDT' ? '৳' : currency} ${new Intl.NumberFormat('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
}

function dateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' }).format(date)
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) current = candidate
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function drawWrapped(page: PDFPage, text: string, x: number, y: number, maxWidth: number, font: PDFFont, size: number, color = MUTED, lineHeight = size + 3) {
  const lines = wrap(text, font, size, maxWidth)
  lines.forEach((line, index) => page.drawText(line, { x, y: y - index * lineHeight, size, font, color }))
  return y - lines.length * lineHeight
}

function drawBox(page: PDFPage, x: number, y: number, width: number, height: number, fill = rgb(1, 1, 1)) {
  page.drawRectangle({ x, y: y - height, width, height, color: fill, borderColor: BORDER, borderWidth: 0.7 })
}

function drawFooter(page: PDFPage, font: PDFFont, bold: PDFFont, pageNumber: number) {
  page.drawLine({ start: { x: MARGIN, y: 30 }, end: { x: PAGE_WIDTH - MARGIN, y: 30 }, thickness: 0.7, color: BORDER })
  page.drawText('Thank you for choosing SahiGadget · ধন্যবাদ', { x: MARGIN, y: 17, size: 7.5, font, color: MUTED })
  page.drawText(`Page ${pageNumber}`, { x: PAGE_WIDTH - MARGIN - 38, y: 17, size: 7.5, font: bold, color: MUTED })
}

export async function renderInvoicePdf(invoice: InvoiceDocument) {
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const regularBytes = await fs.readFile(path.join(process.cwd(), 'public/fonts/NotoSansBengali-Regular.ttf'))
  const boldBytes = await fs.readFile(path.join(process.cwd(), 'public/fonts/NotoSansBengali-Bold.ttf'))
  const regular = await document.embedFont(regularBytes, { subset: true })
  const bold = await document.embedFont(boldBytes, { subset: true })

  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let pageNumber = 1
  let y = PAGE_HEIGHT - MARGIN

  const newPage = () => {
    drawFooter(page, regular, bold, pageNumber)
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    pageNumber += 1
    y = PAGE_HEIGHT - MARGIN
  }

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 13, width: PAGE_WIDTH, height: 13, color: ACCENT })
  page.drawText(invoice.storeProfile.businessName, { x: MARGIN, y: y - 22, size: 19, font: bold, color: DARK })
  page.drawText(invoice.storeProfile.tagline, { x: MARGIN, y: y - 42, size: 9, font: regular, color: ACCENT })
  page.drawText(invoice.storeProfile.brandPromise, { x: MARGIN, y: y - 58, size: 8, font: regular, color: MUTED })
  page.drawText('INVOICE', { x: PAGE_WIDTH - MARGIN - 105, y: y - 22, size: 21, font: bold, color: ACCENT })
  page.drawText(invoice.invoiceNumber, { x: PAGE_WIDTH - MARGIN - 105, y: y - 41, size: 9, font: bold, color: DARK })
  page.drawText(`Issued ${dateLabel(invoice.issuedAt)}`, { x: PAGE_WIDTH - MARGIN - 105, y: y - 57, size: 8, font: regular, color: MUTED })
  y -= 82

  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: ACCENT })
  y -= 24
  page.drawText('Store information', { x: MARGIN, y, size: 8, font: bold, color: ACCENT })
  page.drawText(`${invoice.storeProfile.location} · ${invoice.storeProfile.phone}`, { x: MARGIN, y: y - 14, size: 8, font: regular, color: MUTED })
  page.drawText(invoice.storeProfile.publicEmail, { x: MARGIN, y: y - 27, size: 8, font: regular, color: MUTED })
  page.drawText(`Order ${invoice.orderNumber} · ${dateLabel(invoice.orderDate)}`, { x: PAGE_WIDTH - MARGIN - 190, y, size: 8, font: bold, color: DARK })
  page.drawText(`Payment ${invoice.paymentMethod} · ${invoice.paymentStatus}`, { x: PAGE_WIDTH - MARGIN - 190, y: y - 14, size: 8, font: regular, color: MUTED })
  page.drawText(`Status ${invoice.orderStatus.replace(/_/g, ' ')}`, { x: PAGE_WIDTH - MARGIN - 190, y: y - 27, size: 8, font: regular, color: MUTED })
  y -= 56

  const boxWidth = (PAGE_WIDTH - MARGIN * 2 - 12) / 2
  const boxY = y
  drawBox(page, MARGIN, boxY, boxWidth, 105, LIGHT)
  drawBox(page, MARGIN + boxWidth + 12, boxY, boxWidth, 105, LIGHT)
  page.drawText('Bill to / গ্রাহক', { x: MARGIN + 14, y: boxY - 18, size: 9, font: bold, color: DARK })
  let customerY = boxY - 36
  customerY = drawWrapped(page, invoice.customer.name, MARGIN + 14, customerY, boxWidth - 28, bold, 9, DARK, 12)
  customerY = drawWrapped(page, invoice.customer.phone, MARGIN + 14, customerY - 2, boxWidth - 28, regular, 8, MUTED, 11)
  if (invoice.customer.email) drawWrapped(page, invoice.customer.email, MARGIN + 14, customerY - 2, boxWidth - 28, regular, 8, MUTED, 11)
  page.drawText('Deliver to / ঠিকানা', { x: MARGIN + boxWidth + 26, y: boxY - 18, size: 9, font: bold, color: DARK })
  let addressY = boxY - 36
  addressY = drawWrapped(page, invoice.delivery.address, MARGIN + boxWidth + 26, addressY, boxWidth - 28, regular, 8, DARK, 11)
  drawWrapped(page, [invoice.delivery.area, invoice.delivery.district, invoice.delivery.division, invoice.delivery.postalCode].filter(Boolean).join(', '), MARGIN + boxWidth + 26, addressY - 2, boxWidth - 28, regular, 8, MUTED, 11)
  y = boxY - 125

  page.drawText('Items / পণ্য', { x: MARGIN, y, size: 9, font: bold, color: ACCENT })
  y -= 16
  const tableX = MARGIN
  const tableWidth = PAGE_WIDTH - MARGIN * 2
  const columns = { item: tableX, sku: tableX + 246, qty: tableX + 315, unit: tableX + 360, total: tableX + 445 }
  page.drawRectangle({ x: tableX, y: y - 22, width: tableWidth, height: 22, color: DARK })
  page.drawText('Item / বিবরণ', { x: columns.item + 8, y: y - 15, size: 7.5, font: bold, color: rgb(1, 1, 1) })
  page.drawText('SKU', { x: columns.sku, y: y - 15, size: 7.5, font: bold, color: rgb(1, 1, 1) })
  page.drawText('Qty', { x: columns.qty, y: y - 15, size: 7.5, font: bold, color: rgb(1, 1, 1) })
  page.drawText('Unit', { x: columns.unit, y: y - 15, size: 7.5, font: bold, color: rgb(1, 1, 1) })
  page.drawText('Total', { x: columns.total, y: y - 15, size: 7.5, font: bold, color: rgb(1, 1, 1) })
  y -= 38

  for (const item of invoice.items) {
    const serial = [item.imei && `IMEI ${item.imei}`, item.imei2 && `IMEI 2 ${item.imei2}`, item.serialNumber && `SN ${item.serialNumber}`].filter(Boolean).join(' · ')
    const itemLines = wrap(`${item.productName} · ${item.variantTitle}${serial ? ` · ${serial}` : ''}`, regular, 8, 232)
    const rowHeight = Math.max(28, itemLines.length * 10 + 12)
    if (y - rowHeight < 155) newPage()
    if (pageNumber > 1 && y === PAGE_HEIGHT - MARGIN) {
      page.drawText('Items continued / পণ্য চলমান', { x: MARGIN, y, size: 9, font: bold, color: ACCENT })
      y -= 18
    }
    if (Math.round((PAGE_HEIGHT - MARGIN - y) / 2) % 2 === 0) page.drawRectangle({ x: tableX, y: y + 5, width: tableWidth, height: rowHeight, color: rgb(0.98, 0.99, 0.99) })
    itemLines.forEach((line, index) => page.drawText(line, { x: columns.item + 8, y: y - index * 10, size: 8, font: regular, color: DARK }))
    page.drawText(item.sku, { x: columns.sku, y: y - 2, size: 7.5, font: regular, color: MUTED })
    page.drawText(String(item.quantity), { x: columns.qty + 7, y: y - 2, size: 8, font: bold, color: DARK })
    page.drawText(money(item.unitPrice, invoice.storeProfile.currency), { x: columns.unit, y: y - 2, size: 7.5, font: regular, color: MUTED })
    page.drawText(money(item.lineTotal, invoice.storeProfile.currency), { x: columns.total, y: y - 2, size: 7.5, font: bold, color: DARK })
    page.drawLine({ start: { x: tableX, y: y - rowHeight + 7 }, end: { x: tableX + tableWidth, y: y - rowHeight + 7 }, thickness: 0.5, color: BORDER })
    y -= rowHeight
  }

  if (y < 240) newPage()
  const summaryX = PAGE_WIDTH - MARGIN - 190
  page.drawText('Summary / হিসাব', { x: summaryX, y, size: 9, font: bold, color: ACCENT })
  y -= 20
  const summaryRows = [
    ['Subtotal', money(invoice.financials.subtotal, invoice.storeProfile.currency)],
    ['Discount', `- ${money(invoice.financials.discountTotal, invoice.storeProfile.currency)}`],
    ['Delivery', money(invoice.financials.deliveryCharge, invoice.storeProfile.currency)],
  ]
  for (const [label, value] of summaryRows) {
    page.drawText(label, { x: summaryX, y, size: 8.5, font: regular, color: MUTED })
    page.drawText(value, { x: summaryX + 93, y, size: 8.5, font: regular, color: DARK })
    y -= 16
  }
  page.drawLine({ start: { x: summaryX, y: y + 5 }, end: { x: PAGE_WIDTH - MARGIN, y: y + 5 }, thickness: 0.8, color: ACCENT })
  page.drawText('Grand total', { x: summaryX, y: y - 12, size: 10, font: bold, color: DARK })
  page.drawText(money(invoice.financials.grandTotal, invoice.storeProfile.currency), { x: summaryX + 93, y: y - 12, size: 10, font: bold, color: ACCENT })
  y -= 44

  if (invoice.warrantyPolicy || invoice.returnRefundPolicy) {
    page.drawText('Warranty & return notes / ওয়ারেন্টি ও রিটার্ন', { x: MARGIN, y, size: 9, font: bold, color: ACCENT })
    y -= 16
    if (invoice.warrantyPolicy) y = drawWrapped(page, invoice.warrantyPolicy, MARGIN, y, PAGE_WIDTH - MARGIN * 2, regular, 8, MUTED, 11) - 4
    if (invoice.returnRefundPolicy) {
      y = drawWrapped(page, invoice.returnRefundPolicy, MARGIN, y, PAGE_WIDTH - MARGIN * 2, regular, 8, MUTED, 11)
      y -= 3
    }
  }
  y = Math.max(y, 50)
  page.drawText('Keep this invoice for order identification. IMEI/serial verification applies where relevant. Manufacturer/company warranty terms apply where applicable.', { x: MARGIN, y: Math.min(y, 64), size: 7.2, font: regular, color: MUTED, maxWidth: PAGE_WIDTH - MARGIN * 2 })
  drawFooter(page, regular, bold, pageNumber)

  return Buffer.from(await document.save())
}
