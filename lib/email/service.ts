import 'server-only'

import { siteConfig } from '@/config/site'
import { createAdminClient } from '@/lib/supabase/admin'

export type EmailEventType = 'ORDER_CONFIRMATION' | 'ADMIN_NEW_ORDER' | 'ORDER_STATUS'
export type EmailNotificationStatus = 'PENDING' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED'

export type EmailOrderItem = {
  productName: string
  variantTitle: string
  sku: string
  quantity: number
  unitPrice: number
  compareAtPrice: number | null
  discountAmount: number
  lineTotal: number
  warrantyPolicy: string | null
}

export type EmailOrderSnapshot = {
  orderId: string
  orderNumber: string
  customerName: string
  customerEmail: string | null
  phone: string
  delivery: {
    division: string
    district: string
    area: string
    address: string
    postalCode: string | null
    notes: string | null
    charge: number
  }
  paymentMethod: string
  subtotal: number
  discountTotal: number
  grandTotal: number
  status: string
  createdAt: string
  items: EmailOrderItem[]
}

type NotificationRow = {
  id: string
  event_key: string
  status: EmailNotificationStatus
  attempt_count: number
  provider_message_id: string | null
}

type EmailPayload = {
  eventType: EmailEventType
  eventKey: string
  order: EmailOrderSnapshot
  recipient: string
  subject: string
  html: string
  text: string
}

const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [0, 500, 1500]

