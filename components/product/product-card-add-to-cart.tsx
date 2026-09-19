'use client'

import { useState } from 'react'
import { Check, Loader2, ShoppingCart } from 'lucide-react'
import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { addToCartAction } from '@/lib/commerce/actions'
import type { StorefrontProduct } from '@/lib/services/storefront-utils'

export function ProductCardAddToCart({ product }: { product: StorefrontProduct }) {
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(false)

  async function handleAdd() {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(`/products/${product.slug}`)}`)
      return
    }
    const variant = product.variants.find((item) => item.is_in_stock)
    if (!variant || busy) return
    setBusy(true)
    setAdded(false)
    const result = await addToCartAction({ productId: product.id, variantId: variant.id, quantity: 1 })
    setBusy(false)
    if (result.ok) {
      setAdded(true)
      window.setTimeout(() => setAdded(false), 1800)
    }
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={busy || !isLoaded}
      aria-label={added ? `Added ${product.name} to cart` : `Add ${product.name} to cart`}
      title={added ? 'Added to cart' : 'Add to cart'}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : added ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <ShoppingCart className="h-4 w-4" aria-hidden="true" />}
    </button>
  )
}
