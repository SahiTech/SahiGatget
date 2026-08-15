import 'regenerator-runtime/runtime.js'

import fs from 'node:fs/promises'
import path from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import QRCode from 'qrcode'
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import type { InvoiceDocument } from '@/lib/invoices/types'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 34
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
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

function statusLabel(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
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

function drawWrapped(page: PDFPage, text: string, x: number, y: number, maxWidth: number, font: PDFFont, size: number, color = MUTED, lineHeight = size + 2) {
  const lines = wrap(text, font, size, maxWidth)
  lines.forEach((line, index) => page.drawText(line, { x, y: y - index * lineHeight, size, font, color }))
  return y - lines.length * lineHeight
}

function drawBox(page: PDFPage, x: number, y: number, width: number, height: number, fill = rgb(1, 1, 1)) {
  page.drawRectangle({ x, y: y - height, width, height, color: fill, borderColor: BORDER, borderWidth: 0.6 })
}

function drawFooter(page: PDFPage, font: PDFFont, bold: PDFFont) {
  page.drawLine({ start: { x: MARGIN, y: 28 }, end: { x: PAGE_WIDTH - MARGIN, y: 28 }, thickness: 0.6, color: BORDER })
  page.drawText('Keep this invoice for order and warranty reference.', { x: MARGIN, y: 15, size: 6.8, font, color: MUTED })
  page.drawText('SahiGadget · Araihazar, Narayanganj · +880 1601-654316', { x: PAGE_WIDTH - MARGIN - 230, y: 15, size: 6.8, font: bold, color: MUTED })
}

async function loadOptionalLogo(document: PDFDocument) {
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), 'public/logo.png'))
    return await document.embedPng(bytes)
  } catch {
    return null
  }
}