function env(name: string) {
  return process.env[name]?.trim() || ''
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function money(value: number) {
  return `${siteConfig.currency.symbol}${value.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(value))
}

function trackUrl(order: EmailOrderSnapshot) {
  return `${siteConfig.url}/track-order?order=${encodeURIComponent(order.orderNumber)}`
}

function adminOrderUrl(order: EmailOrderSnapshot) {
  return `${siteConfig.url}/admin/orders?order=${encodeURIComponent(order.orderId)}`
}

function layout(title: string, content: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f7f5;color:#17211b;font-family:Arial,Helvetica,sans-serif;line-height:1.5"><div style="max-width:640px;margin:0 auto;padding:24px 14px"><div style="background:#0f2f22;border-radius:16px 16px 0 0;padding:22px 24px;color:#fff"><div style="font-size:24px;font-weight:700">${escapeHtml(siteConfig.name)}</div><div style="font-size:13px;color:#bde5ce;margin-top:4px">${escapeHtml(siteConfig.tagline)}</div></div><main style="background:#fff;padding:28px 24px;border:1px solid #e2ebe5;border-top:0">${content}</main><footer style="padding:20px 12px;text-align:center;color:#65736a;font-size:12px">Need help? <a href="mailto:${escapeHtml(siteConfig.contact.supportEmail)}" style="color:#14734d">${escapeHtml(siteConfig.contact.supportEmail)}</a><br/>${escapeHtml(siteConfig.name)} · ${escapeHtml(siteConfig.location.address)}</footer></div></body></html>`
}

function orderItemsHtml(order: EmailOrderSnapshot) {
  return order.items.map((item) => `<tr><td style="padding:12px 0;border-bottom:1px solid #edf2ee"><strong>${escapeHtml(item.productName)}</strong><br/><span style="font-size:13px;color:#65736a">${escapeHtml(item.variantTitle)} · SKU ${escapeHtml(item.sku)} · Qty ${item.quantity}</span></td><td style="padding:12px 0;border-bottom:1px solid #edf2ee;text-align:right;white-space:nowrap">${money(item.lineTotal)}</td></tr>`).join('')
}

function orderItemsText(order: EmailOrderSnapshot) {
  return order.items.map((item) => `- ${item.productName} | ${item.variantTitle} | SKU ${item.sku} | Qty ${item.quantity} | ${money(item.lineTotal)}`).join('\n')
}

function customerConfirmation(order: EmailOrderSnapshot) {
  const subject = `SahiGadget order confirmed · ${order.orderNumber}`
  const text = `Order confirmed\n\nHello ${order.customerName},\n\nThank you for ordering from SahiGadget.\nOrder number: ${order.orderNumber}\nOrder date: ${formatDate(order.createdAt)}\nStatus: ${order.status}\n\nItems:\n${orderItemsText(order)}\n\nSubtotal: ${money(order.subtotal)}\nDiscount: ${money(order.discountTotal)}\nDelivery: ${money(order.delivery.charge)}\nGrand total: ${money(order.grandTotal)}\nPayment: ${order.paymentMethod}\n\nDelivery: ${order.delivery.address}, ${order.delivery.area}, ${order.delivery.district}, ${order.delivery.division}\nTrack your order: ${trackUrl(order)}\nSupport: ${siteConfig.contact.supportEmail}`
  const html = layout('Order confirmed', `<h1 style="margin:0 0 8px;font-size:26px">Order confirmed</h1><p style="margin:0 0 20px">Hello ${escapeHtml(order.customerName)}, thank you for ordering from SahiGadget.</p><div style="background:#eef8f1;border-radius:10px;padding:14px 16px;margin-bottom:22px"><strong>Order ${escapeHtml(order.orderNumber)}</strong><br/><span style="font-size:13px;color:#4d6054">${escapeHtml(formatDate(order.createdAt))} · ${escapeHtml(order.status)}</span></div><table role="presentation" style="width:100%;border-collapse:collapse">${orderItemsHtml(order)}</table><table role="presentation" style="width:100%;margin-top:18px;border-collapse:collapse"><tr><td>Subtotal</td><td style="text-align:right">${money(order.subtotal)}</td></tr><tr><td>Discount</td><td style="text-align:right">-${money(order.discountTotal)}</td></tr><tr><td>Delivery</td><td style="text-align:right">${money(order.delivery.charge)}</td></tr><tr><td style="padding-top:10px;font-size:18px"><strong>Total</strong></td><td style="padding-top:10px;text-align:right;font-size:18px"><strong>${money(order.grandTotal)}</strong></td></tr></table><p style="margin:24px 0 8px"><strong>Delivery information</strong><br/>${escapeHtml(order.delivery.address)}, ${escapeHtml(order.delivery.area)}, ${escapeHtml(order.delivery.district)}, ${escapeHtml(order.delivery.division)}${order.delivery.postalCode ? ` · ${escapeHtml(order.delivery.postalCode)}` : ''}</p><p>Payment method: <strong>${escapeHtml(order.paymentMethod)}</strong></p><p style="margin-top:24px"><a href="${escapeHtml(trackUrl(order))}" style="display:inline-block;background:#14734d;color:#fff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700">Track Order</a></p>`)
  return { subject, html, text }
}

function adminNewOrder(order: EmailOrderSnapshot) {
  const subject = `New SahiGadget order · ${order.orderNumber}`
  const text = `NEW ORDER\n\nOrder: ${order.orderNumber}\nDate: ${formatDate(order.createdAt)}\nCustomer: ${order.customerName}\nPhone: ${order.phone}\nEmail: ${order.customerEmail ?? 'Not provided'}\nAddress: ${order.delivery.address}, ${order.delivery.area}, ${order.delivery.district}, ${order.delivery.division}\n\nItems:\n${orderItemsText(order)}\n\nSubtotal: ${money(order.subtotal)}\nDiscount: ${money(order.discountTotal)}\nDelivery: ${money(order.delivery.charge)}\nTotal: ${money(order.grandTotal)}\nPayment: ${order.paymentMethod}\nStatus: ${order.status}\nAdmin panel: ${adminOrderUrl(order)}`
  const html = layout('New order', `<h1 style="margin:0 0 8px;font-size:26px">New order received</h1><p style="margin:0 0 20px">A new COD order has been created and requires operational review.</p><div style="background:#fff7e6;border-radius:10px;padding:14px 16px;margin-bottom:22px"><strong>${escapeHtml(order.orderNumber)}</strong><br/><span style="font-size:13px;color:#6b5a3d">${escapeHtml(formatDate(order.createdAt))} · ${escapeHtml(order.status)}</span></div><p><strong>Customer</strong><br/>${escapeHtml(order.customerName)}<br/>${escapeHtml(order.phone)}<br/>${escapeHtml(order.customerEmail ?? 'No email provided')}</p><p><strong>Delivery</strong><br/>${escapeHtml(order.delivery.address)}, ${escapeHtml(order.delivery.area)}, ${escapeHtml(order.delivery.district)}, ${escapeHtml(order.delivery.division)}</p><table role="presentation" style="width:100%;border-collapse:collapse">${orderItemsHtml(order)}</table><p style="margin-top:20px"><strong>Total: ${money(order.grandTotal)}</strong><br/>Payment: ${escapeHtml(order.paymentMethod)}</p><p style="margin-top:24px"><a href="${escapeHtml(adminOrderUrl(order))}" style="display:inline-block;background:#14734d;color:#fff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700">Open Admin Panel</a></p>`)
  return { subject, html, text }
}

const CUSTOMER_STATUS_EMAILS = new Set(['CONFIRMED', 'PROCESSING', 'DELIVERED', 'CANCELLED'])

function statusCopy(status: string) {
  switch (status) {
    case 'CONFIRMED':
      return { subject: 'Your SahiGadget order is confirmed', heading: 'Order confirmed', explanation: 'Your order has been confirmed and is now moving into the fulfilment process.' }
    case 'PROCESSING':
      return { subject: 'Your SahiGadget order is being prepared', heading: 'Order being prepared', explanation: 'Your order is being prepared by our team. We will continue to update you as it moves through fulfilment.' }
    case 'DELIVERED':
      return { subject: 'Your SahiGadget order has been delivered', heading: 'Order delivered', explanation: 'Your order has been marked as delivered. If you need any help after delivery, our support team is available.' }
    case 'CANCELLED':
      return { subject: 'Your SahiGadget order has been cancelled', heading: 'Order cancelled', explanation: 'Your order has been marked as cancelled. No cancellation reason is included unless it was explicitly recorded in the order data.' }
    default:
      return null
  }
}

function statusEmail(order: EmailOrderSnapshot) {
  const copy = statusCopy(order.status)
  if (!copy) throw new Error(`Unsupported customer-facing status: ${order.status}`)
  const subject = `${copy.subject} · ${order.orderNumber}`
  const delivery = `${order.delivery.address}, ${order.delivery.area}, ${order.delivery.district}, ${order.delivery.division}`
  const text = `${copy.heading}\n\nHello ${order.customerName},\n\n${copy.explanation}\n\nOrder number: ${order.orderNumber}\nCurrent status: ${order.status}\n\nItems:\n${orderItemsText(order)}\n\nTotal: ${money(order.grandTotal)}\nDelivery: ${delivery}\n\nTrack your order: ${trackUrl(order)}\nSupport: ${siteConfig.contact.supportEmail}`
  const html = layout(copy.heading, `<h1 style="margin:0 0 8px;font-size:26px">${escapeHtml(copy.heading)}</h1><p>Hello ${escapeHtml(order.customerName)},</p><p>${escapeHtml(copy.explanation)}</p><div style="background:#eef8f1;border-radius:10px;padding:16px;margin:22px 0"><strong>Order ${escapeHtml(order.orderNumber)}</strong><br/><span style="font-size:20px;color:#14734d">${escapeHtml(order.status)}</span></div><h2 style="font-size:16px;margin:24px 0 8px">Order summary</h2><table role="presentation" style="width:100%;border-collapse:collapse">${orderItemsHtml(order)}</table><p style="margin:18px 0"><strong>Total: ${money(order.grandTotal)}</strong></p><p><strong>Delivery information</strong><br/>${escapeHtml(delivery)}</p><p style="margin-top:24px"><a href="${escapeHtml(trackUrl(order))}" style="display:inline-block;background:#14734d;color:#fff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700">Track Order</a></p>`)
  return { subject, html, text }
}

function templateFor(eventType: EmailEventType, order: EmailOrderSnapshot, recipient: string, eventKey: string): EmailPayload {
  const content = eventType === 'ORDER_CONFIRMATION' ? customerConfirmation(order) : eventType === 'ADMIN_NEW_ORDER' ? adminNewOrder(order) : statusEmail(order)
  return { eventType, eventKey, order, recipient, ...content }
}

async function recordNotification(payload: EmailPayload) {
  const admin = createAdminClient()
  const existing = await admin.from('email_notifications').select('id,event_key,status,attempt_count,provider_message_id').eq('event_key', payload.eventKey).maybeSingle()
  if (existing.error) throw new Error(`Unable to read email notification: ${existing.error.message}`)
  if (existing.data) return existing.data as NotificationRow
  const created = await admin.from('email_notifications').insert({ order_id: payload.order.orderId, event_key: payload.eventKey, event_type: payload.eventType, recipient: payload.recipient, status: 'PENDING', metadata: { order_number: payload.order.orderNumber, status: payload.order.status } }).select('id,event_key,status,attempt_count,provider_message_id').single()
  if (!created.error && created.data) return created.data as NotificationRow
  if (created.error?.code === '23505') {
    const raced = await admin.from('email_notifications').select('id,event_key,status,attempt_count,provider_message_id').eq('event_key', payload.eventKey).maybeSingle()
    if (!raced.error && raced.data) return raced.data as NotificationRow
  }
  throw new Error(`Unable to record email notification: ${created.error?.message ?? 'unknown error'}`)
}

async function updateNotification(id: string, values: Record<string, unknown>) {
  const admin = createAdminClient()
  await admin.from('email_notifications').update(values).eq('id', id)
}

async function sendWithResend(payload: EmailPayload) {
  const apiKey = env('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.')
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': payload.eventKey }, body: JSON.stringify({ from: payload.eventType === 'ADMIN_NEW_ORDER' ? siteConfig.email.sender : siteConfig.email.sender, to: [payload.recipient], reply_to: siteConfig.email.replyTo, subject: payload.subject, html: payload.html, text: payload.text, tags: [{ name: 'event_type', value: payload.eventType }, { name: 'order_number', value: payload.order.orderNumber }] }) })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Resend ${response.status}: ${body.slice(0, 400)}`)
  }
  const result = await response.json() as { id?: string }
  if (!result.id) throw new Error('Resend accepted the request without a provider message ID.')
  return result.id
}

