import Link from 'next/link'
import { ArrowLeft, ShoppingBag } from 'lucide-react'

import { CheckoutFlow } from '@/components/order/checkout-flow'

export const metadata = {
  title: 'Order with Cash on Delivery',
  description: 'Secure guest checkout for SahiGadget orders in Bangladesh.',
}

type SearchParams = Promise<{ productId?: string; variantId?: string }>

export default async function OrderPage({ searchParams }: { searchParams: SearchParams }) {
  const { productId, variantId } = await searchParams
  if (!productId || !variantId) {
    return <main className="flex-1 bg-slate-50"><div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><ShoppingBag className="h-6 w-6" /></div><p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Choose a product first</p><h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">Your order needs a selected variant.</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">Open a product, choose the RAM, storage, or colour you want, then select <strong>Order now</strong> to start a secure Cash on Delivery checkout.</p><Link href="/products" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Browse products</Link></div></div></main>
  }

  return <main className="flex-1 bg-slate-50"><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><Link href="/products" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Continue shopping</Link><div className="mt-6"><CheckoutFlow productId={productId} variantId={variantId} /></div></div></main>
}
