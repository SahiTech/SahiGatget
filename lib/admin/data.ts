import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import { requireAdmin } from './auth'
import { getInvoiceGenerationStatus } from '@/lib/invoices/service'

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
  const trendStart = new Date()
  trendStart.setHours(0, 0, 0, 0)
  trendStart.setDate(trendStart.getDate() - 13)
  const trendStartIso = trendStart.toISOString()

  const [todayOrders, pending, processing, delivered, cancelled, recent, variants, trendOrders] = await Promise.all([
    db.from('orders').select('grand_total, created_at').gte('created_at', today).order('created_at', { ascending: false }).limit(100),
    db.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'PENDING'),
    db.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'PROCESSING'),
    db.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'DELIVERED'),
    db.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'CANCELLED'),
    db.from('orders').select('id, order_number, customer_name_snapshot, order_status, payment_status, grand_total, created_at').order('created_at', { ascending: false }).limit(8),
    db.from('product_variants').select('id, sku, variant_title, stock_quantity, low_stock_threshold, products(name)').eq('is_active', true).order('stock_quantity', { ascending: true }).limit(50),
    db.from('orders').select('created_at, grand_total, order_status').gte('created_at', trendStartIso).order('created_at', { ascending: true }).limit(1000),
  ])

  ;[todayOrders, pending, processing, delivered, cancelled, recent, variants, trendOrders].forEach((result) => assertNoError(result.error))

  const trendMap = new Map<string, { sales: number; orders: number }>()
  for (let i = 0; i < 14; i += 1) {
    const date = new Date(trendStart)
    date.setDate(trendStart.getDate() + i)
    trendMap.set(date.toISOString().slice(0, 10), { sales: 0, orders: 0 })
  }
  for (const order of trendOrders.data ?? []) {
    if (order.order_status === 'CANCELLED') continue
    const key = new Date(order.created_at).toISOString().slice(0, 10)
    const bucket = trendMap.get(key)
    if (bucket) {
      bucket.sales += Number(order.grand_total ?? 0)
      bucket.orders += 1
    }
  }
  const salesTrend = Array.from(trendMap.entries()).map(([date, value]) => ({ date, ...value }))

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
    salesTrend,
  }
}

export async function getProductManagementData() {
  await requireAdmin(['OWNER', 'ADMIN'])
  const db = createAdminClient()
  const [products, brands, categories] = await Promise.all([
    db.from('products').select('id, name, slug, status, is_published, is_featured, product_type, warranty_policy, short_description, description, meta_title, meta_description, brand_id, category_id, brands(name), categories(name), product_variants(id, sku, variant_title, color, price, compare_at_price, stock_quantity, low_stock_threshold, is_active)').order('updated_at', { ascending: false }).limit(100),
    db.from('brands').select('id, name, slug, description, logo_url, is_active, meta_title, meta_description').order('name').limit(100),
    db.from('categories').select('id, name, slug, description, image_url, sort_order, is_active, meta_title, meta_description').order('sort_order').limit(100),
  ])

  ;[products, brands, categories].forEach((result) => assertNoError(result.error))
  return { products: products.data ?? [], brands: brands.data ?? [], categories: categories.data ?? [], images: [] }
}

