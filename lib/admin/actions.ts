'use server'

import { randomUUID } from 'crypto'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { writeAdminAuditLog } from '@/lib/admin/audit'
import { requireAdmin } from '@/lib/admin/auth'
import {
  adminLoginSchema,
  adminUserSchema,
  brandSchema,
  categorySchema,
  imeiSchema,
  orderStatusSchema,
  productSchema,
  settingsSchema,
  riskPolicySchema,
  paymentPolicySchema,
  footerConfigSchema,
  stockAdjustmentSchema,
  receiveStockSchema,
  initializeInventoryCostSchema,
  variantSchema,
  orderDetailsSchema,
  deleteFakeOrderSchema,
} from '@/lib/admin/schema'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidBangladeshMobile, normalizePhone } from '@/lib/orders/phone'
import { latestStatusTransitionId, loadOrderForEmail, queueOrderStatusEmail } from '@/lib/email/service'
import { createClient } from '@/lib/supabase/server'
import { receiveStock as receiveInventoryStock, initializeInventoryCost } from '@/lib/inventory/receiving'
import { recordCommerceEvent } from '@/lib/analytics/events'

export type AdminActionResult = { ok: boolean; message: string; data?: { id?: string; logoUrl?: string } }

function optional(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed || null
}

function actionFailure(error: unknown): AdminActionResult {
  if (error instanceof Error) {
    if (error.message === 'ADMIN_FORBIDDEN') return { ok: false, message: 'You do not have permission for this operation.' }
    if (error.message.includes('duplicate key')) return { ok: false, message: 'A record with that unique value already exists.' }
    if (error.message.includes('INSUFFICIENT_STOCK')) return { ok: false, message: 'This change would result in negative inventory.' }
    if (error.message.includes('INVALID_STOCK_DIRECTION')) return { ok: false, message: 'The quantity direction does not match the selected movement type.' }
    if (error.message.includes('INVALID_RECEIVING_QUANTITY')) return { ok: false, message: 'Enter a positive whole-number receiving quantity.' }
    if (error.message.includes('INVALID_PURCHASE_COST')) return { ok: false, message: 'Enter a valid non-negative purchase cost.' }
    if (error.message.includes('INITIAL_COST_REQUIRED')) return { ok: false, message: 'Purchase Cost / Unit is required when initial stock is greater than zero.' }
    if (error.message.includes('VARIANT_NOT_FOUND')) return { ok: false, message: 'The selected variant could not be found.' }
    if (error.message.includes('ORDER_STATUS_UNCHANGED')) return { ok: false, message: 'The order already has that status.' }
    if (error.message.includes('ORDER_NOT_FOUND')) return { ok: false, message: 'The order could not be found.' }
    if (error.message.includes('INVALID_ORDER_STATUS')) return { ok: false, message: 'Choose a valid order status.' }
    if (error.message.includes('ORDER_UPDATE_FAILED')) return { ok: false, message: 'Unable to update order status. Please try again.' }
    return { ok: false, message: 'The operation could not be completed. Please try again.' }
  }
  return { ok: false, message: 'The operation could not be completed.' }
}

function refreshAdminRoutes() {
  ;['/admin', '/admin/dashboard', '/admin/products', '/admin/inventory', '/admin/orders', '/admin/customers', '/admin/settings'].forEach((path) => revalidatePath(path))
  revalidatePath('/products')
  revalidatePath('/brands')
  revalidatePath('/brands/[slug]', 'page')
}

export async function signInAdmin(input: unknown): Promise<AdminActionResult> {
  const parsed = adminLoginSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: 'Enter a valid email address and password.' }

  const client = await createClient()
  const { data, error } = await client.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error || !data.user) return { ok: false, message: 'Sign-in failed. Check your email and password.' }

  const db = createAdminClient()
  const { data: adminRecord, error: adminError } = await db
    .from('admin_users')
    .select('id')
    .eq('user_id', data.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (adminError || !adminRecord) {
    await client.auth.signOut()
    return { ok: false, message: 'This account is not approved for SahiGadget administration.' }
  }

  return { ok: true, message: 'Signed in successfully.' }
}

