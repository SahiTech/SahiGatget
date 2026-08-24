import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin/auth'
import type { InvoiceDocument, InvoiceDocumentItem } from '@/lib/invoices/types'

function numberValue(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function textValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function optionalText(value: unknown) {
  const text = textValue(value).trim()
  return text ? text : null
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('8801')) return `+${digits}`
  if (digits.startsWith('01')) return `+88${digits}`
  return phone.trim()
}

function storeProfile(value: unknown) {
  const profile = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    businessName: textValue(profile.business_name, 'SahiGadget Mobile Phone & Gadget Shop'),
    established: Number.isFinite(Number(profile.established)) ? Number(profile.established) : null,
    tagline: textValue(profile.tagline, 'সঠিক দাম, সঠিক গ্যাজেট'),
    brandPromise: textValue(profile.brand_promise, 'আসল পণ্য • দ্রুত ডেলিভারি • সারা দেশে সেবা'),
    location: textValue(profile.location, 'Araihazar, Narayanganj, Bangladesh – 1460'),
    phone: textValue(profile.phone, '+880 1601-654316'),
    publicEmail: textValue(profile.public_email, 'hello@sahigadget.shop'),
    currency: textValue(profile.currency, 'BDT'),
  }
}

async function ensureInvoice(orderId: string) {
  const db = createAdminClient()
  const { data, error } = await db.rpc('ensure_invoice_for_order', { p_order_id: orderId })
  if (error || !data?.[0]?.invoice_id) {
    const message = error?.message ?? 'Unable to create the invoice snapshot.'
    if (message.includes('ORDER_NOT_FOUND')) throw new Error('Order not found.')
    throw new Error('Unable to create the invoice snapshot.')
  }
  return { invoiceId: String(data[0].invoice_id), invoiceNumber: String(data[0].invoice_number) }
}

async function loadInvoiceById(invoiceId: string, includeSensitiveIdentifiers: boolean): Promise<InvoiceDocument> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('invoices')
    .select('id,invoice_number,order_id,subtotal,discount_total,delivery_charge,grand_total,issued_at,order_number_snapshot,customer_name_snapshot,customer_phone_snapshot,customer_email_snapshot,shipping_address_snapshot,shipping_division_snapshot,shipping_district_snapshot,shipping_area_snapshot,shipping_postal_code_snapshot,payment_method_snapshot,payment_status_snapshot,order_status_snapshot,warranty_policy_snapshot,return_refund_policy_snapshot,store_profile_snapshot,invoice_items(id,sku,product_name_snapshot,variant_title_snapshot,imei_snapshot,imei_2_snapshot,serial_number_snapshot,unit_price,compare_at_price_snapshot,discount_amount,quantity,line_total,warranty_policy_snapshot)')
    .eq('id', invoiceId)
    .maybeSingle()

  if (error || !data) throw new Error('Invoice could not be loaded safely.')
  const row = data as unknown as Record<string, unknown>
  const { data: orderToken } = await db.from('orders').select('tracking_token').eq('id', String(row.order_id)).maybeSingle()
  const rawItems = Array.isArray(row.invoice_items) ? row.invoice_items as Array<Record<string, unknown>> : []
  const items: InvoiceDocumentItem[] = rawItems.map((item) => ({
    id: textValue(item.id),
    sku: textValue(item.sku),
    productName: textValue(item.product_name_snapshot),
    variantTitle: textValue(item.variant_title_snapshot),
    imei: includeSensitiveIdentifiers ? optionalText(item.imei_snapshot) : null,
    imei2: includeSensitiveIdentifiers ? optionalText(item.imei_2_snapshot) : null,
    serialNumber: includeSensitiveIdentifiers ? optionalText(item.serial_number_snapshot) : null,
    unitPrice: numberValue(item.unit_price),
    compareAtPrice: item.compare_at_price_snapshot === null ? null : numberValue(item.compare_at_price_snapshot),
    discountAmount: numberValue(item.discount_amount),
    quantity: numberValue(item.quantity),
    lineTotal: numberValue(item.line_total),
    warrantyPolicy: optionalText(item.warranty_policy_snapshot),
  }))

  return {
    id: textValue(row.id),
    invoiceNumber: textValue(row.invoice_number),
    orderId: textValue(row.order_id),
    orderNumber: textValue(row.order_number_snapshot),
    verificationToken: optionalText(orderToken?.tracking_token),
    issuedAt: textValue(row.issued_at),
    orderDate: textValue(row.issued_at),
    orderStatus: textValue(row.order_status_snapshot, 'PENDING'),
    paymentMethod: textValue(row.payment_method_snapshot, 'COD'),
    paymentStatus: textValue(row.payment_status_snapshot, 'pending'),
    customer: {
      name: textValue(row.customer_name_snapshot),
      phone: textValue(row.customer_phone_snapshot),
      email: optionalText(row.customer_email_snapshot),
    },
    delivery: {
      address: textValue(row.shipping_address_snapshot),
      division: textValue(row.shipping_division_snapshot),
      district: textValue(row.shipping_district_snapshot),
      area: textValue(row.shipping_area_snapshot),
      postalCode: optionalText(row.shipping_postal_code_snapshot),
    },
    financials: {
      subtotal: numberValue(row.subtotal),
      discountTotal: numberValue(row.discount_total),
      deliveryCharge: numberValue(row.delivery_charge),
      grandTotal: numberValue(row.grand_total),
    },
    warrantyPolicy: optionalText(row.warranty_policy_snapshot) ?? items.map((item) => item.warrantyPolicy).find(Boolean) ?? null,
    returnRefundPolicy: optionalText(row.return_refund_policy_snapshot),
    storeProfile: storeProfile(row.store_profile_snapshot),
    items,
  }
}

