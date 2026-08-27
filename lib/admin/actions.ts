'use server'

import { randomUUID } from 'crypto'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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
  variantSchema,
} from '@/lib/admin/schema'
import { createAdminClient } from '@/lib/supabase/admin'
import { latestStatusTransitionId, loadOrderForEmail, queueOrderStatusEmail } from '@/lib/email/service'
import { createClient } from '@/lib/supabase/server'

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
    const payload = { product_id: parsed.productId, sku: parsed.sku, variant_title: parsed.variantTitle, ram: optional(parsed.ram), storage: optional(parsed.storage), color: optional(parsed.color), price: parsed.price, compare_at_price: parsed.compareAtPrice ?? null, low_stock_threshold: parsed.lowStockThreshold, is_active: parsed.isActive, updated_at: new Date().toISOString() }
    const request = parsed.id ? db.from('product_variants').update(payload).eq('id', parsed.id).select('id').single() : db.from('product_variants').insert(payload).select('id').single()
    const { data, error } = await request
    if (error || !data) throw new Error(error?.message ?? 'Unable to save variant.')
    await writeAdminAuditLog({ actorUserId: session.userId, action: parsed.id ? 'VARIANT_UPDATED' : 'VARIANT_CREATED', entityType: 'product_variant', entityId: data.id, details: { price: parsed.price, compare_at_price: parsed.compareAtPrice ?? null, is_active: parsed.isActive } })
    refreshAdminRoutes()
    return { ok: true, message: parsed.id ? 'Variant updated.' : 'Variant created.' }
  } catch (error) {
    return actionFailure(error)
  }
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
    const session = await requireAdmin(['OWNER', 'ADMIN'])
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
    const session = await requireAdmin(['OWNER', 'ADMIN'])
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
    const session = await requireAdmin(['OWNER', 'ADMIN'])
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
    const session = await requireAdmin(['OWNER', 'ADMIN'])
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

export async function uploadProductImage(formData: FormData): Promise<AdminActionResult> {
  try {
    const session = await requireAdmin(['OWNER', 'ADMIN'])
    const productId = formData.get('productId')
    const altText = formData.get('altText')
    const isPrimary = formData.get('isPrimary') === 'true'
    const file = formData.get('file')
    if (typeof productId !== 'string' || !zUuid(productId) || !(file instanceof File)) return { ok: false, message: 'Choose a product and a valid image file.' }
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
    if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) return { ok: false, message: 'Use a JPEG, PNG, WebP, or AVIF image up to 5 MB.' }

    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
    const storagePath = `${productId}/${randomUUID()}.${extension}`
    const db = createAdminClient()
    const upload = await db.storage.from('product-images').upload(storagePath, file, { contentType: file.type, upsert: false })
    if (upload.error) throw new Error(upload.error.message)
    const { data: publicUrl } = db.storage.from('product-images').getPublicUrl(storagePath)
    if (isPrimary) {
      const { error } = await db.from('product_images').update({ is_primary: false, updated_at: new Date().toISOString() }).eq('product_id', productId)
      if (error) throw new Error(error.message)
    }
    const { data, error } = await db.from('product_images').insert({ product_id: productId, storage_path: storagePath, image_url: publicUrl.publicUrl, alt_text: typeof altText === 'string' ? optional(altText) : null, is_primary: isPrimary, created_by: session.userId }).select('id').single()
    if (error || !data) {
      await db.storage.from('product-images').remove([storagePath])
      throw new Error(error?.message ?? 'Unable to store image metadata.')
    }
    await writeAdminAuditLog({ actorUserId: session.userId, action: 'PRODUCT_IMAGE_UPLOADED', entityType: 'product_image', entityId: data.id, details: { product_id: productId, content_type: file.type, size: file.size, is_primary: isPrimary } })
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