export async function requestPasswordReset(input: unknown): Promise<AdminActionResult> {
  const parsed = adminLoginSchema.pick({ email: true }).safeParse(input)
  if (!parsed.success) {
    return { ok: true, message: 'If an account exists for this email address, a password reset link has been sent.' }
  }

  const client = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sahigadget.shop'

  await client.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/reset-password`,
  })

  return { ok: true, message: 'If an account exists for this email address, a password reset link has been sent.' }
}

export async function signOutAdmin() {
  const client = await createClient()
  await client.auth.signOut()
  redirect('/admin/login')
}

export async function getAdminOrderDetail(orderId: string) {
  await requireAdmin()
  if (!zUuid(orderId)) throw new Error('ORDER_NOT_FOUND')
  const db = createAdminClient()
  const { data, error } = await db.from('orders')
    .select('id, order_number, customer_id, subtotal, discount_total, delivery_charge, grand_total, payment_method, payment_status, payment_requirement, order_status, delivery_zone, shipping_address, shipping_area, shipping_division, shipping_district, shipping_postal_code, customer_name_snapshot, customer_phone_snapshot, customer_email_snapshot, notes, created_at, updated_at, order_items(id, sku, product_name_snapshot, variant_title_snapshot, unit_price, compare_at_price_snapshot, discount_amount, quantity, line_total, warranty_policy_snapshot), order_status_history(id, previous_status, new_status, notes, changed_by, created_at), email_notifications(id, event_type, recipient, status, attempt_count, last_error, provider_message_id, created_at, updated_at, sent_at, delivered_at, failed_at, bounced_at), shipments(id, provider, status, provider_shipment_id, merchant_order_id, provider_order_status, provider_status_slug, provider_updated_at, delivery_fee, amount_to_collect, parcel_snapshot, provider_snapshot, created_at, updated_at, last_error), risk_assessments(id, score, level, action, reasons, override_action, internal_note, created_at, updated_at)')
    .eq('id', orderId).single()
  if (error || !data) throw new Error('ORDER_NOT_FOUND')
  return data
}

export async function updateOrderContactDetails(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const parsed = orderDetailsSchema.parse(input)
    const phone = normalizePhone(parsed.customerPhone)
    if (!isValidBangladeshMobile(phone)) return { ok: false, message: 'Enter a valid Bangladesh mobile number.' }
    const db = createAdminClient()
    const { data, error } = await db.rpc('admin_update_order_contact_details', {
      p_order_id: parsed.orderId,
      p_customer_name: parsed.customerName,
      p_customer_phone: phone,
      p_customer_email: parsed.customerEmail ?? '',
      p_shipping_address: parsed.shippingAddress,
      p_shipping_area: parsed.shippingArea,
      p_shipping_district: parsed.shippingDistrict,
      p_shipping_division: parsed.shippingDivision,
      p_shipping_postal_code: parsed.shippingPostalCode ?? '',
      p_notes: parsed.notes ?? '',
      p_actor_id: session.userId,
    })
    if (error || !data?.[0]) {
      const code = error?.message ?? ''
      if (code.includes('ORDER_HAS_SHIPMENT')) return { ok: false, message: 'A courier shipment already exists. Update the delivery details in the courier workflow instead.' }
      if (code.includes('ORDER_NOT_ELIGIBLE_FOR_EDIT')) return { ok: false, message: 'This order has progressed too far to edit its delivery details safely.' }
      if (code.includes('DELIVERY_SETTINGS_UNAVAILABLE')) return { ok: false, message: 'Delivery charges are not configured. Update Settings before editing this address.' }
      return { ok: false, message: 'Unable to save order details. Refresh the order and try again.' }
    }
    await writeAdminAuditLog({
      actorUserId: session.userId,
      action: 'ORDER_CONTACT_DETAILS_UPDATED',
      entityType: 'order',
      entityId: parsed.orderId,
      details: { order_number: data[0].updated_order_number, changed_fields: 'customer_contact,shipping_address,delivery_charge,notes' },
    })
    refreshAdminRoutes()
    return { ok: true, message: 'Customer and delivery details updated. Delivery charge was recalculated from Store Settings.' }
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: 'Check the customer contact and delivery fields, then try again.' }
    return actionFailure(error)
  }
}

export async function deleteFakeOrder(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const parsed = deleteFakeOrderSchema.parse(input)
    const db = createAdminClient()
    await writeAdminAuditLog({
      actorUserId: session.userId,
      action: 'FAKE_ORDER_DELETE_REQUESTED',
      entityType: 'order',
      entityId: parsed.orderId,
      details: { reason: parsed.reason },
    })
    const { data, error } = await db.rpc('admin_delete_unshipped_fake_order', {
      p_order_id: parsed.orderId,
      p_actor_id: session.userId,
    })
    if (error || !data?.[0]) {
      const code = error?.message ?? ''
      if (code.includes('ORDER_HAS_SHIPMENT')) return { ok: false, message: 'This order has a courier shipment and cannot be deleted. Cancel/reconcile it through the courier workflow.' }
      if (code.includes('ORDER_HAS_INVOICE')) return { ok: false, message: 'An invoice exists for this order. Keep the audit trail and cancel the order instead.' }
      if (code.includes('ORDER_HAS_PAYMENT_ACTIVITY')) return { ok: false, message: 'Payment activity exists for this order. It cannot be deleted safely.' }
      if (code.includes('ORDER_HAS_SERIALIZED_INVENTORY')) return { ok: false, message: 'IMEI/serial inventory is linked to this order. It cannot be deleted safely.' }
      if (code.includes('ORDER_NOT_ELIGIBLE_FOR_DELETION')) return { ok: false, message: 'Only pending, unpaid orders without fulfilment activity can be permanently deleted.' }
      if (code.includes('ORDER_NOT_FOUND')) return { ok: false, message: 'This order no longer exists. Refresh the list.' }
      return { ok: false, message: 'The order could not be safely deleted. No changes were committed.' }
    }
    try {
      await writeAdminAuditLog({
        actorUserId: session.userId,
        action: 'FAKE_ORDER_DELETED',
        entityType: 'order',
        entityId: parsed.orderId,
        details: { order_number: data[0].deleted_order_number, reason: parsed.reason, restored_stock_variants: data[0].restored_stock_variants },
      })
    } catch (auditError) {
      console.error('[admin] order deleted but completion audit log failed', auditError instanceof Error ? auditError.message : auditError)
    }
    refreshAdminRoutes()
    return { ok: true, message: `Order ${data[0].deleted_order_number} permanently deleted. Stock was safely reconciled and an inventory movement was recorded.` }
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: 'Enter a reason for deleting this fake order.' }
    return actionFailure(error)
  }
}

export async function saveProduct(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const parsed = productSchema.parse(input)
    const db = createAdminClient()
    const payload = {
      name: parsed.name,
      slug: parsed.slug,
      brand_id: parsed.brandId ?? null,
      category_id: parsed.categoryId ?? null,
      product_type: parsed.productType,
      status: parsed.status,
      is_published: parsed.isPublished,
      is_featured: parsed.isFeatured,
      short_description: optional(parsed.shortDescription),
      description: optional(parsed.description),
      warranty_policy: parsed.warrantyPolicy,
      meta_title: optional(parsed.metaTitle),
      meta_description: optional(parsed.metaDescription),
      updated_at: new Date().toISOString(),
    }

    const request = parsed.id
      ? db.from('products').update(payload).eq('id', parsed.id).select('id').single()
      : db.from('products').insert(payload).select('id').single()
    const { data, error } = await request
    if (error || !data) throw new Error(error?.message ?? 'Unable to save the product.')

    await writeAdminAuditLog({
      actorUserId: session.userId,
      action: parsed.id ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED',
      entityType: 'product',
      entityId: data.id,
      details: { status: parsed.status, is_published: parsed.isPublished, is_featured: parsed.isFeatured },
    })
    refreshAdminRoutes()
    return { ok: true, message: parsed.id ? 'Product updated.' : 'Product created.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function archiveProduct(productId: string): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const db = createAdminClient()
    const { error } = await db.from('products').update({ status: 'archived', is_published: false, updated_at: new Date().toISOString() }).eq('id', productId)
    if (error) throw new Error(error.message)
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'PRODUCT_ARCHIVED', entityType: 'product', entityId: productId })
    refreshAdminRoutes()
    return { ok: true, message: 'Product archived and unpublished.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function saveBrand(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const parsed = brandSchema.parse(input)
    const db = createAdminClient()
    const payload = { name: parsed.name, slug: parsed.slug, description: optional(parsed.description), logo_url: optional(parsed.logoUrl), is_active: parsed.isActive, meta_title: optional(parsed.metaTitle), meta_description: optional(parsed.metaDescription), updated_at: new Date().toISOString() }
    const request = parsed.id ? db.from('brands').update(payload).eq('id', parsed.id).select('id').single() : db.from('brands').insert(payload).select('id').single()
    const { data, error } = await request
    if (error || !data) throw new Error(error?.message ?? 'Unable to save brand.')
    await writeAdminAuditLog({ actorUserId: session.userId, action: parsed.id ? 'BRAND_UPDATED' : 'BRAND_CREATED', entityType: 'brand', entityId: data.id, details: { is_active: parsed.isActive } })
    refreshAdminRoutes()
    return { ok: true, message: parsed.id ? 'Brand updated.' : 'Brand created.', data: { id: data.id, logoUrl: payload.logo_url ?? undefined } }
  } catch (error) {
    return actionFailure(error)
  }
}

function getBrandLogoStoragePath(url: string | null | undefined) {
  if (!url) return null
  const marker = '/storage/v1/object/public/brand-logos/'
  const index = url.indexOf(marker)
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null
}

export async function uploadBrandLogo(formData: FormData): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const brandId = formData.get('brandId')
    const file = formData.get('file')
    if (typeof brandId !== 'string' || !zUuid(brandId) || !(file instanceof File)) return { ok: false, message: 'Choose a brand and a valid logo file.' }
    const allowedTypes = new Set(['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg'])
    if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > 2 * 1024 * 1024) return { ok: false, message: 'Use an SVG, PNG, WebP, or JPEG logo up to 2 MB.' }

    const extension = file.type === 'image/svg+xml' ? 'svg' : file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
    const storagePath = `${brandId}/${randomUUID()}.${extension}`
    const db = createAdminClient()
    const { data: brand, error: brandError } = await db.from('brands').select('id,logo_url').eq('id', brandId).single()
    if (brandError || !brand) return { ok: false, message: 'The selected brand could not be found.' }
    const upload = await db.storage.from('brand-logos').upload(storagePath, file, { contentType: file.type, upsert: false })
    if (upload.error) throw new Error(upload.error.message)
    const { data: publicUrl } = db.storage.from('brand-logos').getPublicUrl(storagePath)
    const { error: updateError } = await db.from('brands').update({ logo_url: publicUrl.publicUrl, updated_at: new Date().toISOString() }).eq('id', brandId)
    if (updateError) {
      await db.storage.from('brand-logos').remove([storagePath])
      throw new Error(updateError.message)
    }
    const oldPath = getBrandLogoStoragePath(brand.logo_url)
    if (oldPath && oldPath !== storagePath) await db.storage.from('brand-logos').remove([oldPath])
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'BRAND_LOGO_UPLOADED', entityType: 'brand', entityId: brandId, details: { content_type: file.type, size: file.size } })
    refreshAdminRoutes()
    return { ok: true, message: 'Brand logo uploaded.', data: { id: brandId, logoUrl: publicUrl.publicUrl } }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function removeBrandLogo(brandId: string): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    if (!zUuid(brandId)) return { ok: false, message: 'Invalid brand reference.' }
    const db = createAdminClient()
    const { data: brand, error: brandError } = await db.from('brands').select('id,logo_url').eq('id', brandId).single()
    if (brandError || !brand) return { ok: false, message: 'The selected brand could not be found.' }
    const { error: updateError } = await db.from('brands').update({ logo_url: null, updated_at: new Date().toISOString() }).eq('id', brandId)
    if (updateError) throw new Error(updateError.message)
    const storagePath = getBrandLogoStoragePath(brand.logo_url)
    if (storagePath) await db.storage.from('brand-logos').remove([storagePath])
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'BRAND_LOGO_REMOVED', entityType: 'brand', entityId: brandId })
    refreshAdminRoutes()
    return { ok: true, message: 'Brand logo removed.', data: { id: brandId, logoUrl: '' } }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function uploadCategoryImage(formData: FormData): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const file = formData.get('file')
    const categoryId = formData.get('categoryId')
    if (!(file instanceof File)) return { ok: false, message: 'Choose an image file.' }
    if (categoryId && (typeof categoryId !== 'string' || !zUuid(categoryId))) return { ok: false, message: 'Invalid category reference.' }
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
    if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > 3 * 1024 * 1024) {
      return { ok: false, message: 'Use JPEG, PNG, WebP, or AVIF up to 3 MB.' }
    }
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
    const storagePath = `categories/${randomUUID()}.${extension}`
    const db = createAdminClient()
    const upload = await db.storage.from('product-images').upload(storagePath, file, { contentType: file.type, upsert: false, cacheControl: '31536000' })
    if (upload.error) throw new Error(upload.error.message)
    const { data: publicUrl } = db.storage.from('product-images').getPublicUrl(storagePath)
    if (typeof categoryId === 'string' && categoryId) {
      const { error } = await db.from('categories').update({ image_url: publicUrl.publicUrl, updated_at: new Date().toISOString() }).eq('id', categoryId)
      if (error) {
        await db.storage.from('product-images').remove([storagePath])
        throw new Error(error.message)
      }
    }
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'CATEGORY_IMAGE_UPLOADED', entityType: 'category', entityId: typeof categoryId === 'string' ? categoryId : undefined, details: { content_type: file.type, size: file.size } })
    refreshAdminRoutes()
    return { ok: true, message: 'Category image uploaded.', data: { logoUrl: publicUrl.publicUrl } }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function saveCategory(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const parsed = categorySchema.parse(input)
    const db = createAdminClient()
    const payload = { name: parsed.name, slug: parsed.slug, description: optional(parsed.description), image_url: optional(parsed.imageUrl), sort_order: parsed.sortOrder, is_active: parsed.isActive, meta_title: optional(parsed.metaTitle), meta_description: optional(parsed.metaDescription), updated_at: new Date().toISOString() }
    const request = parsed.id ? db.from('categories').update(payload).eq('id', parsed.id).select('id').single() : db.from('categories').insert(payload).select('id').single()
    const { data, error } = await request
    if (error || !data) throw new Error(error?.message ?? 'Unable to save category.')
    await writeAdminAuditLog({ actorUserId: session.userId, action: parsed.id ? 'CATEGORY_UPDATED' : 'CATEGORY_CREATED', entityType: 'category', entityId: data.id, details: { is_active: parsed.isActive, sort_order: parsed.sortOrder } })
    refreshAdminRoutes()
    return { ok: true, message: parsed.id ? 'Category updated.' : 'Category created.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function saveVariant(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const parsed = variantSchema.parse(input)
    if (parsed.compareAtPrice !== null && parsed.compareAtPrice !== undefined && parsed.compareAtPrice < parsed.price) {
      return { ok: false, message: 'Compare-at price must be at least the selling price.' }
    }
    const db = createAdminClient()
    if (!parsed.id) {
      if (parsed.initialStock > 0 && parsed.initialCost == null) return { ok: false, message: 'Purchase Cost / Unit is required when Initial Stock is greater than 0.' }
      const { data, error } = await db.rpc('create_admin_variant_with_initial_stock', {
        p_product_id: parsed.productId, p_sku: parsed.sku, p_variant_title: parsed.variantTitle,
        p_ram: parsed.ram ?? '', p_storage: parsed.storage ?? '', p_color: parsed.color ?? '',
        p_price: parsed.price, p_compare_at_price: parsed.compareAtPrice ?? null,
        p_low_stock_threshold: parsed.lowStockThreshold, p_is_active: parsed.isActive,
        p_initial_stock: parsed.initialStock, p_initial_cost: parsed.initialCost ?? null,
        p_actor_id: session.userId, p_idempotency_key: randomUUID(),
      })
      if (error || !data?.[0]) throw new Error(error?.message ?? 'Unable to create variant.')
      await writeAdminAuditLog({ actorUserId: session.userId, action: 'VARIANT_CREATED', entityType: 'product_variant', entityId: data[0].variant_id, details: { price: parsed.price, initial_stock: parsed.initialStock, initial_cost: parsed.initialCost ?? null, is_active: parsed.isActive } })
      refreshAdminRoutes()
      return { ok: true, message: parsed.initialStock > 0 ? 'Variant created with initial stock and internal purchase cost.' : 'Variant created.' }
    }

    const payload = { product_id: parsed.productId, sku: parsed.sku, variant_title: parsed.variantTitle, ram: optional(parsed.ram), storage: optional(parsed.storage), color: optional(parsed.color), price: parsed.price, compare_at_price: parsed.compareAtPrice ?? null, low_stock_threshold: parsed.lowStockThreshold, is_active: parsed.isActive, updated_at: new Date().toISOString() }
    const { data, error } = await db.from('product_variants').update(payload).eq('id', parsed.id).select('id').single()
    if (error || !data) throw new Error(error?.message ?? 'Unable to save variant.')
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'VARIANT_UPDATED', entityType: 'product_variant', entityId: data.id, details: { price: parsed.price, compare_at_price: parsed.compareAtPrice ?? null, is_active: parsed.isActive } })
    refreshAdminRoutes()
    return { ok: true, message: parsed.id ? 'Variant updated.' : 'Variant created.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function receiveStock(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const parsed = receiveStockSchema.parse(input)
    const result = await receiveInventoryStock({ ...parsed, actorId: session.userId })
    refreshAdminRoutes()
    return { ok: true, message: `Received ${parsed.quantity} unit${parsed.quantity === 1 ? '' : 's'} successfully. Stock: ${result.previous_stock} → ${result.new_stock}.` }
  } catch (error) { return actionFailure(error) }
}

export async function initializeCost(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const parsed = initializeInventoryCostSchema.parse(input)
    const result = await initializeInventoryCost({ ...parsed, actorId: session.userId })
    refreshAdminRoutes()
    return { ok: true, message: `Opening cost recorded at ${result.unit_cost} per unit for ${result.stock_quantity} units.` }
  } catch (error) { return actionFailure(error) }
}

export async function adjustInventory(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN', 'STAFF'])
    const parsed = stockAdjustmentSchema.parse(input)
    const db = createAdminClient()
    const { error } = await db.rpc('adjust_inventory', {
      p_variant_id: parsed.variantId,
      p_change_amount: parsed.changeAmount,
      p_movement_type: parsed.movementType,
      p_notes: parsed.notes || '',
      p_actor_id: session.userId,
    })
    if (error) throw new Error(error.message)
    refreshAdminRoutes()
    return { ok: true, message: 'Inventory movement recorded.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function saveImei(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const parsed = imeiSchema.parse(input)
    if (parsed.status === 'sold' && !parsed.orderId) return { ok: false, message: 'A sold device must be linked to an order.' }
    const db = createAdminClient()
    const payload = { variant_id: parsed.variantId, imei_1: parsed.imei1, imei_2: optional(parsed.imei2), serial_number: optional(parsed.serialNumber), status: parsed.status, order_id: parsed.orderId ?? null, sold_at: parsed.status === 'sold' ? new Date().toISOString() : null }
    const request = parsed.id ? db.from('imei_inventory').update(payload).eq('id', parsed.id).select('id').single() : db.from('imei_inventory').insert(payload).select('id').single()
    const { data, error } = await request
    if (error || !data) throw new Error(error?.message ?? 'Unable to save IMEI record.')
    await writeAdminAuditLog({ actorUserId: session.userId, action: parsed.id ? 'IMEI_UPDATED' : 'IMEI_CREATED', entityType: 'imei_inventory', entityId: data.id, details: { status: parsed.status, variant_id: parsed.variantId, order_id: parsed.orderId ?? null } })
    refreshAdminRoutes()
    return { ok: true, message: parsed.id ? 'Device record updated.' : 'Device record added.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function updateOrderStatus(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN', 'STAFF'])
    const parsed = orderStatusSchema.parse(input)
    const db = createAdminClient()
    const { error } = await db.rpc('update_admin_order_status', {
      p_order_id: parsed.orderId,
      p_new_status: parsed.status,
      p_notes: parsed.notes || '',
      p_actor_id: session.userId,
    })
    if (error) throw new Error(error.message)
    const { data: updatedOrder } = await db.from('orders').select('id,order_number,order_status').eq('id', parsed.orderId).maybeSingle()
    if (updatedOrder) {
      await recordCommerceEvent({ eventId: `${parsed.orderId}:status:${parsed.status}:${Date.now()}`, eventName: 'order_status_changed', orderId: parsed.orderId, metadata: { source: 'ADMIN', status: String(updatedOrder.order_status), order_number: String(updatedOrder.order_number) } })
    }
    let notificationMessage = 'Customer notification was not required for this status.'
    try {
      const order = await loadOrderForEmail(parsed.orderId)
      const transitionId = await latestStatusTransitionId(parsed.orderId)
      const notification = await queueOrderStatusEmail(order, transitionId)
      if (!notification.ok) {
        console.error('[email] order status notification failed', notification.error)
        notificationMessage = 'Customer notification could not be delivered. The order status was updated.'
      } else if ('skipped' in notification && notification.skipped) {
        notificationMessage = 'Customer notification was not required for this status.'
      } else if ('status' in notification) {
        notificationMessage = notification.status === 'DELIVERED' ? 'Customer notification delivered.' : 'Customer notification submitted for delivery.'
      }
    } catch (emailError) {
      console.error('[email] order status notification failed', emailError instanceof Error ? emailError.message : emailError)
      notificationMessage = 'Customer notification could not be delivered. The order status was updated.'
    }
    refreshAdminRoutes()
    return { ok: true, message: `Order status updated and history recorded. ${notificationMessage}` }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function saveOperationalSettings(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER'])
    const parsed = settingsSchema.pick({ deliveryCharges: true, businessPolicy: true }).parse(input)
    const db = createAdminClient()
    const { error } = await db.from('settings').upsert([
      { key: 'delivery_charges', value: parsed.deliveryCharges, description: 'Standard delivery charges for Dhaka and Outside Dhaka in BDT' },
      { key: 'business_policy', value: parsed.businessPolicy, description: 'SahiGadget standard guarantee and warranty policy' },
    ], { onConflict: 'key' })
    if (error) throw new Error(error.message)
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'OPERATIONAL_SETTINGS_UPDATED', entityType: 'settings', details: { keys: 'delivery_charges,business_policy' } })
    refreshAdminRoutes()
    return { ok: true, message: 'Delivery and warranty settings saved.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function savePaymentPolicy(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER'])
    const parsed = paymentPolicySchema.parse(input)
    if (!parsed.codEnabled && parsed.defaultProvider === 'COD') return { ok: false, message: 'Enable Cash on Delivery or choose an enabled online provider.' }
    const db = createAdminClient()
    const { error } = await db.from('settings').upsert({ key: 'payment_policy', value: parsed, description: 'Non-secret payment routing and expiry controls' }, { onConflict: 'key' })
    if (error) throw new Error(error.message)
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'PAYMENT_POLICY_UPDATED', entityType: 'settings', details: { keys: 'payment_policy', cod_enabled: parsed.codEnabled, bdgate_enabled: parsed.bdgateEnabled, default_provider: parsed.defaultProvider, payment_expiry_minutes: parsed.paymentExpiryMinutes } })
    refreshAdminRoutes()
    return { ok: true, message: 'Payment routing policy saved.' }
  } catch (error) {
    return actionFailure(error)
  }
}
export async function saveRiskPolicy(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER'])
    const parsed = riskPolicySchema.parse(input)
    const db = createAdminClient()
    const { error } = await db.from('settings').upsert({ key: 'risk_policy', value: parsed, description: 'Deterministic customer risk weights and COD decision thresholds' }, { onConflict: 'key' })
    if (error) throw new Error(error.message)
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'RISK_POLICY_UPDATED', entityType: 'settings', details: { keys: 'risk_policy', enabled: parsed.enabled, thresholds: parsed.thresholds } })
    refreshAdminRoutes()
    return { ok: true, message: 'Customer risk policy saved.' }
  } catch (error) {
    return actionFailure(error)
  }
}
export async function saveFooterSettings(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER'])
    const parsed = footerConfigSchema.parse(input)
    const db = createAdminClient()
    const { error } = await db.from('settings').upsert({
      key: 'footer_config',
      value: parsed,
      description: 'Public footer social destinations and active payment-method display configuration',
    }, { onConflict: 'key' })
    if (error) throw new Error(error.message)
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'FOOTER_SETTINGS_UPDATED', entityType: 'settings', details: { keys: 'footer_config', socialPlatforms: Object.entries(parsed.social).filter(([, value]) => Boolean(value)).map(([key]) => key), payments: parsed.payments } })
    refreshAdminRoutes()
    revalidatePath('/')
    revalidatePath('/contact')
    return { ok: true, message: 'Footer settings saved.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function saveInvoiceGenerationSetting(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER'])
    const enabled = typeof input === 'object' && input !== null && 'enabled' in input && typeof (input as { enabled?: unknown }).enabled === 'boolean'
      ? (input as { enabled: boolean }).enabled
      : null
    if (enabled === null) return { ok: false, message: 'Choose whether invoice generation should be enabled or disabled.' }

    const db = createAdminClient()
    const { data: previous, error: previousError } = await db.from('settings').select('value').eq('key', 'invoice_generation').maybeSingle()
    if (previousError) throw new Error(previousError.message)
    const previousEnabled = previous?.value && typeof previous.value === 'object' && 'enabled' in previous.value
      ? (previous.value as { enabled?: unknown }).enabled !== false
      : true

    const { error } = await db.from('settings').upsert({
      key: 'invoice_generation',
      value: { enabled },
      description: 'Owner-only control for customer-facing invoice generation. Defaults to enabled to preserve existing behavior.',
    }, { onConflict: 'key' })
    if (error) throw new Error(error.message)

    await writeAdminAuditLog({
      actorUserId: session.userId,
      action: enabled ? 'INVOICE_GENERATION_ENABLED' : 'INVOICE_GENERATION_DISABLED',
      entityType: 'settings',
      details: { setting: 'invoice_generation', previous_value: { enabled: previousEnabled }, new_value: { enabled } },
    })
    refreshAdminRoutes()
    revalidatePath('/admin/orders')
    return { ok: true, message: enabled ? 'Invoice generation enabled.' : 'Invoice generation disabled.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function saveLandingPageAccessSetting(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER'])
    const adminEnabled = typeof input === 'object' && input !== null && 'admin_enabled' in input && typeof (input as { admin_enabled?: unknown }).admin_enabled === 'boolean'
      ? (input as { admin_enabled: boolean }).admin_enabled
      : null
    if (adminEnabled === null) return { ok: false, message: 'Choose whether ADMIN access to Landing Pages should be enabled or disabled.' }

    const db = createAdminClient()
    const { data: previous, error: previousError } = await db.from('settings').select('value').eq('key', 'landing_page_access').maybeSingle()
    if (previousError) throw new Error(previousError.message)
    const previousEnabled = previous?.value && typeof previous.value === 'object' && 'admin_enabled' in previous.value
      ? (previous.value as { admin_enabled?: unknown }).admin_enabled !== false
      : true

    const { error } = await db.from('settings').upsert({
      key: 'landing_page_access',
      value: { admin_enabled: adminEnabled },
      description: 'Owner-controlled access for ADMIN users to Landing Page management.',
    }, { onConflict: 'key' })
    if (error) throw new Error(error.message)

    await writeAdminAuditLog({
      actorUserId: session.userId,
      action: adminEnabled ? 'LANDING_PAGE_ACCESS_ENABLED' : 'LANDING_PAGE_ACCESS_DISABLED',
      entityType: 'settings',
      details: { setting: 'landing_page_access', previous_value: { admin_enabled: previousEnabled }, new_value: { admin_enabled: adminEnabled } },
    })
    refreshAdminRoutes()
    revalidatePath('/admin/landing-pages')
    return { ok: true, message: adminEnabled ? 'ADMIN Landing Page access enabled.' : 'ADMIN Landing Page access disabled.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function saveOwnerSettings(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER'])
    const parsed = settingsSchema.pick({ storeProfile: true, returnRefundPolicy: true }).parse(input)
    const db = createAdminClient()
    const { error } = await db.from('settings').upsert([
      { key: 'store_profile', value: parsed.storeProfile, description: 'Central store profile for administration and storefront presentation' },
      { key: 'return_refund_policy', value: parsed.returnRefundPolicy, description: 'Configurable return and refund policy' },
    ], { onConflict: 'key' })
    if (error) throw new Error(error.message)
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'OWNER_SETTINGS_UPDATED', entityType: 'settings', details: { keys: 'store_profile,return_refund_policy' } })
    refreshAdminRoutes()
    return { ok: true, message: 'Store profile and return policy saved.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function saveAdminUser(input: unknown): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER'])
    const parsed = adminUserSchema.parse(input)
    if (parsed.userId === session.userId && (!parsed.isActive || parsed.role !== 'OWNER')) {
      return { ok: false, message: 'An owner cannot remove or downgrade their own active owner access.' }
    }
    const db = createAdminClient()
    const { data, error } = await db.from('admin_users').upsert({ user_id: parsed.userId, full_name: parsed.fullName, email: parsed.email, role: parsed.role, is_active: parsed.isActive, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select('id').single()
    if (error || !data) throw new Error(error?.message ?? 'Unable to save admin user.')
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'ADMIN_USER_UPDATED', entityType: 'admin_user', entityId: data.id, details: { role: parsed.role, is_active: parsed.isActive } })
    refreshAdminRoutes()
    return { ok: true, message: 'Admin access record saved.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function getProductImagesForAdmin() {
  try {
    await requireAdmin(['OWNER', 'ADMIN'])
    const db = createAdminClient()
    const { data, error } = await db
      .from('product_images')
      .select('id, product_id, variant_id, storage_path, image_url, alt_text, sort_order, is_primary')
      .order('sort_order')
      .limit(250)
    if (error) throw new Error(error.message)
    return data ?? []
  } catch {
    return []
  }
}

export async function uploadProductImage(formData: FormData): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const productId = formData.get('productId')
    const variantId = formData.get('variantId')
    const altText = formData.get('altText')
    const isPrimary = formData.get('isPrimary') === 'true'
    const file = formData.get('file')
    if (typeof productId !== 'string' || !zUuid(productId) || !(file instanceof File)) return { ok: false, message: 'Choose a product and a valid image file.' }
    if (variantId && (typeof variantId !== 'string' || !zUuid(variantId))) return { ok: false, message: 'Choose a valid variant.' }
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
    if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) return { ok: false, message: 'Use a JPEG, PNG, WebP, or AVIF image up to 5 MB.' }

    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
    const storagePath = `${productId}/${randomUUID()}.${extension}`
    const db = createAdminClient()
    if (typeof variantId === 'string' && variantId) {
      const { data: variant, error: variantError } = await db.from('product_variants').select('id,product_id').eq('id', variantId).eq('product_id', productId).maybeSingle()
      if (variantError || !variant) return { ok: false, message: 'The selected variant does not belong to this product.' }
    }
    const upload = await db.storage.from('product-images').upload(storagePath, file, { contentType: file.type, upsert: false })
    if (upload.error) throw new Error(upload.error.message)
    const { data: publicUrl } = db.storage.from('product-images').getPublicUrl(storagePath)
    if (isPrimary) {
      let primaryQuery = db.from('product_images').update({ is_primary: false, updated_at: new Date().toISOString() }).eq('product_id', productId)
      primaryQuery = typeof variantId === 'string' && variantId ? primaryQuery.eq('variant_id', variantId) : primaryQuery.is('variant_id', null)
      const { error } = await primaryQuery
      if (error) throw new Error(error.message)
    }
    const { data, error } = await db.from('product_images').insert({ product_id: productId, variant_id: typeof variantId === 'string' && variantId ? variantId : null, storage_path: storagePath, image_url: publicUrl.publicUrl, alt_text: typeof altText === 'string' ? optional(altText) : null, is_primary: isPrimary, created_by: session.userId }).select('id').single()
    if (error || !data) {
      await db.storage.from('product-images').remove([storagePath])
      throw new Error(error?.message ?? 'Unable to store image metadata.')
    }
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'PRODUCT_IMAGE_UPLOADED', entityType: 'product_image', entityId: data.id, details: { product_id: productId, variant_id: typeof variantId === 'string' && variantId ? variantId : null, content_type: file.type, size: file.size, is_primary: isPrimary } })
    refreshAdminRoutes()
    return { ok: true, message: 'Product image uploaded.' }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function deleteProductImage(input: { imageId: string; storagePath: string }): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    if (!zUuid(input.imageId)) return { ok: false, message: 'Invalid image reference.' }
    const db = createAdminClient()
    const { data: image, error: imageError } = await db
      .from('product_images')
      .select('id, storage_path')
      .eq('id', input.imageId)
      .single()
    if (imageError || !image || image.storage_path !== input.storagePath || !image.storage_path.includes('/')) {
      return { ok: false, message: 'The image reference could not be verified.' }
    }
    const { error: objectError } = await db.storage.from('product-images').remove([image.storage_path])
    if (objectError) throw new Error(objectError.message)
    const { error } = await db.from('product_images').delete().eq('id', image.id)
    if (error) throw new Error(error.message)
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'PRODUCT_IMAGE_DELETED', entityType: 'product_image', entityId: image.id })
    refreshAdminRoutes()
    return { ok: true, message: 'Product image removed.' }
  } catch (error) {
    return actionFailure(error)
  }
}

function zUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
