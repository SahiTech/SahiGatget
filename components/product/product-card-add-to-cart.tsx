'use client'

import { useState } from 'react'
import { Check, Loader2, ShoppingCart } from 'lucide-react'
import { addToCartAction } from '@/lib/commerce/actions'
import type { StorefrontProduct } from '@/lib/services/storefront-utils'

export function ProductCardAddToCart({ product }: { product: StorefrontProduct }) {
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(false)

  const variant = product.variants.find((item) => item.is_in_stock)

  async function handleAdd() {
    if (!variant || busy) return

    setBusy(true)
    setAdded(false)

    try {
      const result = await addToCartAction({
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
      })

      if (result.ok) {
        setAdded(true)
        window.setTimeout(() => setAdded(false), 1800)
      }
    } finally {
      setBusy(false)
    }
  }

  const disabled = !variant || busy

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={disabled}
      aria-label={added ? `Added ${product.name} to cart` : variant ? `Add ${product.name} to cart` : `${product.name} is out of stock`}
      title={added ? 'Added to cart' : variant ? 'Add to cart' : 'Out of stock'}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : added ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <ShoppingCart className="h-4 w-4" aria-hidden="true" />}
    </button>
  )
}