export async function sendTransactionalEmail(payload: EmailPayload) {
  const notification = await recordNotification(payload)
  if (['SENT', 'DELIVERED'].includes(notification.status)) return { ok: true as const, status: notification.status, providerMessageId: notification.provider_message_id }
  if (notification.attempt_count >= MAX_ATTEMPTS) return { ok: false as const, status: 'FAILED' as const, error: 'Maximum email attempts reached.' }

  let lastError = 'Email delivery failed.'
  for (let attempt = notification.attempt_count; attempt < MAX_ATTEMPTS; attempt += 1) {
    const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS.at(-1) ?? 0
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    await updateNotification(notification.id, { status: 'SENDING', attempt_count: attempt + 1, last_error: null })
    try {
      const providerMessageId = await sendWithResend(payload)
      await updateNotification(notification.id, { status: 'SENT', provider_message_id: providerMessageId, sent_at: new Date().toISOString(), last_error: null })
      return { ok: true as const, status: 'SENT' as const, providerMessageId }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Email delivery failed.'
      await updateNotification(notification.id, { status: 'FAILED', failed_at: new Date().toISOString(), last_error: lastError })
    }
  }
  return { ok: false as const, status: 'FAILED' as const, error: lastError }
}

export async function loadOrderForEmail(orderId: string): Promise<EmailOrderSnapshot> {
  const admin = createAdminClient()
  const [{ data: order, error: orderError }, { data: items, error: itemsError }] = await Promise.all([
    admin.from('orders').select('id,order_number,order_status,created_at,subtotal,discount_total,delivery_charge,grand_total,payment_method,customer_name_snapshot,customer_phone_snapshot,customer_email_snapshot,shipping_division,shipping_district,shipping_area,shipping_address,shipping_postal_code,notes').eq('id', orderId).maybeSingle(),
    admin.from('order_items').select('product_name_snapshot,variant_title_snapshot,sku,quantity,unit_price,compare_at_price_snapshot,discount_amount,line_total,warranty_policy_snapshot').eq('order_id', orderId).order('created_at'),
  ])
  if (orderError || itemsError || !order) throw new Error('Unable to load the order snapshot for email delivery.')
  const row = order as unknown as Record<string, unknown>
  return {
    orderId: String(row.id), orderNumber: String(row.order_number), customerName: String(row.customer_name_snapshot), customerEmail: row.customer_email_snapshot ? String(row.customer_email_snapshot) : null, phone: String(row.customer_phone_snapshot),
    delivery: { division: String(row.shipping_division ?? ''), district: String(row.shipping_district ?? ''), area: String(row.shipping_area ?? ''), address: String(row.shipping_address ?? ''), postalCode: row.shipping_postal_code ? String(row.shipping_postal_code) : null, notes: row.notes ? String(row.notes) : null, charge: Number(row.delivery_charge) },
    paymentMethod: String(row.payment_method ?? 'COD'), subtotal: Number(row.subtotal), discountTotal: Number(row.discount_total), grandTotal: Number(row.grand_total), status: String(row.order_status), createdAt: String(row.created_at),
    items: ((items ?? []) as Array<Record<string, unknown>>).map((item) => ({ productName: String(item.product_name_snapshot), variantTitle: String(item.variant_title_snapshot), sku: String(item.sku), quantity: Number(item.quantity), unitPrice: Number(item.unit_price), compareAtPrice: item.compare_at_price_snapshot === null ? null : Number(item.compare_at_price_snapshot), discountAmount: Number(item.discount_amount ?? 0), lineTotal: Number(item.line_total), warrantyPolicy: item.warranty_policy_snapshot ? String(item.warranty_policy_snapshot) : null })),
  }
}

