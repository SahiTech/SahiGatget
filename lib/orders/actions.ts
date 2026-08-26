'use server'

import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/orders/phone'
import { queueOrderConfirmationEmails } from '@/lib/email/service'
import { recordPurchaseOnce } from '@/lib/analytics/events'
import {
  guestOrderInputSchema,
  orderQuoteInputSchema,
  trackingLookupSchema,
  type GuestOrderInput,
  type OrderSuccessSummary,
  type Quote,
  type TrackingSummary,
} from '@/lib/orders/schema'

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string; fieldErrors?: Record<string, string> }

type VariantRow = {
  id: string
  product_id: string
  sku: string
  variant_title: string
  price: number | string
  compare_at_price: number | string | null
  stock_quantity: number
  is_active: boolean
  product: { id: string; name: string; is_published: boolean; warranty_policy: string } | null
}

type SettingsRow = { key: string; value: unknown }

function fieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return Object.fromEntries(error.issues.map((issue) => [String(issue.path[0] ?? 'form'), issue.message]))
}

function numeric(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function deliveryForDivision(division: string, settings: SettingsRow[]) {
  const config = settings.find((setting) => setting.key === 'delivery_charges')?.value
  const delivery = (config && typeof config === 'object' ? config : {}) as Record<string, unknown>
  const deliveryZone: 'dhaka' | 'outside_dhaka' = division.trim().toLowerCase() === 'dhaka' ? 'dhaka' : 'outside_dhaka'
  const deliveryCharge = numeric(delivery[deliveryZone === 'dhaka' ? 'dhaka' : 'outside_dhaka'])
  if (deliveryCharge === null || deliveryCharge < 0) throw new Error('Delivery configuration is unavailable.')
  return { deliveryZone, deliveryCharge }
}

async function loadVariantQuote(selection: { productId: string; variantId: string; quantity: number }, division: string): Promise<Quote> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('product_variants')
    .select('id,product_id,sku,variant_title,price,compare_at_price,stock_quantity,is_active,product:products!inner(id,name,is_published,warranty_policy)')
    .eq('id', selection.variantId)
    .eq('product_id', selection.productId)
    .maybeSingle()

  if (error || !data) throw new Error('This product variant is no longer available.')
  const variant = data as unknown as VariantRow
  if (!variant.is_active || !variant.product?.is_published) throw new Error('This product is not currently available to order.')

  const [settingsResult] = await Promise.all([
    admin.from('settings').select('key,value').eq('key', 'delivery_charges').limit(1),
  ])
  if (settingsResult.error) throw new Error('Delivery configuration is unavailable.')

  const unitPrice = numeric(variant.price)
  const compareAtPrice = variant.compare_at_price === null ? null : numeric(variant.compare_at_price)
  if (unitPrice === null || unitPrice < 0) throw new Error('The selected variant has no valid selling price.')
  const { deliveryZone, deliveryCharge } = deliveryForDivision(division, (settingsResult.data ?? []) as SettingsRow[])
  const subtotal = unitPrice * selection.quantity
  const discountTotal = Math.max((compareAtPrice ?? unitPrice) - unitPrice, 0) * selection.quantity

  return {
    productName: variant.product.name,
    variantTitle: variant.variant_title,
    sku: variant.sku,
    quantity: selection.quantity,
    unitPrice,
    compareAtPrice,
    discountTotal,
    subtotal,
    deliveryCharge,
    grandTotal: subtotal + deliveryCharge,
    deliveryZone,
    warrantyPolicy: variant.product.warranty_policy,
    available: variant.stock_quantity >= selection.quantity,
  }
}