export async function getInventoryData() {
  await requireAdmin()
  const db = createAdminClient()
  const session = await requireAdmin()

  const canManageCosts = session.role !== 'STAFF'
  const [variants, costs, receipts, movements, imei, costItems, orderStatuses] = await Promise.all([
    db.from('product_variants').select('id, product_id, sku, variant_title, stock_quantity, low_stock_threshold, price, is_active, products(name)').order('updated_at', { ascending: false }).limit(200),
    canManageCosts ? db.from('admin_inventory_cost_summary').select('variant_id, costed_quantity, average_cost, inventory_value, potential_gross_profit_per_unit, costing_method').limit(200) : Promise.resolve({ data: [], error: null }),
    canManageCosts ? db.from('inventory_receipts').select('id, variant_id, receipt_type, quantity, unit_cost, supplier_name, supplier_reference, received_at, created_by, note, movement_id, created_at').order('received_at', { ascending: false }).limit(150) : Promise.resolve({ data: [], error: null }),
    db.from('stock_movements').select('id, variant_id, change_amount, movement_type, notes, created_by, created_at, product_variants(sku, variant_title, products(name))').order('created_at', { ascending: false }).limit(100),
    canManageCosts
      ? db.from('imei_inventory').select('id, variant_id, imei_1, imei_2, serial_number, status, order_id, sold_at, created_at, product_variants(sku, variant_title, products(name))').order('created_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    canManageCosts ? db.from('order_items').select('order_id,quantity,line_total,cost_total,gross_profit').limit(5000) : Promise.resolve({ data: [], error: null }),
    canManageCosts ? db.from('orders').select('id,order_status').limit(5000) : Promise.resolve({ data: [], error: null }),
  ])

  ;[variants, costs, receipts, movements, imei, costItems, orderStatuses].forEach((result) => assertNoError(result.error))
  const lowStock = (variants.data ?? []).filter((variant) => Number(variant.stock_quantity) <= Number(variant.low_stock_threshold))
  const inventoryValue = (costs.data ?? []).reduce((sum: number, row) => sum + Number(row.inventory_value ?? 0), 0)
  const unitsInStock = (variants.data ?? []).reduce((sum: number, row) => sum + Number(row.stock_quantity ?? 0), 0)
  const orderStatusById = new Map((orderStatuses.data ?? []).map((row): [string, string] => [row.id, row.order_status]))
  const costRows = (costItems.data ?? []).filter((row) => row.cost_total != null && orderStatusById.get(row.order_id) !== 'CANCELLED')
  const revenue = costRows.reduce((sum: number, row) => sum + Number(row.line_total ?? 0), 0)
  const cogs = costRows.reduce((sum: number, row) => sum + Number(row.cost_total ?? 0), 0)
  const grossProfit = costRows.reduce((sum: number, row) => sum + Number(row.gross_profit ?? 0), 0)
  const metrics = canManageCosts ? { unitsInStock, inventoryValue, revenue, cogs, grossProfit } : null
  return { variants: variants.data ?? [], costs: costs.data ?? [], receipts: receipts.data ?? [], movements: movements.data ?? [], imei: imei.data ?? [], lowStock, canManageImei: canManageCosts, canManageCosts, metrics }
}

export async function getOrderManagementData(query?: string) {
  await requireAdmin()
  const db = createAdminClient()
  const search = query?.trim()
  let request = db
    .from('orders')
    .select('id, order_number, customer_id, grand_total, payment_method, payment_status, payment_requirement, order_status, customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot, notes, created_at, updated_at, shipments(provider, status, provider_shipment_id), risk_assessments(score, level, action)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (search) {
    request = request.or(`order_number.ilike.%${search.replace(/[,%()]/g, '')}%,customer_name_snapshot.ilike.%${search.replace(/[,%()]/g, '')}%,customer_phone_snapshot.ilike.%${search.replace(/[,%()]/g, '')}%`)
  }

  // Run independent reads concurrently; do not block the order query on Settings.
  const [invoiceGenerationEnabled, { data, error }] = await Promise.all([
    getInvoiceGenerationStatus(),
    request,
  ])
  assertNoError(error)
  return { orders: data ?? [], invoiceGenerationEnabled }
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
  const session = await requireAdmin(['OWNER'])
  const db = createAdminClient()
  const { data, error } = await db
    .from('settings')
    .select('key, value, description, updated_at')
    .in('key', ['delivery_charges', 'business_policy', 'risk_policy', 'payment_policy', 'store_profile', 'return_refund_policy', 'footer_config', 'invoice_generation', 'landing_page_access'])
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

  return { settings: { invoice_generation: { enabled: true }, landing_page_access: { admin_enabled: true }, ...settings }, auditLogs: auditLogs.data ?? [], admins: admins.data ?? [], incompleteCheckouts: incompleteCheckouts ?? [], isOwner: true, bdgateConfigured: Boolean(process.env.BDGATE_LIVE_API_KEY) }
}
