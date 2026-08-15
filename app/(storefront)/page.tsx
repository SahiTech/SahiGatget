import Link from 'next/link'
import { ArrowRight, Sparkles, PackageOpen, Phone } from 'lucide-react'

import { siteConfig } from '@/config/site'
import { BrandCard, CategoryCard } from '@/components/storefront/discovery-card'
import { ProductGrid } from '@/components/product/product-card'
import { getBrands, getCategories, getFeaturedProducts, getProducts, getStorefrontBanners, type StorefrontBrand, type StorefrontCategory } from '@/lib/services/storefront'
import { HeroSection } from '@/components/storefront/hero-section'
import { TrustStrip } from '@/components/storefront/trust-strip'

export const metadata = {
  title: 'SahiGadget — Authentic Mobile Phones & Gadgets in Bangladesh',
  description: 'Shop verified mobile phones, feature phones, smartwatches, and tech gadgets with Cash on Delivery across Bangladesh. Clear pricing and transparent warranty.',
}

export default async function HomePage() {
  const [featuredResult, allProductsResult, brands, categories, banners] = await Promise.all([
    getFeaturedProducts(8),
    getProducts({ pageSize: 12 }),
    getBrands(),
    getCategories(),
    getStorefrontBanners(),
  ])

  const allProducts = allProductsResult.products
  const featuredProducts = featuredResult.length > 0 ? featuredResult : allProducts.slice(0, 8)
  const bestDeals = allProducts.filter((p) => p.variants.some((v) => v.compare_at_price && v.compare_at_price > v.price)).slice(0, 4)

  return (
    <main className="flex-1 bg-slate-50/50">
      <HeroSection banners={banners} productCount={allProducts.length} brandCount={brands.length} categoryCount={categories.length} />
      <TrustStrip />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Discover</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">Shop by category</h2></div><Link href="/categories" className="inline-flex items-center gap-2 text-sm font-black text-slate-950 transition-colors hover:text-emerald-700">View all categories <ArrowRight className="h-4 w-4" /></Link></div><div className="mt-8">{categories.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category: StorefrontCategory) => <CategoryCard key={category.id} category={category} />)}</div> : <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Categories will appear here as soon as they are added.</div>}</div></section>

      <section className="border-y border-slate-200 bg-white py-16"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Catalogue highlight</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">Featured devices & gadgets</h2><p className="mt-1 text-sm text-slate-500">Published live inventory with transparent pricing and specs.</p></div><Link href="/products" className="inline-flex items-center gap-2 text-sm font-black text-slate-950 hover:text-emerald-700">Browse full catalogue <ArrowRight className="h-4 w-4" /></Link></div><div className="mt-8">{featuredProducts.length ? <ProductGrid products={featuredProducts} /> : <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-12 text-center"><PackageOpen className="mx-auto h-10 w-10 text-slate-400" /><p className="mt-4 text-base font-black text-slate-950">Catalogue is being updated</p><p className="mt-1 text-sm text-slate-500">Published products will appear here automatically.</p></div>}</div></div></section>

      {bestDeals.length > 0 && <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.2em] text-rose-600"><Sparkles className="h-3.5 w-3.5" /> Special savings</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">Best value deals</h2></div><Link href="/products" className="inline-flex items-center gap-2 text-sm font-black text-slate-950 hover:text-emerald-700">View all deals <ArrowRight className="h-4 w-4" /></Link></div><div className="mt-8"><ProductGrid products={bestDeals} /></div></section>}

      {brands.length > 0 && <section className="bg-slate-900 py-16 text-white"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Trusted makers</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">Shop by brand</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Explore active makers with clear catalogue paths, recognizable logos, and products ready for delivery across Bangladesh.</p></div><Link href="/brands" className="inline-flex items-center gap-2 text-sm font-black text-emerald-300 hover:text-emerald-200">All brands <ArrowRight className="h-4 w-4" /></Link></div><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{brands.map((brand: StorefrontBrand) => <BrandCard key={brand.id} brand={brand} />)}</div></div></section>}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-2xl text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Simple & secure</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">How to order with Cash on Delivery</h2><p className="mt-2 text-sm text-slate-500">No advance online payment needed. Order securely in minutes.</p></div><div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{['Browse & Choose','Enter Address','Confirm COD Order','Receive & Pay'].map((title, index) => <div key={title} className="relative rounded-2xl border border-slate-200 bg-white p-6"><span className="absolute right-4 top-4 text-2xl font-black text-slate-200">0{index + 1}</span><p className="font-black text-slate-950">{title}</p><p className="mt-2 text-xs leading-5 text-slate-500">{['Select your preferred device, colour, RAM, and storage variant from our live catalogue.','Provide your name, mobile number, and complete delivery address in Bangladesh.','Review your subtotal and delivery fee, then place your verified Cash on Delivery order.','Our courier delivers your order safely to your door. Pay in cash upon receipt.'][index]}</p></div>)}</div></section>

      <section className="bg-emerald-500 py-12 text-slate-950"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-900">Need assistance?</p><h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Have questions about a product or order?</h2><p className="mt-1 text-sm text-slate-900">Our support team is ready to help you every day.</p></div><div className="flex flex-wrap gap-3"><a href={`tel:${siteConfig.contact.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-black text-white hover:bg-slate-800"><Phone className="h-4 w-4 text-emerald-400" /> Call {siteConfig.contact.phone}</a><Link href="/track-order" className="inline-flex items-center gap-2 rounded-full border border-slate-950 bg-white px-6 py-3.5 text-sm font-black text-slate-950 hover:bg-slate-100">Track an order</Link></div></div></section>
    </main>
  )
}
