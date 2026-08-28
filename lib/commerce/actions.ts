'use server'

import { redirect } from 'next/navigation'

import { addToCart, clearCart, removeCartItem, updateCartItem } from './cart'
import { createClient } from '@/lib/supabase/server'

async function requireCustomer() {
  const client = await createClient()
  const {
    data: { user },
    error,
  } = await client.auth.getUser()

  if (error || !user) {
    redirect('/customer/login?next=/cart')
  }

  return user
}

export async function addToCartAction(input: { productId: string; variantId: string; quantity?: number }) {
  await requireCustomer()
  try {
    return await addToCart(input)
  } catch (error) {
    console.error('[cart] addToCartAction failed', error)
    return { ok: false as const, message: 'Unable to update your cart. Please try again.' }
  }
}

export async function updateCartItemAction(input: { itemId: string; quantity: number }) {
  await requireCustomer()
  try {
    return await updateCartItem(input)
  } catch (error) {
    console.error('[cart] updateCartItemAction failed', error)
    return { ok: false as const, message: 'Unable to update your cart. Please try again.' }
  }
}

export async function removeCartItemAction(itemId: string) {
  await requireCustomer()
  try {
    return await removeCartItem(itemId)
  } catch (error) {
    console.error('[cart] removeCartItemAction failed', error)
    return { ok: false as const, message: 'Unable to remove that item. Please try again.' }
  }
}

export async function clearCartAction() {
  await requireCustomer()
  try {
    return await clearCart()
  } catch (error) {
    console.error('[cart] clearCartAction failed', error)
    return { ok: false as const, message: 'Unable to clear your cart. Please try again.' }
  }
}
