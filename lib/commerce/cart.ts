import 'server-only'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStorefrontSettings } from '@/lib/services/storefront'

const CART_COOKIE = 'sahigadget-cart-token'
const MAX_QUANTITY = 10

type CartRow = { id: string; guest_token: string; status: string; expires_at: string }
type CartItemRow = { id: string; product_id: string; variant_id: string; quantity: number; product?: { name: string; slug: string; product_type: string; image_url: string | null; product_images?: Array<{ image_url: string; variant_id: string | null; is_primary: boolean; sort_order: number }> }; variant?: { sku: string; variant_title: string; color: string | null; price: number; compare_at_price: number | null; is_in_stock: boolean } }

function clampQuantity(value: number) { return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(value || 1))) }

async function getOrCreateCart(createIfMissing = true) {
  const jar = await cookies()
  const existingToken = jar.get(CART_COOKIE)?.value
  const db = createAdminClient()
  if (existingToken) {
    const { data } = await db.from('carts').select('id,guest_token,status,expires_at').eq('guest_token', existingToken).eq('status', 'ACTIVE').gt('expires_at', new Date().toISOString()).maybeSingle()
    if (data) return data as CartRow
  }
  if (!createIfMissing) return null
  const token = crypto.randomUUID()
  const { data, error } = await db.from('carts').insert({ guest_token: token }).select('id,guest_token,status,expires_at').single()
  if (error || !data) throw new Error('Unable to start a cart.')
  jar.set(CART_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 })
  return data as CartRow
}

async function loadCartItems(cartId: string): Promise<CartItemRow[]> {
  const db = createAdminClient()
  const { data: rows, error } = await db
    .from('cart_items')
    .select('id,product_id,variant_id,quantity')
    .eq('cart_id', cartId)
    .order('created_at')

  if (error) throw new Error('Unable to load cart items.')
  if (!rows?.length) return []

  const productIds = Array.from(new Set(rows.map((row) => row.product_id)))
  const variantIds = Array.from(new Set(rows.map((row) => row.variant_id)))

  const [{ data: products, error: productsError }, { data: variants, error: variantsError }] = await Promise.all([
    db.from('products').select('id,name,slug,product_type,product_images(image_url,variant_id,is_primary,sort_order)').in('id', productIds),
    db.from('product_variants').select('id,sku,variant_title,color,price,compare_at_price,stock_quantity,is_active').in('id', variantIds),
  ])

  if (productsError || variantsError) throw new Error('Unable to load cart items.')

  const productMap = new Map((products ?? []).map((product) => [product.id, product]))
  const variantMap = new Map((variants ?? []).map((variant) => [variant.id, variant]))

  return rows.map((row) => {
    const product = productMap.get(row.product_id)
    const variant = variantMap.get(row.variant_id)
    return {
      id: row.id,
      product_id: row.product_id,
      variant_id: row.variant_id,
      quantity: row.quantity,
      product: product
        ? (() => { const images = ((product.product_images ?? []) as { image_url: string; variant_id: string | null; is_primary: boolean; sort_order: number }[]); const variantImage = images.filter((image) => image.variant_id === row.variant_id).sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0]; const fallback = images.filter((image) => image.variant_id === null).sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0]; return { name: product.name, slug: product.slug, product_type: product.product_type, image_url: variantImage?.image_url ?? fallback?.image_url ?? null } })()
        : undefined,
      variant: variant
        ? {
            sku: variant.sku,
            variant_title: variant.variant_title,
            color: variant.color ?? null,
            price: Number(variant.price),
            compare_at_price: variant.compare_at_price === null ? null : Number(variant.compare_at_price),
            is_in_stock: Boolean(variant.is_active && Number(variant.stock_quantity) > 0),
          }
        : undefined,
    }
  })
}

async function emitCartEvent(eventName: 'CART_CREATED' | 'CART_ITEM_ADDED' | 'CART_ITEM_UPDATED' | 'CART_ITEM_REMOVED', cartId: string, metadata: Record<string, unknown> = {}) {
  const db = createAdminClient()
  await db.from('commerce_events').insert({ event_id: crypto.randomUUID(), event_name: eventName, cart_id: cartId, metadata })
}

