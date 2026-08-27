import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import { requireAdmin } from './auth'

function dayStartIso() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.toISOString()
}

function assertNoError(error: { message: string } | null) {
  if (error) throw new Error('Unable to load administrative data.')
}

export async function getAdminDashboardData() {
  await requireAdmin()
  const db = createAdminClient()
  const today = dayStartIso()

  const [todayOrders, pending, processing, delivered, cancelled, recent, variants] = await Promise.all([
    db.from('orders').select('id, grand_total, created_at').gte('created_at', today).order('created_at', { ascending: false }).limit(250),
    db.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'PENDING'),
    db.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'PROCESSING'),
    db.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'DELIVERED'),
    db.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'CANCELLED'),
    db.from('orders').select('id, order_number, customer_name_snapshot, order_status, payment_status, grand_total, created_at').order('created_at', { ascending: false }).limit(8),
    db.from('product_variants').select('id, sku, variant_title, stock_quantity, low_stock_threshold, products(name)').eq('is_active', true).order('stock_quantity', { ascending: true }).limit(50),
  ])

  ;[todayOrders, pending, processing, delivered, cancelled, recent, variants].forEach((result) => assertNoError(result.error))

  const todaySales = (todayOrders.data ?? []).reduce((total, order) => total + Number(order.grand_total ?? 0), 0)
  const lowStock = (variants.data ?? []).filter((variant) => Number(variant.stock_quantity) <= Number(variant.low_stock_threshold))

  return {
    todayOrders: todayOrders.data?.length ?? 0,
    todaySales,
    pendingOrders: pending.count ?? 0,
    processingOrders: processing.count ?? 0,
    deliveredOrders: delivered.count ?? 0,
    cancelledOrders: cancelled.count ?? 0,
    recentOrders: recent.data ?? [],
    lowStock,
  }
}

export async function getProductManagementData() {
  await requireAdmin(['OWNER', 'ADMIN'])
  const db = createAdminClient()
  const [products, brands, categories, images] = await Promise.all([
    db.from('products').select('id, name, slug, status, is_published, is_featured, product_type, warranty_policy, brand_id, category_id, created_at, updated_at, brands(name), categories(name), product_variants(id, sku, variant_title, price, compare_at_price, stock_quantity, low_stock_threshold, is_active)').order('updated_at', { ascending: false }).limit(100),
    db.from('brands').select('id, name, slug, description, logo_url, is_active, meta_title, meta_description').order('name').limit(100),
    db.from('categories').select('id, name, slug, description, image_url, sort_order, is_active, meta_title, meta_description').order('sort_order').limit(100),
    db.from('product_images').select('id, product_id, storage_path, image_url, alt_text, sort_order, is_primary').order('sort_order').limit(250),
  ])

  ;[products, brands, categories, images].forEach((result) => assertNoError(result.error))
  return { products: products.data ?? [], brands: brands.data ?? [], categories: categories.data ?? [], images: images.data ?? [] }
}

export async function getInventoryData() {
  await requireAdmin()
  const db = createAdminClient()
  const session = await requireAdmin()

  const [variants, movements, imei] = await Promise.all([
    db.from('product_variants').select('id, product_id, sku, variant_title, stock_quantity, low_stock_threshold, price, is_active, products(name)').order('updated_at', { ascending: false }).limit(200),
    db.from('stock_movements').select('id, variant_id, change_amount, movement_type, notes, created_by, created_at, product_variants(sku, variant_title, products(name))').order('created_at', { ascending: false }).limit(100),
    session.role === 'STAFF'
      ? Promise.resolve({ data: [], error: null })
      : db.from('imei_inventory').select('id, variant_id, imei_1, imei_2, serial_number, status, order_id, sold_at, created_at, product_variants(sku, variant_title, products(name))').order('created_at', { ascending: false }).limit(100),
  ])

  ;[variants, movements, imei].forEach((result) => assertNoError(result.error))
  const lowStock = (variants.data ?? []).filter((variant) => Number(variant.stock_quantity) <= Number(variant.low_stock_threshold))
  return { variants: variants.data ?? [], movements: movements.data ?? [], imei: imei.data ?? [], lowStock, canManageImei: session.role !== 'STAFF' }
}

