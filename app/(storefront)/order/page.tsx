import Link from 'next/link'
import { ArrowLeft, ShoppingBag } from 'lucide-react'

import { CheckoutFlow } from '@/components/order/checkout-flow'
import { CartCheckoutFlow } from '@/components/order/cart-checkout-flow'
import { getCart } from '@/lib/commerce/cart'
import { getProductById } from '@/lib/services/storefront'

export const metadata = {
  title: 'Order with Cash on Delivery',
  description: 'Secure guest checkout for SahiGadget orders in Bangladesh.',
  alternates: { canonical: '/order' },
  robots: { index: false, follow: true },
}

type SearchParams = Promise<{ productId?: string; variantId?: string; quantity?: string; checkoutRequestId?: string; source?: string }>

export default async function OrderPage({ searchParams }: { searchParams: SearchParams }) {
  const { productId, variantId, quantity, checkoutRequestId, source } = await searchParams
  if (source === 'cart') return <main className="flex-1 bg-slate-50"><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><Link href="/cart" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Back to cart</Link><div className="mt-6"><CartCheckoutFlow cart={await getCart()} /></div></div></main>
  const initialQuantity = Math.min(10, Math.max(1, Number.parseInt(quantity || '1', 10) || 1))
  if (!productId || !variantId) {
    return <main className="flex-1 bg-slate-50"><div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><ShoppingBag className="h-6 w-6" /></div><p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Choose a product first</p><h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">Your order needs a selected variant.</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">Open a product, choose the RAM, storage, or colour you want, then select <strong>Order now</strong> to start a secure Cash on Delivery checkout.</p><Link href="/products" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Browse products</Link></div></div></main>
  }

  const product = await getProductById(productId)
  const variant = product?.variants.find((item) => item.id === variantId)
  if (!product || !variant) {
    return <main className="flex-1 bg-slate-50"><div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><div role="alert" className="rounded-[1.75rem] border border-rose-200 bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><ShoppingBag className="h-6 w-6" /></div><p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-rose-600">Checkout unavailable</p><h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">This product option is no longer available.</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">The product or selected variant may have been removed or changed. Please return to the product list and choose an available option.</p><Link href="/products" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Browse products</Link></div></div></main>
  }
  if (!variant.is_in_stock) {
    return <main className="flex-1 bg-slate-50"><div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><div role="alert" className="rounded-[1.75rem] border border-amber-200 bg-white p-8 text-center shadow-sm"><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Out of stock</p><h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">This selected option is out of stock.</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">Please choose another available variant before starting checkout.</p><Link href={`/products/${product.slug}`} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Back to product</Link></div></div></main>
  }
  return <main className="flex-1 bg-slate-50"><div className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-8 lg:px-8"><Link href="/products" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-slate-950 sm:text-sm"><ArrowLeft className="h-4 w-4" /> Edit details</Link><div className="mt-3 sm:mt-6"><CheckoutFlow productId={productId} variantId={variantId} initialQuantity={initialQuantity} initialCheckoutRequestId={checkoutRequestId} /></div></div></main>
}
