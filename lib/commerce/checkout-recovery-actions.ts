'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin/auth'
import { isValidBangladeshMobile, normalizePhone } from '@/lib/orders/phone'
import { getStorefrontSettings } from '@/lib/services/storefront'
import { getCart } from '@/lib/commerce/cart'
import { createGuestOrderWithRisk } from '@/lib/orders/actions'

const draftSchema = z.object({
  checkoutRequestId: z.string().uuid(),
  recoveryToken: z.string().min(32).max(128),
  source: z.enum(['QUICK_ORDER', 'CART', 'LANDING_PAGE']),
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(10).optional(),
  fullName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  division: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  area: z.string().trim().max(100).optional(),
  address: z.string().trim().max(500).optional(),
  recoveryConsent: z.boolean().optional().default(false),
  cartItems: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid(), quantity: z.number().int().min(1).max(10) })).max(30).optional(),
}).strict()

function hashToken(token: string) { return createHash('sha256').update(token).digest('hex') }
function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, 'hex'); const right = Buffer.from(b, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}
function cleanText(value: string | undefined, max: number) { return value?.trim().slice(0, max) || null }

async function authoritativeItems(db: ReturnType<typeof createAdminClient>, input: z.infer<typeof draftSchema>) {
  const cart = input.source === 'CART' ? await getCart() : null
  const requested = input.source === 'CART'
    ? (cart?.items ?? []).map((item) => ({ productId: item.product_id, variantId: item.variant_id, quantity: item.quantity }))
    : input.productId && input.variantId ? [{ productId: input.productId, variantId: input.variantId, quantity: input.quantity ?? 1 }] : []
  if (!requested.length) return []
  const productIds = [...new Set(requested.map((item) => item.productId))]
  const variantIds = [...new Set(requested.map((item) => item.variantId))]
  const [{ data: products, error: pError }, { data: variants, error: vError }] = await Promise.all([
    db.from('products').select('id,name,is_published,product_type').in('id', productIds),
    db.from('product_variants').select('id,product_id,sku,variant_title,color,price,compare_at_price,stock_quantity,is_active').in('id', variantIds),
  ])
  if (pError || vError || !products || !variants) throw new Error('DRAFT_CATALOG_LOOKUP_FAILED')
  const productMap = new Map(products.map((p) => [p.id, p]))
  const variantMap = new Map(variants.map((v) => [v.id, v]))
  return requested.map((item) => {
    const p = productMap.get(item.productId); const v = variantMap.get(item.variantId)
    if (!p || !v || v.product_id !== p.id || p.is_published !== true || v.is_active !== true) throw new Error('DRAFT_ITEM_UNAVAILABLE')
    return { product_id: p.id, product_name: p.name, variant_id: v.id, sku: v.sku, variant_title: v.variant_title, color: v.color, quantity: item.quantity, unit_price_snapshot: Number(v.price), compare_at_price_snapshot: v.compare_at_price == null ? null : Number(v.compare_at_price), stock_at_save: Number(v.stock_quantity) }
  })
}