async function loadInvoiceForOrder(orderId: string, includeSensitiveIdentifiers: boolean) {
  const ensured = await ensureInvoice(orderId)
  return loadInvoiceById(ensured.invoiceId, includeSensitiveIdentifiers)
}

export async function getAdminInvoiceDocument(orderId: string) {
  await requireAdmin(['OWNER', 'ADMIN'])
  return loadInvoiceForOrder(orderId, true)
}

export async function getGuestInvoiceDocument(orderNumber: string, phone: string) {
  const normalizedOrderNumber = orderNumber.trim().toUpperCase()
  const db = createAdminClient()
  const { data: order, error } = await db
    .from('orders')
    .select('id,customer_phone_snapshot')
    .eq('order_number', normalizedOrderNumber)
    .maybeSingle()

  if (error || !order || normalizePhone(String(order.customer_phone_snapshot)) !== normalizePhone(phone)) {
    throw new Error('We could not verify this order. Check the order number and mobile number, then try again.')
  }
  return loadInvoiceForOrder(String(order.id), false)
}

export async function getPublicInvoiceVerification(token: string) {
  const normalizedToken = token.trim()
  if (!normalizedToken || normalizedToken.length > 160) return null
  const db = createAdminClient()
  const { data: order, error } = await db
    .from('orders')
    .select('id,order_number,created_at,order_status,payment_status,subtotal,discount_total,delivery_charge,grand_total')
    .eq('tracking_token', normalizedToken)
    .maybeSingle()
  if (error || !order) return null

  const { data: items, error: itemsError } = await db
    .from('order_items')
    .select('quantity')
    .eq('order_id', String((order as Record<string, unknown>).id))
  if (itemsError) return null

  const row = order as Record<string, unknown>
  const safeItems = (items ?? []) as Array<Record<string, unknown>>
  return {
    orderNumber: textValue(row.order_number),
    createdAt: textValue(row.created_at),
    status: textValue(row.order_status, 'PENDING'),
    paymentStatus: textValue(row.payment_status, 'pending'),
    subtotal: numberValue(row.subtotal),
    discountTotal: numberValue(row.discount_total),
    deliveryCharge: numberValue(row.delivery_charge),
    grandTotal: numberValue(row.grand_total),
    itemCount: safeItems.reduce((sum, item) => sum + numberValue(item.quantity), 0),
  }
}
