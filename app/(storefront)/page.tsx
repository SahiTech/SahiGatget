import Link from 'next/link'
import { ArrowRight, BadgeCheck, Headphones, ShieldCheck, Truck, Zap } from 'lucide-react'
import Image from 'next/image'

import { siteConfig } from '@/config/site'
import { BrandCard, CategoryCard } from '@/components/storefront/discovery-card'
import { ProductGrid } from '@/components/product/product-card'
import { getBrands, getCategories, getDeliverySummary, getFeaturedProducts, getStorefrontPolicySummary, getStorefrontSettings, type StorefrontBrand, type StorefrontCategory } from '@/lib/services/storefront'

export default async function HomePage() {
  const [featuredProducts, brands, categories, settings] = await Promise.all([getFeaturedProducts(4), getBrands(), getCategories(), getStorefrontSettings()])
  return (
    <main className="flex-1 overflow-x-hidden">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(16,185,129,0.2),transparent_28%),radial-gradient(circle_at_10%_100%,rgba(14,165,233,0.16),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300 sm:text-xs">
              <Zap className="h-3.5 w-3.5" />Bangladesh mobile & gadget shop
            </div>
            <h1 className="mt-7 max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.06em] sm:text-6xl md:text-7xl">
              Shop with clarity.<br />
              <span className="text-emerald-300">Choose with confidence.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
              {siteConfig.tagline}. {siteConfig.brandPromise}. Explore the live public catalogue with transparent pricing, customer-safe availability, and the information you need before you order.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/products" className="inline-flex h-12 items-center gap-2 rounded-full bg-emerald-400 px-6 text-sm font-black text-slate-950 transition-colors hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">
                Browse catalogue <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/categories" className="inline-flex h-12 items-center rounded-full border border-slate-700 px-6 text-sm font-bold text-white transition-colors hover:border-slate-400 hover:bg-white/5">
                Explore categories
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-4 text-[10px] font-semibold text-slate-400 sm:text-xs">
              <span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-emerald-300" />Published catalogue</span>
              <span className="flex items-center gap-2"><Truck className="h-4 w-4 text-emerald-300" />{getDeliverySummary(settings)}</span>
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" />{getStorefrontPolicySummary(settings)}</span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md lg:ml-auto">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-emerald-300/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 sm:text-xs">Store snapshot</p>
                  <p className="mt-2 text-2xl font-black">{siteConfig.name}</p>
                </div>
                <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 shadow-md">
                  <Image src="/logo.png" alt="SahiGadget Logo" width={44} height={44} className="h-full w-full object-cover" />
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/[0.06] p-4">
                  <p className="text-2xl font-black text-white sm:text-3xl">{featuredProducts.length}</p>
                  <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">Featured products</p>
                </div>
                <div className="rounded-2xl bg-white/[0.06] p-4">
                  <p className="text-2xl font-black text-white sm:text-3xl">{brands.length}</p>
                  <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">Active brands</p>
                </div>
                <div className="rounded-2xl bg-white/[0.06] p-4">
                  <p className="text-2xl font-black text-white sm:text-3xl">{categories.length}</p>
                  <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">Shop categories</p>
                </div>
                <div className="rounded-2xl bg-emerald-400 p-4 text-slate-950">
                  <p className="text-sm font-black">{siteConfig.location.city}</p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-700 sm:text-xs">Serving Bangladesh</p>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-sm font-bold text-emerald-200">{siteConfig.brandPromise}</p>
                <p className="mt-2 text-[10px] leading-5 text-slate-400 sm:text-xs sm:leading-6">Clear information, practical discovery, and a storefront designed for real mobile shoppers.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Live catalogue</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">Featured products</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Only published catalogue records are shown here. When the database is empty, we keep the storefront honest.</p>
          </div>
          <Link href="/products" className="inline-flex items-center gap-2 text-sm font-black text-slate-950 transition-colors hover:text-emerald-700">
            View all products <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-8">
          {featuredProducts.length ? (
            <ProductGrid products={featuredProducts} />
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-12 text-center">
              <p className="text-lg font-black text-slate-950">The catalogue is being prepared</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">No featured products have been published yet. The storefront will update automatically as the live catalogue is populated.</p>
              <Link href="/products" className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 hover:text-slate-950">Open catalogue</Link>
            </div>
          )}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Find your fit</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">Browse by category</h2>
            </div>
            <Link href="/categories" className="hidden items-center gap-2 text-sm font-black text-slate-950 hover:text-emerald-700 sm:inline-flex">All categories <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-8">
            {categories.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {categories.slice(0, 6).map((category: StorefrontCategory) => <CategoryCard key={category.id} category={category} />)}
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Categories will appear here as soon as they are added to the live catalogue.</div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Shop by maker</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">Popular brands</h2>
          </div>
          <Link href="/brands" className="hidden items-center gap-2 text-sm font-black text-slate-950 hover:text-emerald-700 sm:inline-flex">All brands <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="mt-8">
          {brands.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {brands.slice(0, 8).map((brand: StorefrontBrand) => <BrandCard key={brand.id} brand={brand} />)}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Brands will appear here as soon as they are added to the live catalogue.</div>
          )}
        </div>
      </section>

      <section className="bg-emerald-400">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-emerald-300"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h3 className="font-black text-slate-950">Clear warranty context</h3>
              <p className="mt-1 text-sm leading-6 text-slate-800">{getStorefrontPolicySummary(settings)}. Manufacturer terms apply where applicable.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-emerald-300"><Truck className="h-5 w-5" /></div>
            <div>
              <h3 className="font-black text-slate-950">Transparent delivery guide</h3>
              <p className="mt-1 text-sm leading-6 text-slate-800">{getDeliverySummary(settings)}. Final calculation comes during checkout in a later phase.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-emerald-300"><Headphones className="h-5 w-5" /></div>
            <div>
              <h3 className="font-black text-slate-950">Local support</h3>
              <p className="mt-1 text-sm leading-6 text-slate-800">Questions? Call {siteConfig.contact.phone}. We are based in {siteConfig.location.city}.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