export async function saveCheckoutRecoveryDraft(raw: unknown) {
  const parsed = draftSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, message: 'Draft details could not be saved.' }
  const input = parsed.data
  const db = createAdminClient()
  try {
    const items = await authoritativeItems(db, input)
    const cart = input.source === 'CART' ? await getCart() : null
    if (input.source === 'CART' && (!cart?.id || !items.length)) return { ok: false as const, message: 'Your cart is empty.' }
    const phone = input.phone && isValidBangladeshMobile(input.phone) ? normalizePhone(input.phone) : null
    const name = cleanText(input.fullName, 120)
    const now = new Date().toISOString()
    const { data: existing, error: findError } = await db.from('checkout_sessions').select('id,status,recovery_token_hash,recovery_consent_at,recovery_consent_withdrawn_at,quote_snapshot,delivery_snapshot').eq('checkout_request_id', input.checkoutRequestId).maybeSingle()
    if (findError) throw findError
    const tokenHash = hashToken(input.recoveryToken)
    if (existing?.recovery_token_hash && !safeEqualHex(existing.recovery_token_hash, tokenHash)) return { ok: false as const, message: 'Checkout draft session has changed. Continue checkout to refresh it.' }
    if (existing && ['COMPLETED', 'PAYMENT_INITIATED'].includes(existing.status)) return { ok: true as const, saved: false as const }
    const { data: linkedOrders, error: orderLookupError } = await db.from('orders').select('id').eq('checkout_request_id', input.checkoutRequestId).limit(1)
    if (orderLookupError) throw orderLookupError
    if (linkedOrders?.length) return { ok: true as const, saved: false as const }
    const priorQuote = (existing?.quote_snapshot && typeof existing.quote_snapshot === 'object') ? existing.quote_snapshot as Record<string, unknown> : {}
    const delivery = {
      division: cleanText(input.division, 80), district: cleanText(input.district, 80),
      area: cleanText(input.area, 100), address: cleanText(input.address, 500),
    }
    const consentAt = input.recoveryConsent ? (existing?.recovery_consent_at ?? now) : existing?.recovery_consent_at ?? null
    const settings = input.division ? await getStorefrontSettings() : null
    const deliveryZone = input.division ? (input.division.toLowerCase() === 'dhaka' ? 'dhaka' : 'outside_dhaka') : null
    const deliveryCharge = settings && deliveryZone
      ? Number(deliveryZone === 'dhaka' ? settings.delivery.dhakaCharge : settings.delivery.outsideDhakaCharge)
      : null
    const subtotalSnapshot = items.reduce((sum, item) => sum + item.unit_price_snapshot * item.quantity, 0)
    const discountSnapshot = items.reduce((sum, item) => sum + Math.max((item.compare_at_price_snapshot ?? item.unit_price_snapshot) - item.unit_price_snapshot, 0) * item.quantity, 0)
    const payload = {
      checkout_request_id: input.checkoutRequestId, source: input.source, cart_id: cart?.id || undefined,
      status: existing?.status === 'QUOTED' ? 'QUOTED' : (Object.keys(delivery).some((key) => delivery[key as keyof typeof delivery]) ? 'DETAILS_ENTERED' : (existing?.status === 'ABANDONED' ? 'STARTED' : existing?.status ?? 'STARTED')),
      customer_name: name, customer_phone: phone, customer_email: cleanText(input.email, 254),
      recovery_token_hash: tokenHash, recovery_consent_at: consentAt,
      recovery_consent_withdrawn_at: input.recoveryConsent ? null : (existing?.recovery_consent_at ? now : existing?.recovery_consent_withdrawn_at ?? null),
      quote_snapshot: { ...priorQuote, items, item_count: items.reduce((sum, item) => sum + item.quantity, 0), subtotal_snapshot: subtotalSnapshot, discount_snapshot: discountSnapshot, delivery_zone: deliveryZone, delivery_charge_snapshot: Number.isFinite(deliveryCharge) ? deliveryCharge : null, grand_total_snapshot: Number.isFinite(deliveryCharge) ? subtotalSnapshot + deliveryCharge! : null, draft_saved_at: now },
      delivery_snapshot: delivery, last_activity_at: now, expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), updated_at: now,
    }
    if (existing) {
      const updateResult = existing.recovery_token_hash
        ? await db.from('checkout_sessions').update(payload).eq('checkout_request_id', input.checkoutRequestId).eq('recovery_token_hash', tokenHash).not('status', 'in', '(COMPLETED,PAYMENT_INITIATED)').select('id').maybeSingle()
        : await db.from('checkout_sessions').update(payload).eq('checkout_request_id', input.checkoutRequestId).is('recovery_token_hash', null).not('status', 'in', '(COMPLETED,PAYMENT_INITIATED)').select('id').maybeSingle()
      if (updateResult.error) throw updateResult.error
      if (!updateResult.data) return { ok: true as const, saved: false as const }
    } else {
      const { error } = await db.from('checkout_sessions').insert(payload)
      if (error && !String(error.message).includes('duplicate key')) throw error
      if (error) return { ok: false as const, message: 'Checkout draft could not be saved.' }
    }
    if ((input.recoveryConsent && !existing?.recovery_consent_at) || (!input.recoveryConsent && existing?.recovery_consent_at && !existing?.recovery_consent_withdrawn_at)) {
      const { data: row } = await db.from('checkout_sessions').select('id').eq('checkout_request_id', input.checkoutRequestId).maybeSingle()
      if (row?.id) await db.from('checkout_recovery_history').insert({ checkout_session_id: row.id, action: input.recoveryConsent ? 'CONSENT_GRANTED' : 'CONSENT_WITHDRAWN' })
    }
    return { ok: true as const, saved: true as const }
  } catch (error) {
    console.error('[checkout-recovery] draft save failed', error instanceof Error ? error.message : 'unknown')
    return { ok: false as const, message: 'Draft details could not be saved.' }
  }
}

