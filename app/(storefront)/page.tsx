import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BadgeCheck, CheckCircle2, Headphones, MapPin, Phone, ShieldCheck, Truck, Zap, Sparkles, PackageOpen } from 'lucide-react'

import { siteConfig } from '@/config/site'
import { BrandCard, CategoryCard } from '@/components/storefront/discovery-card'
import { ProductGrid } from '@/components/product/product-card'
import { getBrands, getCategories, getDeliverySummary, getFeaturedProducts, getProducts, getStorefrontPolicySummary, getStorefrontSettings, getStorefrontBanners, type StorefrontBrand, type StorefrontCategory, type StorefrontProduct } from '@/lib/services/storefront'
import { HeroSection } from '@/components/storefront/hero-section'

export const metadata = {
  title: 'SahiGadget — Authentic Mobile Phones & Gadgets in Bangladesh',
  description: 'Shop verified mobile phones, feature phones, smartwatches, and tech gadgets with Cash on Delivery across Bangladesh. Clear pricing and transparent warranty.',
}

export default async function HomePage() {
  const [featuredResult, allProductsResult, brands, categories, settings, banners] = await Promise.all([
    getFeaturedProducts(8),
    getProducts({ pageSize: 12 }),
    getBrands(),
    getCategories(),
    getStorefrontSettings(),
    getStorefrontBanners(),
  ])

  const allProducts = allProductsResult.products
  const featuredProducts = featuredResult.length > 0 ? featuredResult : allProducts.slice(0, 8)
  const bestDeals = allProducts.filter((p) => p.variants.some((v) => v.compare_at_price && v.compare_at_price > v.price)).slice(0, 4)

  return (
    <main className="flex-1 bg-slate-50/50">
      <HeroSection 
        banners={banners} 
        deliverySummary={getDeliverySummary(settings)} 
        policySummary={getStorefrontPolicySummary(settings)}
        productCount={allProducts.length}
        brandCount={brands.length}
        categoryCount={categories.length}
      />

      {/* 04 — TRUST / SERVICE FEATURES */}
      <section className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-4 lg:px-8">
          <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-950">Nationwide Delivery</p>
              <p className="text-xs text-slate-500">Dhaka & all 64 districts</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-950">Cash on Delivery</p>
              <p className="text-xs text-slate-500">Inspect when order arrives</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-950">Authentic Devices</p>
              <p className="text-xs text-slate-500">Genuine brand warranty</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-950">Dedicated Support</p>
              <p className="text-xs text-slate-500">{siteConfig.contact.phone}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 05 — SHOP BY CATEGORY */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Discover</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">Shop by category</h2>
          </div>
          <Link href="/categories" className="inline-flex items-center gap-2 text-sm font-black text-slate-950 transition-colors hover:text-emerald-700">
            View all categories <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-8">
          {categories.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category: StorefrontCategory) => <CategoryCard key={category.id} category={category} />)}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Categories will appear here as soon as they are added.</div>
          )}
        </div>
      </section>

      {/* 06 — FEATURED / NEW PRODUCTS */}
      <section className="bg-white py-16 border-y border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Catalogue highlight</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">Featured devices & gadgets</h2>
              <p className="mt-1 text-sm text-slate-500">Published live inventory with transparent pricing and specs.</p>
            </div>
            <Link href="/products" className="inline-flex items-center gap-2 text-sm font-black text-slate-950 transition-colors hover:text-emerald-700">
              Browse full catalogue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8">
            {featuredProducts.length ? (
              <ProductGrid products={featuredProducts} />
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
                <PackageOpen className="mx-auto h-10 w-10 text-slate-400" />
                <p className="mt-4 text-base font-black text-slate-950">Catalogue is being updated</p>
                <p className="mt-1 text-sm text-slate-500">Published products will appear here automatically.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 08 — BEST DEALS (If available) */}
      {bestDeals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-600 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Special savings
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">Best value deals</h2>
            </div>
            <Link href="/products" className="inline-flex items-center gap-2 text-sm font-black text-slate-950 transition-colors hover:text-emerald-700">
              View all deals <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8">
            <ProductGrid products={bestDeals} />
          </div>
        </section>
      )}

      {/* 10 — SHOP BY BRAND */}
      {brands.length > 0 && (
        <section className="bg-slate-900 py-16 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Trusted makers</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">Shop by brand</h2>
              </div>
              <Link href="/brands" className="inline-flex items-center gap-2 text-sm font-black text-emerald-300 transition-colors hover:text-emerald-200">
                All brands <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {brands.map((brand: StorefrontBrand) => <BrandCard key={brand.id} brand={brand} />)}
            </div>
          </div>
        </section>
      )}

      {/* 12 — HOW TO ORDER */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Simple & secure</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">How to order with Cash on Delivery</h2>
          <p className="mt-2 text-sm text-slate-500">No advance online payment needed. Order securely in minutes.</p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 relative">
            <span className="absolute right-4 top-4 text-2xl font-black text-slate-200">01</span>
            <p className="font-black text-slate-950">Browse & Choose</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Select your preferred device, colour, RAM, and storage variant from our live catalogue.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 relative">
            <span className="absolute right-4 top-4 text-2xl font-black text-slate-200">02</span>
            <p className="font-black text-slate-950">Enter Address</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Provide your name, mobile number, and complete delivery address in Bangladesh.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 relative">
            <span className="absolute right-4 top-4 text-2xl font-black text-slate-200">03</span>
            <p className="font-black text-slate-950">Confirm COD Order</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Review your subtotal and delivery fee, then place your verified Cash on Delivery order.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 relative">
            <span className="absolute right-4 top-4 text-2xl font-black text-slate-200">04</span>
            <p className="font-black text-slate-950">Receive & Pay</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Our courier delivers your order safely to your door. Pay in cash upon receipt.</p>
          </div>
        </div>
      </section>

      {/* 13 — CUSTOMER SUPPORT CTA & HELP */}
      <section className="bg-emerald-500 py-12 text-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-900">Need assistance?</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Have questions about a product or order?</h2>
            <p className="mt-1 text-sm text-slate-900">Our support team is ready to help you every day.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={`tel:${siteConfig.contact.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-black text-white transition hover:bg-slate-800">
              <Phone className="h-4 w-4 text-emerald-400" /> Call {siteConfig.contact.phone}
            </a>
            <Link href="/track-order" className="inline-flex items-center gap-2 rounded-full border border-slate-950 bg-white px-6 py-3.5 text-sm font-black text-slate-950 transition hover:bg-slate-100">
              Track an order
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