export async function latestStatusTransitionId(orderId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('order_status_history').select('id').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data?.id ? String(data.id) : `${orderId}-${Date.now()}`
}

export async function queueOrderConfirmationEmails(order: EmailOrderSnapshot) {
  const results = []
  if (order.customerEmail) results.push(await sendTransactionalEmail(templateFor('ORDER_CONFIRMATION', order, order.customerEmail, `order-confirmation/${order.orderId}`)))
  if (siteConfig.contact.adminEmail) results.push(await sendTransactionalEmail(templateFor('ADMIN_NEW_ORDER', order, siteConfig.contact.adminEmail, `admin-new-order/${order.orderId}`)))
  return results
}

export async function queueOrderStatusEmail(order: EmailOrderSnapshot, transitionId: string) {
  if (!order.customerEmail || !CUSTOMER_STATUS_EMAILS.has(order.status)) return { ok: true as const, skipped: true as const }
  return sendTransactionalEmail(templateFor('ORDER_STATUS', order, order.customerEmail, `order-status/${order.orderId}/${transitionId}/${order.status}`))
}

export async function getNotificationByProviderMessageId(providerMessageId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('email_notifications').select('id,status,provider_message_id').eq('provider_message_id', providerMessageId).maybeSingle()
  return data as { id: string; status: EmailNotificationStatus; provider_message_id: string } | null
}

export async function updateNotificationDelivery(id: string, status: Extract<EmailNotificationStatus, 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED'>) {
  const now = new Date().toISOString()
  const values: Record<string, unknown> = { status }
  if (status === 'DELIVERED') values.delivered_at = now
  if (status === 'FAILED') values.failed_at = now
  if (status === 'BOUNCED') values.bounced_at = now
  await updateNotification(id, values)
}