export async function listCheckoutRecovery(input: { page?: number; status?: string; q?: string } = {}) {
  await requireAdmin()
  const db = createAdminClient()
  const page = Math.max(1, Math.min(1000, Math.floor(input.page ?? 1)))
  const from = (page - 1) * 25
  let query = db.from('checkout_sessions')
    .select('id,checkout_request_id,source,status,customer_name,customer_phone,customer_email,quote_snapshot,delivery_snapshot,last_activity_at,created_at,expires_at,recovery_consent_at,recovery_consent_withdrawn_at,recovery_contact_count,recovery_last_contacted_at,recovery_outcome,recovery_outcome_at,completed_order_id', { count: 'exact' })
    // This page is for unresolved, actionable checkouts only. Keep order history in Orders.
    .in('status', ['STARTED', 'DETAILS_ENTERED', 'QUOTED', 'ABANDONED'])
    .is('completed_order_id', null)
    .not('customer_phone', 'is', null)
    .or('recovery_outcome.is.null,recovery_outcome.not.in.(CLOSED,NOT_INTERESTED,RECOVERED)')
    .order('last_activity_at', { ascending: false })
    .range(from, from + 24)
  if (input.status && ['STARTED','DETAILS_ENTERED','QUOTED','ABANDONED'].includes(input.status)) query = query.eq('status', input.status)
  if (input.q?.trim()) {
    const q = input.q.trim().replace(/[,%()]/g, '').slice(0, 80)
    if (q) query = query.or('customer_name.ilike.%' + q + '%,customer_phone.ilike.%' + q + '%')
  }
  const { data, error, count } = await query
  if (error) throw new Error('Unable to load checkout recovery.')
  const rows = data ?? []
  const ids = rows.map((row) => row.id)
  const historyResult = ids.length
    ? await db.from('checkout_recovery_history').select('id,checkout_session_id,action,notes,created_at,linked_order_id').in('checkout_session_id', ids).order('created_at', { ascending: false }).limit(100)
    : { data: [], error: null }
  if (historyResult.error) throw new Error('Unable to load checkout recovery history.')
  const historyBySession = new Map<string, typeof historyResult.data>()
  for (const item of historyResult.data ?? []) historyBySession.set(item.checkout_session_id, [...(historyBySession.get(item.checkout_session_id) ?? []), item])
  return { rows: rows.map((row) => ({ ...row, history: historyBySession.get(row.id) ?? [] })), count: count ?? 0, page, pageSize: 25 }
}

