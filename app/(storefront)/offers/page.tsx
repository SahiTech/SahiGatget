import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Percent, Sparkles, PackageOpen } from 'lucide-react'

import { ProductGrid } from '@/components/product/product-card'
import { getHomepageData, getProducts } from '@/lib/services/storefront'

export const metadata: Metadata = {
  title: 'Offers & Deals',
  description: 'Explore current phone and gadget deals from SahiGadget.',
  alternates: { canonical: '/offers' },
}

export default async function OffersPage() {
  const [{ products }, { banners }] = await Promise.all([getProducts({ pageSize: 48, sort: 'newest' }), getHomepageData()])
  const offers = products.filter((product) => product.variants.some((variant) => variant.compare_at_price && variant.compare_at_price > variant.price))
  const dealBanners = banners.filter((banner) => banner.primary_cta_url || banner.mobile_image_url || banner.desktop_image_url).slice(0, 3)

  return (
    <main className="min-h-[70vh] overflow-x-hidden bg-[#f6f7f9] pb-8">
      <section className="bg-[var(--brand-navy)] px-3 py-7 text-white sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-orange-400"><Percent className="h-3.5 w-3.5" /> SahiGadget offers</p>
          <div className="mt-1 flex items-end justify-between gap-4"><div><h1 className="text-2xl font-black tracking-tight sm:text-4xl">Deals worth <span className="text-orange-400">checking</span></h1><p className="mt-2 max-w-xl text-xs leading-5 text-slate-300 sm:text-sm">Browse products with a current compare-at price and discover active promotions from our storefront.</p></div><Link href="/products" className="hidden shrink-0 rounded-full border border-white/15 px-4 py-2 text-xs font-black text-white sm:inline-flex">Shop all</Link></div>
        </div>
      </section>

      {dealBanners.length > 0 ? <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{dealBanners.map((banner) => {
        const imageUrl = banner.mobile_image_url || banner.desktop_image_url
        if (!imageUrl) return null
        return <Link key={banner.id} href={banner.primary_cta_url?.trim() || '/offers'} className="group relative aspect-[2.1/1] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><Image src={imageUrl} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" /></Link>
      })}</div></section> : null}

      <section className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-10 lg:px-8" aria-labelledby="offers-heading">
        <div className="flex items-end justify-between gap-3"><div><p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-orange-500"><Sparkles className="h-3.5 w-3.5" /> Current deals</p><h2 id="offers-heading" className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-3xl">Discounted <span className="text-orange-500">Products</span></h2></div><span className="text-[10px] font-bold text-slate-400 sm:text-xs">{offers.length} available</span></div>
        <div className="mt-4">{offers.length ? <ProductGrid products={offers} /> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center"><PackageOpen className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-base font-black text-slate-900">No active offers right now</p><p className="mt-1 text-xs text-slate-500">Browse the full catalogue for the latest products.</p><Link href="/products" className="mt-5 inline-flex items-center gap-1 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-black text-white">Shop products <ArrowRight className="h-3.5 w-3.5" /></Link></div>}</div>
      </section>
    </main>
  )
}
