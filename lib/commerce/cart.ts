import 'server-only'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStorefrontSettings } from '@/lib/services/storefront'

const CART_COOKIE = 'sahigadget-cart-token'
const MAX_QUANTITY = 10

type CartRow = { id: string; guest_token: string; status: string; expires_at: string }
type CartItemRow = { id: string; product_id: string; variant_id: string; quantity: number; product?: { name: string; slug: string; product_type: string }; variant?: { sku: string; variant_title: string; price: number; compare_at_price: number | null; is_in_stock: boolean } }

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
  const { data, error } = await db.from('cart_items').select('id,product_id,variant_id,quantity,product:products(name,slug,product_type),variant:storefront_variants(sku,variant_title,price,compare_at_price,is_in_stock)').eq('cart_id', cartId).order('created_at')
  if (error) throw new Error('Unable to load cart items.')
  return (data ?? []) as unknown as CartItemRow[]
}

async function emitCartEvent(eventName: 'CART_CREATED' | 'CART_ITEM_ADDED' | 'CART_ITEM_UPDATED' | 'CART_ITEM_REMOVED', cartId: string, metadata: Record<string, unknown> = {}) {
  const db = createAdminClient()
  await db.from('commerce_events').insert({ event_id: crypto.randomUUID(), event_name: eventName, cart_id: cartId, metadata })
}

export async function getCart() {
  const cart = await getOrCreateCart(false)
  if (!cart) return { id: '', items: [], subtotal: 0, deliveryCharges: (await getStorefrontSettings()).delivery, itemCount: 0 }
  const items = await loadCartItems(cart.id)
  const settings = await getStorefrontSettings()
  const subtotal = items.reduce((sum, item) => sum + Number(item.variant?.price ?? 0) * item.quantity, 0)
  return { id: cart.id, items, subtotal, deliveryCharges: settings.delivery, itemCount: items.reduce((sum, item) => sum + item.quantity, 0) }
}

export async function addToCart(input: { productId: string; variantId: string; quantity?: number }) {
  const quantity = clampQuantity(input.quantity ?? 1)
  const cart = await getOrCreateCart(true)
  if (!cart) return { ok: false, message: 'Unable to start a cart.' }
  const db = createAdminClient()
  const { data: variant, error: variantError } = await db.from('storefront_variants').select('id,product_id,is_in_stock').eq('id', input.variantId).eq('product_id', input.productId).maybeSingle()
  if (variantError || !variant) return { ok: false, message: 'This product option is no longer available.' }
  if (!variant.is_in_stock) return { ok: false, message: 'This product option is out of stock.' }
  const { data: existing } = await db.from('cart_items').select('id,quantity').eq('cart_id', cart.id).eq('variant_id', input.variantId).maybeSingle()
  const nextQuantity = clampQuantity(Number(existing?.quantity ?? 0) + quantity)
  const result = existing
    ? await db.from('cart_items').update({ quantity: nextQuantity, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await db.from('cart_items').insert({ cart_id: cart.id, product_id: input.productId, variant_id: input.variantId, quantity: nextQuantity })
  if (result.error) return { ok: false, message: 'Unable to update your cart.' }
  await emitCartEvent(existing ? 'CART_ITEM_UPDATED' : 'CART_ITEM_ADDED', cart.id, { quantity: nextQuantity })
  return { ok: true, data: await getCart() }
}

export async function updateCartItem(input: { itemId: string; quantity: number }) {
  const cart = await getOrCreateCart(true)
  if (!cart) return { ok: false, message: 'Unable to start a cart.' }
  const quantity = clampQuantity(input.quantity)
  const db = createAdminClient()
  const { error } = await db.from('cart_items').update({ quantity, updated_at: new Date().toISOString() }).eq('id', input.itemId).eq('cart_id', cart.id)
  if (error) return { ok: false, message: 'Unable to update your cart.' }
  await emitCartEvent('CART_ITEM_UPDATED', cart.id, { quantity })
  return { ok: true, data: await getCart() }
}

export async function removeCartItem(itemId: string) {
  const cart = await getOrCreateCart(true)
  if (!cart) return { ok: false, message: 'Unable to start a cart.' }
  const db = createAdminClient()
  const { error } = await db.from('cart_items').delete().eq('id', itemId).eq('cart_id', cart.id)
  if (error) return { ok: false, message: 'Unable to remove that item.' }
  await emitCartEvent('CART_ITEM_REMOVED', cart.id)
  return { ok: true, data: await getCart() }
}

export async function clearCart() {
  const cart = await getOrCreateCart(true)
  if (!cart) return { ok: false, message: 'Unable to start a cart.' }
  const db = createAdminClient()
  const { error } = await db.from('cart_items').delete().eq('cart_id', cart.id)
  if (error) return { ok: false, message: 'Unable to clear your cart.' }
  return { ok: true, data: await getCart() }
}