const outcomeSchema = z.object({ sessionId: z.string().uuid(), outcome: z.enum(['CONTACTED','RECOVERED','NOT_INTERESTED','CLOSED']), notes: z.string().trim().max(500).optional(), orderId: z.string().uuid().optional() })
export async function updateCheckoutRecoveryOutcome(raw: unknown) {
  const admin = await requireAdmin()
  const parsed = outcomeSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, message: 'Invalid recovery update.' }
  const db = createAdminClient()
  const { data: session, error } = await db.from('checkout_sessions').select('id,checkout_request_id,status,customer_phone,recovery_consent_at,recovery_consent_withdrawn_at,recovery_contact_count,recovery_last_contacted_at,completed_order_id,expires_at').eq('id', parsed.data.sessionId).maybeSingle()
  if (error || !session) return { ok: false as const, message: 'Checkout session not found.' }
  const action = parsed.data.outcome
  if (action === 'CONTACTED') {
    if (!session.customer_phone || !session.recovery_consent_at || session.recovery_consent_withdrawn_at || !['STARTED', 'DETAILS_ENTERED', 'QUOTED', 'ABANDONED'].includes(session.status) || session.completed_order_id || new Date(session.expires_at).getTime() <= Date.now() || Number(session.recovery_contact_count) >= 2) return { ok: false as const, message: 'This checkout is not eligible for recovery contact.' }
    const { data: orders, error: orderLookupError } = await db.from('orders').select('id').eq('checkout_request_id', session.checkout_request_id).limit(1)
    if (orderLookupError) return { ok: false as const, message: 'Unable to verify this checkout. Refresh and try again.' }
    if (orders?.length) return { ok: false as const, message: 'An existing order makes this checkout ineligible.' }
    const { data: contactUpdated, error: updateError } = await db.from('checkout_sessions').update({ recovery_contact_count: Number(session.recovery_contact_count) + 1, recovery_last_contacted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', session.id).eq('status', 'ABANDONED').eq('recovery_contact_count', Number(session.recovery_contact_count)).lt('recovery_contact_count', 2).select('id').maybeSingle()
    if (updateError) throw new Error('Unable to update recovery contact history.')
    if (!contactUpdated) return { ok: false as const, message: 'Another admin updated this checkout. Refresh and try again.' }
  } else if (action === 'RECOVERED') {
    if (!parsed.data.orderId) return { ok: false as const, message: 'Link the recovered order before marking recovered.' }
    const { data: order } = await db.from('orders').select('id,checkout_request_id').eq('id', parsed.data.orderId).maybeSingle()
    if (!order || order.checkout_request_id !== session.checkout_request_id) return { ok: false as const, message: 'Order does not belong to this checkout.' }
    await db.from('checkout_sessions').update({ recovery_outcome: action, recovery_outcome_at: new Date().toISOString(), completed_order_id: order.id, status: 'COMPLETED', updated_at: new Date().toISOString() }).eq('id', session.id).neq('status', 'COMPLETED')
  } else {
    await db.from('checkout_sessions').update({ recovery_outcome: action, recovery_outcome_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', session.id).neq('status', 'COMPLETED')
  }
  const { error: historyError } = await db.from('checkout_recovery_history').insert({ checkout_session_id: session.id, actor_admin_user_id: admin.id, action: action === 'CONTACTED' ? 'WHATSAPP_OPENED' : action, notes: parsed.data.notes ?? null, linked_order_id: parsed.data.orderId ?? null })
  if (historyError) throw new Error('Recovery outcome could not be recorded.')
  return { ok: true as const }
}


const deleteRecoverySchema = z.object({ sessionId: z.string().uuid() })

/** Permanently deletes an unresolved checkout and its recovery history; completed orders are never deleted here. */
export async function permanentlyDeleteCheckoutRecovery(raw: unknown) {
  const admin = await requireAdmin(['OWNER', 'ADMIN'])
  const parsed = deleteRecoverySchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, message: 'Invalid checkout reference.' }
  const db = createAdminClient()
  const { data: session, error: lookupError } = await db.from('checkout_sessions')
    .select('id,status,completed_order_id,checkout_request_id')
    .eq('id', parsed.data.sessionId).maybeSingle()
  if (lookupError || !session) return { ok: false as const, message: 'Incomplete checkout not found. Refresh the page.' }
  if (session.completed_order_id || ['COMPLETED', 'PAYMENT_INITIATED'].includes(session.status)) {
    return { ok: false as const, message: 'This checkout is linked to an order or payment flow and cannot be deleted from recovery.' }
  }
  const { data: linkedOrders, error: orderLookupError } = await db.from('orders').select('id').eq('checkout_request_id', session.checkout_request_id).limit(1)
  if (orderLookupError) return { ok: false as const, message: 'Unable to verify linked orders. Refresh and try again.' }
  if (linkedOrders?.length) return { ok: false as const, message: 'An order already exists for this checkout and cannot be deleted from recovery.' }
  const firstDelete = await db.from('checkout_sessions').delete().eq('id', session.id).is('completed_order_id', null).neq('status', 'PAYMENT_INITIATED').select('id').maybeSingle()
  if (firstDelete.error) {
    // If history has a restrictive foreign key, remove its child records and retry the session deletion.
    const historyDelete = await db.from('checkout_recovery_history').delete().eq('checkout_session_id', session.id)
    if (historyDelete.error) return { ok: false as const, message: 'Unable to permanently delete checkout history. Nothing else was changed.' }
    const retry = await db.from('checkout_sessions').delete().eq('id', session.id).is('completed_order_id', null).select('id').maybeSingle()
    if (retry.error || !retry.data) return { ok: false as const, message: 'Checkout could not be deleted. Refresh and try again.' }
  } else if (!firstDelete.data) {
    return { ok: false as const, message: 'Checkout changed or was already deleted. Refresh the list.' }
  }
  // Remove any history left behind if the foreign key did not cascade.
  const cleanup = await db.from('checkout_recovery_history').delete().eq('checkout_session_id', session.id)
  if (cleanup.error) console.error('[checkout-recovery] deleted session but history cleanup failed', { actor: admin.id, sessionId: session.id })
  revalidatePath('/admin/checkout-recovery')
  return { ok: true as const, message: 'Incomplete checkout permanently deleted.' }
}


const convertSchema = z.object({
  sessionId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(32),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  division: z.string().trim().min(1).max(80),
  district: z.string().trim().min(1).max(80),
  area: z.string().trim().min(1).max(100),
  address: z.string().trim().min(3).max(500),
  postalCode: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(500).optional(),
}).strict()

/** Creates a normal COD order through the same stock-safe, idempotent database transaction used by guest checkout. */
export async function createOrderFromIncompleteCheckout(raw: unknown) {
  const admin = await requireAdmin(['OWNER', 'ADMIN'])
  const parsed = convertSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, message: 'Check the customer, delivery, and product details.' }
  const input = parsed.data
  if (!isValidBangladeshMobile(input.phone)) return { ok: false as const, message: 'Enter a valid Bangladesh mobile number.' }
  const phone = normalizePhone(input.phone)
  const db = createAdminClient()
  const { data: session, error: sessionError } = await db.from('checkout_sessions')
    .select('id,checkout_request_id,status,source,completed_order_id,recovery_outcome,quote_snapshot,delivery_snapshot')
    .eq('id', input.sessionId).maybeSingle()
  if (sessionError || !session) return { ok: false as const, message: 'Incomplete checkout not found. Refresh the page.' }
  if (session.completed_order_id || session.status === 'COMPLETED') {
    return { ok: false as const, message: 'This checkout is already linked to an order.' }
  }
  if (session.status === 'PAYMENT_INITIATED') {
    return { ok: false as const, message: 'Payment has already been initiated for this checkout. Do not create another order; refresh the recovery list and review the existing payment workflow.' }
  }
  if (['CLOSED', 'NOT_INTERESTED', 'RECOVERED'].includes(String(session.recovery_outcome ?? ''))) {
    return { ok: false as const, message: 'This checkout is closed or already resolved. Reopen it through the recovery process before converting.' }
  }
  if (session.source === 'CART') return { ok: false as const, message: 'Cart recovery conversion is not enabled for multi-item checkouts yet. Create the order through the regular checkout to preserve cart pricing and stock rules.' }
  const quote = session.quote_snapshot && typeof session.quote_snapshot === 'object' ? session.quote_snapshot as Record<string, unknown> : {}
  const savedItems = Array.isArray(quote.items) ? quote.items as Array<Record<string, unknown>> : []
  if (!savedItems.some((item) => item.product_id === input.productId)) {
    return { ok: false as const, message: 'Choose the product saved in this checkout.' }
  }
  const { data: chosenVariant, error: variantError } = await db.from('product_variants').select('id,product_id,is_active').eq('id', input.variantId).maybeSingle()
  if (variantError || !chosenVariant || chosenVariant.product_id !== input.productId || chosenVariant.is_active !== true) {
    return { ok: false as const, message: 'Choose an active variant of the saved product.' }
  }
  const checkoutRequestId = session.checkout_request_id
  if (!checkoutRequestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkoutRequestId)) {
    return { ok: false as const, message: 'Checkout reference is invalid. Refresh and try again.' }
  }
  const { data: preexistingOrders, error: existingOrderError } = await db.from('orders').select('id,order_number').eq('checkout_request_id', checkoutRequestId).limit(1)
  if (existingOrderError) return { ok: false as const, message: 'Unable to verify whether an order already exists. Refresh and try again.' }
  if (preexistingOrders?.length) {
    const existingOrder = preexistingOrders[0]
    const now = new Date().toISOString()
    const { error: syncError } = await db.from('checkout_sessions').update({
      status: 'COMPLETED', completed_order_id: existingOrder.id, recovery_outcome: 'RECOVERED',
      recovery_outcome_at: now, updated_at: now,
    }).eq('id', session.id).neq('status', 'COMPLETED')
    if (syncError) return { ok: false as const, message: 'An order already exists but recovery could not be synced. Do not create another order; refresh and contact support if it remains visible.' }
    const { error: historyError } = await db.from('checkout_recovery_history').insert({
      checkout_session_id: session.id, actor_admin_user_id: admin.id, action: 'RECOVERED',
      notes: 'Existing order linked to checkout recovery; no duplicate order created.', linked_order_id: existingOrder.id,
    })
    if (historyError) console.error('[checkout-recovery] existing order sync history write failed', historyError.message)
    revalidatePath('/admin/checkout-recovery')
    revalidatePath('/admin/orders')
    return { ok: true as const, orderId: existingOrder.id, orderNumber: existingOrder.order_number, message: 'Existing order linked and moved to Orders. No duplicate order was created.' }
  }
  const notes = [input.notes?.trim(), 'Converted from incomplete checkout.'].filter(Boolean).join('\n')
  const orderResult = await createGuestOrderWithRisk({
    productId: input.productId,
    variantId: input.variantId,
    quantity: input.quantity,
    checkoutRequestId,
    checkoutSource: 'LANDING_PAGE',
    fullName: input.fullName.trim(),
    phone,
    email: input.email?.trim() || '',
    division: input.division.trim(),
    district: input.district.trim(),
    area: input.area.trim(),
    address: input.address.trim(),
    postalCode: input.postalCode?.trim() || '',
    notes,
    analyticsConsent: false,
    marketingConsent: false,
  })
  if (!orderResult.ok) return { ok: false as const, message: orderResult.message || 'Order could not be created. No recovery status was changed.' }
  if ('paymentRequired' in orderResult.data) {
    const orderId = String(orderResult.data.orderId)
    const now = new Date().toISOString()
    const { error: updateError } = await db.from('checkout_sessions').update({
      status: 'COMPLETED', completed_order_id: orderId, recovery_outcome: 'RECOVERED',
      recovery_outcome_at: now, updated_at: now,
    }).eq('id', session.id).neq('status', 'COMPLETED')
    if (updateError) console.error('[checkout-recovery] payment-required order created but recovery link update failed', updateError.message)
    const { error: historyError } = await db.from('checkout_recovery_history').insert({
      checkout_session_id: session.id, actor_admin_user_id: admin.id, action: 'RECOVERED',
      notes: 'Order created from incomplete checkout; advance payment is pending.', linked_order_id: orderId,
    })
    if (historyError) console.error('[checkout-recovery] payment-required conversion history write failed', historyError.message)
    revalidatePath('/admin/checkout-recovery')
    revalidatePath('/admin/orders')
    return {
      ok: true as const,
      orderId,
      orderNumber: String(orderResult.data.orderNumber ?? ''),
      paymentRequired: true as const,
      redirectUrl: orderResult.data.redirectUrl,
      message: 'Order created and moved to Orders. Store risk policy requires advance payment; share the secure payment link with the customer.',
    }
  }
  const orderId = String(orderResult.data.orderId)
  const now = new Date().toISOString()
  const { error: updateError } = await db.from('checkout_sessions').update({
    status: 'COMPLETED', completed_order_id: orderId, recovery_outcome: 'RECOVERED',
    recovery_outcome_at: now, updated_at: now,
  }).eq('id', session.id).neq('status', 'COMPLETED')
  if (updateError) {
    // The order RPC is idempotent by checkout_request_id; retrying conversion will return the same order.
    console.error('[checkout-recovery] order created but session update failed', updateError.message)
    return { ok: false as const, message: 'Order was created, but recovery status needs refresh. The same checkout reference prevents duplicate orders.' }
  }
  const { error: historyError } = await db.from('checkout_recovery_history').insert({
    checkout_session_id: session.id, actor_admin_user_id: admin.id, action: 'RECOVERED',
    notes: 'Order created from incomplete checkout by admin.', linked_order_id: orderId,
  })
  if (historyError) console.error('[checkout-recovery] conversion history write failed', historyError.message)
  revalidatePath('/admin/checkout-recovery')
  revalidatePath('/admin/orders')
  return { ok: true as const, orderId, orderNumber: String(orderResult.data.orderNumber ?? ''), message: 'Order created using the standard checkout and risk-policy transaction.' }
}