export async function renderInvoicePdf(invoice: InvoiceDocument) {
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const regularBytes = await fs.readFile(path.join(process.cwd(), 'public/fonts/NotoSans-Regular.ttf'))
  const boldBytes = await fs.readFile(path.join(process.cwd(), 'public/fonts/NotoSans-Bold.ttf'))
  const bengaliRegularBytes = await fs.readFile(path.join(process.cwd(), 'public/fonts/NotoSansBengali-Regular.ttf'))
  const regular = await document.embedFont(regularBytes, { subset: true })
  const bold = await document.embedFont(boldBytes, { subset: true })
  const bengaliRegular = await document.embedFont(bengaliRegularBytes, { subset: true })
  const logo = await loadOptionalLogo(document)
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 9, width: PAGE_WIDTH, height: 9, color: ACCENT })
  if (logo) page.drawImage(logo, { x: MARGIN, y: y - 30, width: 28, height: 28 })
  const brandX = logo ? MARGIN + 38 : MARGIN
  page.drawText(invoice.storeProfile.businessName, { x: brandX, y: y - 13, size: 15, font: bold, color: DARK })
  page.drawText(invoice.storeProfile.tagline, { x: brandX, y: y - 27, size: 7.3, font: bengaliRegular, color: ACCENT })
  page.drawText(invoice.storeProfile.brandPromise, { x: brandX, y: y - 39, size: 6.8, font: bengaliRegular, color: MUTED })
  page.drawText('INVOICE', { x: PAGE_WIDTH - MARGIN - 82, y: y - 12, size: 16, font: bold, color: ACCENT })
  page.drawText(invoice.invoiceNumber, { x: PAGE_WIDTH - MARGIN - 82, y: y - 29, size: 7.8, font: bold, color: DARK })
  page.drawText(`Issued ${dateLabel(invoice.issuedAt)}`, { x: PAGE_WIDTH - MARGIN - 82, y: y - 41, size: 6.8, font: regular, color: MUTED })
  y -= 57

  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.8, color: ACCENT })
  y -= 14
  page.drawText(`Order ${invoice.orderNumber}`, { x: MARGIN, y, size: 7.4, font: bold, color: DARK })
  page.drawText(`Date ${dateLabel(invoice.orderDate)}`, { x: MARGIN + 145, y, size: 7.4, font: regular, color: MUTED })
  page.drawText(`Status ${statusLabel(invoice.orderStatus)}`, { x: PAGE_WIDTH - MARGIN - 140, y, size: 7.4, font: bold, color: DARK })
  y -= 21

  const boxWidth = (CONTENT_WIDTH - 10) / 2
  const boxY = y
  drawBox(page, MARGIN, boxY, boxWidth, 70, LIGHT)
  drawBox(page, MARGIN + boxWidth + 10, boxY, boxWidth, 70, LIGHT)
  page.drawText('CUSTOMER INFORMATION', { x: MARGIN + 11, y: boxY - 15, size: 6.8, font: bold, color: ACCENT })
  let customerY = boxY - 29
  customerY = drawWrapped(page, invoice.customer.name, MARGIN + 11, customerY, boxWidth - 22, bold, 8, DARK, 9.5)
  customerY = drawWrapped(page, invoice.customer.phone, MARGIN + 11, customerY - 1, boxWidth - 22, regular, 7.2, MUTED, 8.5)
  if (invoice.customer.email) drawWrapped(page, invoice.customer.email, MARGIN + 11, customerY - 1, boxWidth - 22, regular, 7.2, MUTED, 8.5)
  const deliveryX = MARGIN + boxWidth + 21
  page.drawText('DELIVERY INFORMATION', { x: deliveryX, y: boxY - 15, size: 6.8, font: bold, color: ACCENT })
  let addressY = boxY - 29
  addressY = drawWrapped(page, invoice.delivery.address, deliveryX, addressY, boxWidth - 22, regular, 7.2, DARK, 8.5)
  drawWrapped(page, [invoice.delivery.area, invoice.delivery.district, invoice.delivery.division, invoice.delivery.postalCode].filter(Boolean).join(', '), deliveryX, addressY - 1, boxWidth - 22, regular, 7.2, MUTED, 8.5)
  y = boxY - 83

  page.drawText('ORDER ITEMS', { x: MARGIN, y, size: 7.4, font: bold, color: ACCENT })
  y -= 11
  const tableX = MARGIN
  const tableWidth = CONTENT_WIDTH
  const columns = { item: tableX + 7, sku: tableX + 260, qty: tableX + 335, unit: tableX + 382, total: tableX + 454 }
  page.drawRectangle({ x: tableX, y: y - 17, width: tableWidth, height: 17, color: DARK })
  page.drawText('Product / বিবরণ', { x: columns.item, y: y - 12, size: 6.3, font: bold, color: rgb(1, 1, 1) })
  page.drawText('SKU', { x: columns.sku, y: y - 12, size: 6.3, font: bold, color: rgb(1, 1, 1) })
  page.drawText('Qty', { x: columns.qty, y: y - 12, size: 6.3, font: bold, color: rgb(1, 1, 1) })
  page.drawText('Unit', { x: columns.unit, y: y - 12, size: 6.3, font: bold, color: rgb(1, 1, 1) })
  page.drawText('Total', { x: columns.total, y: y - 12, size: 6.3, font: bold, color: rgb(1, 1, 1) })
  y -= 27

  const dense = invoice.items.length > 8
  const itemSize = dense ? 6.1 : 7
  const mutedSize = dense ? 5.8 : 6.4
  const lineHeight = dense ? 7 : 8
  for (const [index, item] of invoice.items.entries()) {
    const variant = item.variantTitle ? ` · ${item.variantTitle}` : ''
    const serial = [item.imei && `IMEI ${item.imei}`, item.imei2 && `IMEI 2 ${item.imei2}`, item.serialNumber && `SN ${item.serialNumber}`].filter(Boolean).join(' · ')
    const description = `${item.productName}${variant}${serial ? ` · ${serial}` : ''}`
    const itemLines = wrap(description, regular, itemSize, 244)
    const rowHeight = Math.max(dense ? 15 : 18, itemLines.length * lineHeight + (dense ? 5 : 7))
    if (index % 2 === 0) page.drawRectangle({ x: tableX, y: y + 4, width: tableWidth, height: rowHeight, color: rgb(0.98, 0.99, 0.99) })
    itemLines.forEach((line, lineIndex) => page.drawText(line, { x: columns.item, y: y - lineIndex * lineHeight, size: itemSize, font: regular, color: DARK }))
    if (item.sku) page.drawText(item.sku, { x: columns.sku, y: y - 1, size: mutedSize, font: regular, color: MUTED })
    page.drawText(String(item.quantity), { x: columns.qty + 7, y: y - 1, size: itemSize, font: bold, color: DARK })
    page.drawText(money(item.unitPrice, invoice.storeProfile.currency), { x: columns.unit, y: y - 1, size: mutedSize, font: regular, color: MUTED })
    page.drawText(money(item.lineTotal, invoice.storeProfile.currency), { x: columns.total, y: y - 1, size: mutedSize, font: bold, color: DARK })
    page.drawLine({ start: { x: tableX, y: y - rowHeight + 4 }, end: { x: tableX + tableWidth, y: y - rowHeight + 4 }, thickness: 0.35, color: BORDER })
    y -= rowHeight
  }

  y -= 12
  const summaryWidth = 194
  const qrSize = 78
  const summaryX = PAGE_WIDTH - MARGIN - summaryWidth
  const qrX = MARGIN
  const bottomY = Math.max(68, y - 94)
  page.drawText('PRICE SUMMARY', { x: summaryX, y, size: 7.4, font: bold, color: ACCENT })
  const summaryRows = [
    ['Subtotal', money(invoice.financials.subtotal, invoice.storeProfile.currency)],
    ...(invoice.financials.discountTotal ? [['Discount', `− ${money(invoice.financials.discountTotal, invoice.storeProfile.currency)}`]] : []),
    ['Delivery charge', money(invoice.financials.deliveryCharge, invoice.storeProfile.currency)],
  ]
  let summaryY = y - 15
  for (const [label, value] of summaryRows) {
    page.drawText(label, { x: summaryX, y: summaryY, size: 7.2, font: regular, color: MUTED })
    page.drawText(value, { x: summaryX + 93, y: summaryY, size: 7.2, font: regular, color: DARK })
    summaryY -= 13
  }
  page.drawLine({ start: { x: summaryX, y: summaryY + 4 }, end: { x: PAGE_WIDTH - MARGIN, y: summaryY + 4 }, thickness: 0.7, color: ACCENT })
  page.drawText('Grand total', { x: summaryX, y: summaryY - 10, size: 9, font: bold, color: DARK })
  page.drawText(money(invoice.financials.grandTotal, invoice.storeProfile.currency), { x: summaryX + 93, y: summaryY - 10, size: 9, font: bold, color: ACCENT })
  page.drawText(`Payment: ${statusLabel(invoice.paymentMethod)} · ${statusLabel(invoice.paymentStatus)}`, { x: summaryX, y: summaryY - 25, size: 6.5, font: regular, color: MUTED })

  page.drawText('QR VERIFICATION', { x: qrX, y, size: 7.4, font: bold, color: ACCENT })
  if (invoice.verificationToken) {
    try {
      const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sahigadget.shop'
      const qrUrl = `${site.replace(/\/$/, '')}/verify-order/${encodeURIComponent(invoice.verificationToken)}`
      const qrPng = await QRCode.toBuffer(qrUrl, { type: 'png', width: 240, margin: 1, errorCorrectionLevel: 'M' })
      const qrImage = await document.embedPng(qrPng)
      page.drawImage(qrImage, { x: qrX, y: bottomY, width: qrSize, height: qrSize })
      page.drawText('Scan to verify this invoice', { x: qrX + qrSize + 10, y: bottomY + 48, size: 7.2, font: bold, color: DARK })
      page.drawText(invoice.invoiceNumber, { x: qrX + qrSize + 10, y: bottomY + 36, size: 6.8, font: regular, color: MUTED })
      page.drawText('Read-only public verification', { x: qrX + qrSize + 10, y: bottomY + 24, size: 6.4, font: regular, color: MUTED })
    } catch {
      page.drawText('Invoice:', { x: qrX, y: bottomY + 48, size: 7.2, font: bold, color: DARK })
      page.drawText(invoice.invoiceNumber, { x: qrX, y: bottomY + 36, size: 7.2, font: regular, color: MUTED })
      page.drawText('Verify at sahigadget.shop', { x: qrX, y: bottomY + 24, size: 6.8, font: regular, color: MUTED })
    }
  } else {
    page.drawText('Invoice:', { x: qrX, y: bottomY + 48, size: 7.2, font: bold, color: DARK })
    page.drawText(invoice.invoiceNumber, { x: qrX, y: bottomY + 36, size: 7.2, font: regular, color: MUTED })
    page.drawText('Verify at sahigadget.shop', { x: qrX, y: bottomY + 24, size: 6.8, font: regular, color: MUTED })
  }

  if (invoice.warrantyPolicy || invoice.returnRefundPolicy) {
    const policyText = [invoice.warrantyPolicy, invoice.returnRefundPolicy].filter(Boolean).join(' · ')
    drawWrapped(page, `Policy: ${policyText}`, MARGIN, 68, CONTENT_WIDTH, regular, 6.2, MUTED, 7.2)
  }
  page.drawText('Customer support: ' + invoice.storeProfile.publicEmail, { x: MARGIN, y: 45, size: 6.5, font: regular, color: MUTED })
  drawFooter(page, regular, bold)

  return Buffer.from(await document.save())
}