export async function getOrderManagementData(query?: string) {
  await requireAdmin()
  const db = createAdminClient()
  const search = query?.trim()
  let request = db
    .from('orders')
    .select('id, order_number, customer_id, subtotal, discount_total, delivery_charge, grand_total, payment_method, payment_status, payment_requirement, order_status, delivery_zone, shipping_address, shipping_area, shipping_division, shipping_district, shipping_postal_code, customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot, notes, created_at, updated_at, order_items(id, sku, product_name_snapshot, variant_title_snapshot, unit_price, compare_at_price_snapshot, discount_amount, quantity, line_total, warranty_policy_snapshot), order_status_history(id, previous_status, new_status, notes, changed_by, created_at), email_notifications(id, event_type, recipient, status, attempt_count, last_error, provider_message_id, created_at, updated_at, sent_at, delivered_at, failed_at, bounced_at), shipments(id, provider, status, provider_shipment_id, merchant_order_id, provider_order_status, provider_status_slug, provider_updated_at, delivery_fee, amount_to_collect, parcel_snapshot, provider_snapshot, created_at, updated_at, last_error), risk_assessments(id, score, level, action, reasons, override_action, internal_note, created_at, updated_at)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (search) {
    request = request.or(`order_number.ilike.%${search.replace(/[,%()]/g, '')}%,customer_name_snapshot.ilike.%${search.replace(/[,%()]/g, '')}%,customer_phone_snapshot.ilike.%${search.replace(/[,%()]/g, '')}%`)
  }

  const { data, error } = await request
  assertNoError(error)
  return data ?? []
}

export async function getCustomerManagementData(query?: string) {
  await requireAdmin()
  const db = createAdminClient()
  const search = query?.trim()
  let request = db
    .from('customers')
    .select('id, full_name, phone, email, created_at, orders(id, order_number, grand_total, order_status, created_at)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (search) {
    const safe = search.replace(/[,%()]/g, '')
    request = request.or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`)
  }

  const { data, error } = await request
  assertNoError(error)
  return data ?? []
}

export async function getSettingsData() {
  const session = await requireAdmin(['OWNER', 'ADMIN'])
  const db = createAdminClient()
  const { data, error } = await db
    .from('settings')
    .select('key, value, description, updated_at')
    .in('key', ['delivery_charges', 'business_policy', 'risk_policy', 'payment_policy', 'store_profile', 'return_refund_policy', 'footer_config'])
    .limit(12)
  const { data: incompleteCheckouts, error: checkoutError } = await db
    .from('checkout_sessions')
    .select('id,checkout_request_id,source,status,customer_phone,customer_email,quote_snapshot,last_activity_at,created_at')
    .in('status', ['STARTED', 'DETAILS_ENTERED', 'QUOTED', 'PAYMENT_INITIATED', 'ABANDONED'])
    .order('last_activity_at', { ascending: false })
    .limit(100)
  assertNoError(error)
  assertNoError(checkoutError)

  const settings = Object.fromEntries((data ?? []).map((item) => [item.key, item.value]))
  const auditLogs = session.role === 'OWNER'
    ? await db.from('audit_logs').select('id, action, entity_type, entity_id, details, created_at, user_id').order('created_at', { ascending: false }).limit(100)
    : { data: [], error: null }
  assertNoError(auditLogs.error)

  const admins = session.role === 'OWNER'
    ? await db.from('admin_users').select('id, user_id, full_name, email, role, is_active, created_at').order('created_at').limit(50)
    : { data: [], error: null }
  assertNoError(admins.error)

  return { settings, auditLogs: auditLogs.data ?? [], admins: admins.data ?? [], incompleteCheckouts: incompleteCheckouts ?? [], isOwner: session.role === 'OWNER', bdgateConfigured: Boolean(process.env.BDGATE_LIVE_API_KEY) }
}