export async function getCart() {
  const cart = await getOrCreateCart(false)
  if (!cart) return { id: '', items: [], subtotal: 0, deliveryCharges: (await getStorefrontSettings()).delivery, itemCount: 0 }
  const [items, settings] = await Promise.all([
    loadCartItems(cart.id),
    getStorefrontSettings(),
  ])
  const subtotal = items.reduce((sum, item) => sum + Number(item.variant?.price ?? 0) * item.quantity, 0)
  return { id: cart.id, items, subtotal, deliveryCharges: settings.delivery, itemCount: items.reduce((sum, item) => sum + item.quantity, 0) }
}

export async function addToCart(input: { productId: string; variantId: string; quantity?: number }) {
  const quantity = clampQuantity(input.quantity ?? 1)
  const db = createAdminClient()

  // Start cart lookup and authoritative variant validation together. The previous
  // flow waited for the cart lookup before starting validation, adding an avoidable
  // network round trip to the customer-facing mutation path.
  const cartPromise = getOrCreateCart(true)
  const variantPromise = db
    .from('product_variants')
    .select('id,product_id,is_active,stock_quantity,product:products(is_published)')
    .eq('id', input.variantId)
    .eq('product_id', input.productId)
    .maybeSingle()

  const cart = await cartPromise
  if (!cart) return { ok: false, message: 'Unable to start a cart.' }

  // Once the cart id is known, start the existing-item lookup immediately while
  // the authoritative variant validation query continues in parallel.
  const existingPromise = db
    .from('cart_items')
    .select('id,quantity')
    .eq('cart_id', cart.id)
    .eq('variant_id', input.variantId)
    .maybeSingle()

  const [{ data: variant, error: variantError }, { data: existing }] = await Promise.all([
    variantPromise,
    existingPromise,
  ])

  if (variantError) return { ok: false, message: 'Unable to update your cart.' }

  const productPublished = Boolean((variant?.product as { is_published?: boolean } | null)?.is_published)
  if (!variant || !variant.is_active || !productPublished) {
    return { ok: false, message: 'This product option is no longer available.' }
  }
  if (Number(variant.stock_quantity) <= 0) return { ok: false, message: 'This product option is out of stock.' }

  const nextQuantity = clampQuantity(Number(existing?.quantity ?? 0) + quantity)
  const result = existing
    ? await db.from('cart_items').update({ quantity: nextQuantity, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await db.from('cart_items').insert({ cart_id: cart.id, product_id: input.productId, variant_id: input.variantId, quantity: nextQuantity })

  if (result.error) return { ok: false, message: 'Unable to update your cart.' }

  // Keep the add-to-cart critical path fast. The cart page always re-reads authoritative state.
  // Analytics/event logging is intentionally outside the customer-facing response path.
  void emitCartEvent(existing ? 'CART_ITEM_UPDATED' : 'CART_ITEM_ADDED', cart.id, { quantity: nextQuantity }).catch((error) => {
    console.error('[cart] event logging failed', error)
  })
  return { ok: true, data: { itemCount: nextQuantity } }
}

export async function updateCartItem(input: { itemId: string; quantity: number }) {
  const cart = await getOrCreateCart(true)
  if (!cart) return { ok: false, message: 'Unable to start a cart.' }
  const quantity = clampQuantity(input.quantity)
  const db = createAdminClient()
  const { error } = await db.from('cart_items').update({ quantity, updated_at: new Date().toISOString() }).eq('id', input.itemId).eq('cart_id', cart.id)
  if (error) return { ok: false, message: 'Unable to update your cart.' }
  const [cartData] = await Promise.all([
    getCart(),
    emitCartEvent('CART_ITEM_UPDATED', cart.id, { quantity }),
  ])
  return { ok: true, data: cartData }
}

export async function removeCartItem(itemId: string) {
  const cart = await getOrCreateCart(true)
  if (!cart) return { ok: false, message: 'Unable to start a cart.' }
  const db = createAdminClient()
  const { error } = await db.from('cart_items').delete().eq('id', itemId).eq('cart_id', cart.id)
  if (error) return { ok: false, message: 'Unable to remove that item.' }
  const [cartData] = await Promise.all([
    getCart(),
    emitCartEvent('CART_ITEM_REMOVED', cart.id),
  ])
  return { ok: true, data: cartData }
}

export async function clearCart() {
  const cart = await getOrCreateCart(true)
  if (!cart) return { ok: false, message: 'Unable to start a cart.' }
  const db = createAdminClient()
  const { error } = await db.from('cart_items').delete().eq('cart_id', cart.id)
  if (error) return { ok: false, message: 'Unable to clear your cart.' }
  return { ok: true, data: await getCart() }
}
