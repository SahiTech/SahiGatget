'use server'

import { addToCart, clearCart, removeCartItem, updateCartItem } from './cart'

export async function addToCartAction(input: { productId: string; variantId: string; quantity?: number }) { return addToCart(input) }
export async function updateCartItemAction(input: { itemId: string; quantity: number }) { return updateCartItem(input) }
export async function removeCartItemAction(itemId: string) { return removeCartItem(itemId) }
export async function clearCartAction() { return clearCart() }