export async function loadOrderSuccessById(orderId: string): Promise<OrderSuccessSummary> {
  const admin = createAdminClient()
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id,order_number,order_status,created_at,subtotal,discount_total,delivery_charge,grand_total,payment_method,customer_name_snapshot,customer_phone_snapshot,customer_email_snapshot,shipping_division,shipping_district,shipping_area,shipping_address,shipping_postal_code,notes')
    .eq('id', orderId)
    .maybeSingle()
  if (orderError || !order) throw new Error('Your order was created, but its confirmation could not be loaded. Please use order tracking.')

  const { data: items, error: itemsError } = await admin
    .from('order_items')
    .select('product_name_snapshot,variant_title_snapshot,sku,quantity,unit_price,compare_at_price_snapshot,discount_amount,line_total,warranty_policy_snapshot')
    .eq('order_id', orderId)
    .order('created_at')
  if (itemsError) throw new Error('Your order was created, but its item summary could not be loaded. Please use order tracking.')

  const row = order as unknown as Record<string, unknown>
  return {
    orderId: String(row.id),
    orderNumber: String(row.order_number),
    customerName: String(row.customer_name_snapshot),
    customerEmail: row.customer_email_snapshot ? String(row.customer_email_snapshot) : null,
    phone: String(row.customer_phone_snapshot),
    status: String(row.order_status),
    createdAt: String(row.created_at),
    delivery: {
      division: String(row.shipping_division ?? ''),
      district: String(row.shipping_district ?? ''),
      area: String(row.shipping_area ?? ''),
      address: String(row.shipping_address),
      postalCode: row.shipping_postal_code ? String(row.shipping_postal_code) : null,
      notes: row.notes ? String(row.notes) : null,
      charge: Number(row.delivery_charge),
    },
    paymentMethod: 'COD',
    subtotal: Number(row.subtotal),
    discountTotal: Number(row.discount_total),
    grandTotal: Number(row.grand_total),
    items: ((items ?? []) as Array<Record<string, unknown>>).map((item) => ({
      productName: String(item.product_name_snapshot),
      variantTitle: String(item.variant_title_snapshot),
      sku: String(item.sku),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      compareAtPrice: item.compare_at_price_snapshot === null ? null : Number(item.compare_at_price_snapshot),
      discountAmount: Number(item.discount_amount ?? 0),
      lineTotal: Number(item.line_total),
      warrantyPolicy: item.warranty_policy_snapshot ? String(item.warranty_policy_snapshot) : null,
    })),
  }
}

export async function quoteGuestCodOrder(input: unknown): Promise<ActionResult<Quote>> {
  const parsed = orderQuoteInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Please correct the highlighted details.', fieldErrors: fieldErrors(parsed.error) }
  try {
    const quote = await loadVariantQuote(parsed.data, parsed.data.division)
    if (!quote.available) return { ok: false, message: 'The selected quantity is no longer available. Please adjust your order and try again.' }
    return { ok: true, data: quote }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unable to calculate your order total right now.' }
  }
}

