'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { HomepageBanner } from '@/lib/services/storefront-utils'
import { siteConfig } from '@/config/site'

type HeroSectionProps = { banners: HomepageBanner[]; productCount: number; brandCount: number; categoryCount: number }

export function HeroSection({ banners, productCount, brandCount, categoryCount }: HeroSectionProps) {
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    if (banners.length <= 1) return
    const interval = window.setInterval(() => setCurrentSlide((prev) => (prev + 1) % banners.length), 6000)
    return () => window.clearInterval(interval)
  }, [banners.length])

  if (banners.length === 0) {
    return (
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(16,185,129,0.22),transparent_35%),radial-gradient(circle_at_10%_90%,rgba(14,165,233,0.18),transparent_35%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <div><div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300 sm:text-xs"><Zap className="h-3.5 w-3.5" /> Trusted mobile & gadget store in Bangladesh</div><h1 className="mt-6 max-w-3xl text-3xl font-black leading-[1.05] tracking-[-0.05em] sm:text-5xl md:text-6xl lg:text-7xl">Authentic devices.<br /><span className="text-emerald-300">Clear pricing. No guesswork.</span></h1><p className="mt-6 max-w-xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">{siteConfig.tagline}. {siteConfig.brandPromise}. Explore verified mobile phones, feature phones, and smart wearables with secure Cash on Delivery nationwide.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/products" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-emerald-400 px-7 text-sm font-black text-slate-950 hover:bg-emerald-300">Explore catalogue <ArrowRight className="h-4 w-4" /></Link><Link href="/categories" className="inline-flex min-h-12 items-center rounded-full border border-slate-700 px-7 text-sm font-bold text-white hover:bg-white/5">Browse categories</Link></div></div>
          <StatsCard productCount={productCount} brandCount={brandCount} categoryCount={categoryCount} />
        </div>
      </section>
    )
  }

  const activeIndex = Math.min(currentSlide, banners.length - 1)
  const activeBanner = banners[activeIndex]
  const destination = activeBanner.primary_cta_url?.trim() || '/products'

  return (
    <section aria-label="Promotional banners" className="bg-slate-950">
      <div className="relative mx-auto aspect-[2.8/1] min-h-[140px] w-full max-w-[1920px] overflow-hidden bg-slate-950 sm:min-h-[210px]">
        {banners.map((banner, idx) => <div key={banner.id} aria-hidden={idx !== activeIndex} className={`absolute inset-0 transition-opacity duration-500 ease-out ${idx === activeIndex ? 'z-10 opacity-100' : 'z-0 opacity-0'}`}><Image src={banner.desktop_image_url} alt="" fill sizes="100vw" priority={idx === 0} loading={idx === 0 ? 'eager' : 'lazy'} quality={82} className="object-cover" /></div>)}
        <Link href={destination} aria-label="Open this promotion" className="absolute inset-0 z-20 block cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-emerald-300"><span className="sr-only">Open promotion</span></Link>
        {banners.length > 1 ? <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center gap-1.5 sm:bottom-4" aria-hidden="true">{banners.map((banner, idx) => <span key={banner.id} className={`h-1 rounded-full transition-all ${idx === activeIndex ? 'w-6 bg-white/90' : 'w-2 bg-white/45'}`} />)}</div> : null}
      </div>
    </section>
  )
}

function StatsCard({ productCount, brandCount, categoryCount }: { productCount: number; brandCount: number; categoryCount: number }) {
  return <div className="relative mx-auto w-full max-w-md lg:ml-auto"><div className="absolute -inset-4 rounded-[2.5rem] bg-emerald-400/10 blur-2xl" /><div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7"><div className="flex items-center justify-between border-b border-white/10 pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 sm:text-xs">Store snapshot</p><p className="mt-1 text-2xl font-black tracking-tight">{siteConfig.name}</p></div><div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 shadow-md"><Image src="/logo.png" alt="SahiGadget Logo" width={48} height={48} className="h-full w-full object-cover" /></div></div><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/[0.06] p-4"><p className="text-2xl font-black text-white sm:text-3xl">{productCount}</p><p className="mt-1 text-[10px] text-slate-300 sm:text-xs">Active products</p></div><div className="rounded-2xl bg-white/[0.06] p-4"><p className="text-2xl font-black text-white sm:text-3xl">{brandCount}</p><p className="mt-1 text-[10px] text-slate-300 sm:text-xs">Verified brands</p></div><div className="rounded-2xl bg-white/[0.06] p-4"><p className="text-2xl font-black text-white sm:text-3xl">{categoryCount}</p><p className="mt-1 text-[10px] text-slate-300 sm:text-xs">Categories</p></div><div className="rounded-2xl bg-emerald-400 p-4 text-slate-950"><p className="text-xs font-bold uppercase tracking-wider text-slate-800">Support</p><p className="mt-1 truncate text-xs font-black">{siteConfig.contact.phone}</p></div></div><div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4"><p className="text-xs font-bold text-emerald-200">{siteConfig.brandPromise}</p><p className="mt-1.5 text-[10px] leading-5 text-slate-300">Clear specs, valid warranty terms, and prompt delivery across Bangladesh.</p></div></div></div>
}