export async function getRecoveryProductVariants(sessionId: string) {
  await requireAdmin(['OWNER', 'ADMIN'])
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) return { ok: false as const, message: 'Invalid checkout reference.', variants: [] }
  const db = createAdminClient()
  const { data: session, error } = await db.from('checkout_sessions').select('quote_snapshot').eq('id', sessionId).maybeSingle()
  if (error || !session) return { ok: false as const, message: 'Checkout session not found.', variants: [] }
  const quote = session.quote_snapshot && typeof session.quote_snapshot === 'object' ? session.quote_snapshot as Record<string, unknown> : {}
  const items = Array.isArray(quote.items) ? quote.items as Array<Record<string, unknown>> : []
  const productId = typeof items[0]?.product_id === 'string' ? items[0].product_id : ''
  if (!productId) return { ok: false as const, message: 'Saved product details are unavailable.', variants: [] }
  const { data: variants, error: variantsError } = await db.from('product_variants')
    .select('id,product_id,variant_title,color,ram,storage,price,stock_quantity')
    .eq('product_id', productId).eq('is_active', true).order('price', { ascending: true })
  if (variantsError) return { ok: false as const, message: 'Unable to load active variants.', variants: [] }
  try {
    const settings = await getStorefrontSettings()
    return {
      ok: true as const,
      variants: (variants ?? []).map((variant) => ({ ...variant, price: Number(variant.price), stock_quantity: Number(variant.stock_quantity) })),
      deliveryCharges: {
        dhaka: Number(settings.delivery.dhakaCharge),
        outsideDhaka: Number(settings.delivery.outsideDhakaCharge),
      },
    }
  } catch {
    return { ok: false as const, message: 'Unable to load current delivery charge settings.', variants: [] }
  }
}