export async function createGuestCodOrder(input: unknown): Promise<ActionResult<OrderSuccessSummary>> {
  const parsed = guestOrderInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Please correct the highlighted details.', fieldErrors: fieldErrors(parsed.error) }

  const payload: GuestOrderInput = { ...parsed.data, phone: normalizePhone(parsed.data.phone), email: parsed.data.email || '' }
  try {
    // This preflight makes unavailable-state feedback clearer; the database function performs the final locked revalidation.
    const quote = await loadVariantQuote(payload, payload.division)
    if (!quote.available) return { ok: false, message: 'The selected quantity is no longer available. Please adjust your order and try again.' }

    const admin = createAdminClient()
    const { data, error } = await admin.rpc('create_guest_cod_order', {
      p_product_id: payload.productId,
      p_variant_id: payload.variantId,
      p_quantity: payload.quantity,
      p_checkout_request_id: payload.checkoutRequestId,
      p_customer_name: payload.fullName,
      p_customer_phone: payload.phone,
      p_customer_email: payload.email || null,
      p_division: payload.division,
      p_district: payload.district,
      p_area: payload.area,
      p_address: payload.address,
      p_postal_code: payload.postalCode || null,
      p_notes: payload.notes || null,
    })

    if (error || !Array.isArray(data) || !data[0]?.order_id) {
      const message = error?.message ?? 'Unable to create your order.'
      if (message.includes('INSUFFICIENT_STOCK')) return { ok: false, message: 'The selected quantity is no longer available. Please adjust your order and try again.' }
      if (message.includes('PRODUCT_UNAVAILABLE')) return { ok: false, message: 'This product is not currently available to order.' }
      if (message.includes('INVALID_QUANTITY')) return { ok: false, message: 'Please choose a valid quantity.' }
      return { ok: false, message: 'We could not place your order right now. No payment has been collected. Please try again.' }
    }

    const summary = await loadOrderSuccessById(String(data[0].order_id))
    await recordPurchaseOnce({ orderId: summary.orderId, orderNumber: summary.orderNumber, value: summary.grandTotal, sessionId: payload.checkoutRequestId, consent: { analytics: payload.analyticsConsent, marketing: payload.marketingConsent }, items: summary.items.map((item) => ({ item_id: item.sku, item_name: item.productName, price: item.unitPrice, quantity: item.quantity })) })
    try {
      await queueOrderConfirmationEmails(summary)
    } catch (emailError) {
      console.error('[email] order confirmation notification failed', emailError instanceof Error ? emailError.message : emailError)
    }
    return { ok: true, data: summary }
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message.includes('available') ? error.message : 'We could not place your order right now. No payment has been collected. Please try again.' }
  }
}

export async function lookupGuestOrder(input: unknown): Promise<ActionResult<TrackingSummary>> {
  const parsed = trackingLookupSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Please correct the highlighted details.', fieldErrors: fieldErrors(parsed.error) }
  const admin = createAdminClient()
  const { data: order, error } = await admin
    .from('orders')
    .select('id,order_number,order_status,created_at,payment_method,payment_status,subtotal,discount_total,delivery_charge,grand_total')
    .eq('order_number', parsed.data.orderNumber.toUpperCase())
    .eq('customer_phone_snapshot', normalizePhone(parsed.data.phone))
    .maybeSingle()
  if (error || !order) return { ok: false, message: 'We could not find a matching order. Check the order number and mobile number, then try again.' }

  const orderId = (order as { id: string }).id
  const [{ data: items, error: itemsError }, { data: history, error: historyError }] = await Promise.all([
    admin.from('order_items').select('product_name_snapshot,variant_title_snapshot,quantity,warranty_policy_snapshot').eq('order_id', orderId).order('created_at'),
    admin.from('order_status_history').select('new_status,created_at').eq('order_id', orderId).order('created_at'),
  ])
  if (itemsError || historyError) return { ok: false, message: 'We found the order but could not load its status safely. Please try again.' }

  const safeOrder = order as unknown as Record<string, unknown>
  const safeItems = (items ?? []) as Array<Record<string, unknown>>
  const safeHistory = (history ?? []) as Array<Record<string, unknown>>
  return {
    ok: true,
    data: {
      orderNumber: String(safeOrder.order_number),
      status: String(safeOrder.order_status),
      createdAt: String(safeOrder.created_at),
      paymentMethod: 'COD',
      paymentStatus: String(safeOrder.payment_status),
      subtotal: Number(safeOrder.subtotal),
      discountTotal: Number(safeOrder.discount_total),
      deliveryCharge: Number(safeOrder.delivery_charge),
      grandTotal: Number(safeOrder.grand_total),
      warrantyPolicy: safeItems.map((item) => item.warranty_policy_snapshot ? String(item.warranty_policy_snapshot) : '').find(Boolean) ?? null,
      canDownloadInvoice: true,
      timeline: safeHistory.map((item) => ({ status: String(item.new_status), createdAt: String(item.created_at) })),
      items: safeItems.map((item) => ({
        productName: String(item.product_name_snapshot),
        variantTitle: String(item.variant_title_snapshot),
        quantity: Number(item.quantity),
      })),
    },
  }
}
