'use server'

import { after } from 'next/server'
import { addToCart, clearCart, removeCartItem, updateCartItem } from './cart'
import { markCheckoutSession, recordCommerceEvent } from '@/lib/analytics/events'

export async function addToCartAction(input: { productId: string; variantId: string; quantity?: number }) {
  try {
    return await addToCart(input)
  } catch (error) {
    console.error('[cart] addToCartAction failed', error)
    return { ok: false as const, message: 'Unable to update your cart. Please try again.' }
  }
}

export async function updateCartItemAction(input: { itemId: string; quantity: number }) {
  try {
    return await updateCartItem(input)
  } catch (error) {
    console.error('[cart] updateCartItemAction failed', error)
    return { ok: false as const, message: 'Unable to update your cart. Please try again.' }
  }
}

export async function removeCartItemAction(itemId: string) {
  try {
    return await removeCartItem(itemId)
  } catch (error) {
    console.error('[cart] removeCartItemAction failed', error)
    return { ok: false as const, message: 'Unable to remove that item. Please try again.' }
  }
}

export async function clearCartAction() {
  try {
    return await clearCart()
  } catch (error) {
    console.error('[cart] clearCartAction failed', error)
    return { ok: false as const, message: 'Unable to clear your cart. Please try again.' }
  }
}

export async function prepareGuestCheckoutAction(input: { productId: string; variantId: string; quantity?: number }) {
  try {
    const quantity = Math.min(10, Math.max(1, Math.trunc(input.quantity ?? 1)))
    const checkoutRequestId = crypto.randomUUID()
    const redirectUrl = `/order?productId=${encodeURIComponent(input.productId)}&variantId=${encodeURIComponent(input.variantId)}&quantity=${quantity}&checkoutRequestId=${encodeURIComponent(checkoutRequestId)}`

    // Do not block the Buy Now transition on a duplicate database preflight.
    // /order revalidates the product/variant server-side, and final order creation
    // performs the authoritative stock/price/risk checks again.
    after(() =>
      Promise.all([
        markCheckoutSession({
          checkoutRequestId,
          source: 'QUICK_ORDER',
          status: 'STARTED',
          quoteSnapshot: {
            product_id: input.productId,
            variant_id: input.variantId,
            quantity,
          },
        }),
        recordCommerceEvent({
          eventId: `${checkoutRequestId}:started`,
          eventName: 'CHECKOUT_STARTED',
          sessionId: checkoutRequestId,
          metadata: {
            source: 'QUICK_ORDER',
            product_id: input.productId,
            variant_id: input.variantId,
            quantity,
          },
        }),
      ]).catch((error) => console.error('[checkout] session tracking failed', error)),
    )

    return { ok: true as const, data: { checkoutRequestId, redirectUrl } }
  } catch (error) {
    console.error('[checkout] prepareGuestCheckoutAction failed', error)
    return { ok: false as const, message: 'We could not start checkout right now. Please try again.' }
  }
}
