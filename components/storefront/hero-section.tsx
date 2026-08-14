'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BadgeCheck, ShieldCheck, Truck, Zap } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { HomepageBanner } from '@/lib/services/storefront-utils'
import { siteConfig } from '@/config/site'

export function HeroSection({ banners, deliverySummary, policySummary, productCount, brandCount, categoryCount }: { 
  banners: HomepageBanner[]; 
  deliverySummary: string;
  policySummary: string;
  productCount: number;
  brandCount: number;
  categoryCount: number;
}) {
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    if (banners.length <= 1) return
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [banners.length])

  // Fallback Hero if no banners exist
  if (banners.length === 0) {
    return (
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(16,185,129,0.22),transparent_35%),radial-gradient(circle_at_10%_90%,rgba(14,165,233,0.18),transparent_35%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300 sm:text-xs">
              <Zap className="h-3.5 w-3.5" /> Trusted mobile & gadget store in Bangladesh
            </div>
            <h1 className="mt-6 max-w-3xl text-3xl font-black leading-[1.05] tracking-[-0.05em] sm:text-5xl md:text-6xl lg:text-7xl">
              Authentic devices.<br />
              <span className="text-emerald-300">Clear pricing. No guesswork.</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
              {siteConfig.tagline}. {siteConfig.brandPromise}. Explore verified mobile phones, feature phones, and smart wearables with secure Cash on Delivery nationwide.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-emerald-400 px-7 text-sm font-black text-slate-950 transition-colors hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">
                Explore catalogue <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/categories" className="inline-flex min-h-12 items-center rounded-full border border-slate-700 px-7 text-sm font-bold text-white transition-colors hover:border-slate-400 hover:bg-white/5">
                Browse categories
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-[10px] font-semibold text-slate-400 sm:text-xs">
              <span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-emerald-300" />Cash on Delivery</span>
              <span className="flex items-center gap-2"><Truck className="h-4 w-4 text-emerald-300" />{deliverySummary}</span>
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" />{policySummary}</span>
            </div>
          </div>
          <StatsCard productCount={productCount} brandCount={brandCount} categoryCount={categoryCount} />
        </div>
      </section>
    )
  }

  const activeBanner = banners[currentSlide]

  return (
    <section className="relative overflow-hidden bg-slate-950 text-white min-h-[500px] flex items-center">
      {/* Background Images */}
      {banners.map((banner, idx) => (
        <div 
          key={banner.id} 
          className={`absolute inset-0 transition-opacity duration-1000 ${idx === currentSlide ? 'opacity-100' : 'opacity-0'}`}
        >
          {/* Desktop Image */}
          <div className="hidden md:block absolute inset-0">
            <img src={banner.desktop_image_url} alt="" className="h-full w-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
          </div>
          {/* Mobile Image */}
          <div className="md:hidden absolute inset-0">
            <img src={banner.mobile_image_url} alt="" className="h-full w-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/90 to-slate-950" />
          </div>
        </div>
      ))}

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24 w-full">
        <div className="transition-all duration-500 transform translate-y-0 opacity-100">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300 sm:text-xs">
            <Zap className="h-3.5 w-3.5" /> Featured Highlight
          </div>
          <h1 className="mt-6 max-w-3xl text-3xl font-black leading-[1.05] tracking-[-0.05em] sm:text-5xl md:text-6xl lg:text-7xl">
            {activeBanner.heading}
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
            {activeBanner.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={activeBanner.primary_cta_url} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-emerald-400 px-7 text-sm font-black text-slate-950 transition-colors hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">
              {activeBanner.primary_cta_text} <ArrowRight className="h-4 w-4" />
            </Link>
            {activeBanner.secondary_cta_text && activeBanner.secondary_cta_url && (
              <Link href={activeBanner.secondary_cta_url} className="inline-flex min-h-12 items-center rounded-full border border-slate-700 px-7 text-sm font-bold text-white transition-colors hover:border-slate-400 hover:bg-white/5">
                {activeBanner.secondary_cta_text}
              </Link>
            )}
          </div>
          
          {/* Pagination dots if multiple banners */}
          {banners.length > 1 && (
            <div className="mt-10 flex gap-2">
              {banners.map((_, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-1.5 rounded-full transition-all ${idx === currentSlide ? 'w-8 bg-emerald-400' : 'w-2 bg-slate-700 hover:bg-slate-500'}`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
        
        <div className="hidden lg:block">
          <StatsCard productCount={productCount} brandCount={brandCount} categoryCount={categoryCount} />
        </div>
      </div>
    </section>
  )
}

function StatsCard({ productCount, brandCount, categoryCount }: { productCount: number; brandCount: number; categoryCount: number }) {
  return (
    <div className="relative mx-auto w-full max-w-md lg:ml-auto">
      <div className="absolute -inset-4 rounded-[2.5rem] bg-emerald-400/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-7">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 sm:text-xs">Store snapshot</p>
            <p className="mt-1 text-2xl font-black tracking-tight">{siteConfig.name}</p>
          </div>
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 shadow-md">
            <Image src="/logo.png" alt="SahiGadget Logo" width={48} height={48} className="h-full w-full object-cover" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/[0.06] p-4">
            <p className="text-2xl font-black text-white sm:text-3xl">{productCount}</p>
            <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">Active products</p>
          </div>
          <div className="rounded-2xl bg-white/[0.06] p-4">
            <p className="text-2xl font-black text-white sm:text-3xl">{brandCount}</p>
            <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">Verified brands</p>
          </div>
          <div className="rounded-2xl bg-white/[0.06] p-4">
            <p className="text-2xl font-black text-white sm:text-3xl">{categoryCount}</p>
            <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">Categories</p>
          </div>
          <div className="rounded-2xl bg-emerald-400 p-4 text-slate-950">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-800">Support</p>
            <p className="mt-1 text-xs font-black truncate">{siteConfig.contact.phone}</p>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
          <p className="text-xs font-bold text-emerald-200">{siteConfig.brandPromise}</p>
          <p className="mt-1.5 text-[10px] leading-5 text-slate-400">Clear specs, valid warranty terms, and prompt delivery across Bangladesh.</p>
        </div>
      </div>
    </div>
  )
}
