'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { HomepageBanner } from '@/lib/services/storefront-utils'
import { siteConfig } from '@/config/site'

type HeroSectionProps = { banners: HomepageBanner[]; productCount: number; brandCount: number; categoryCount: number }

const AUTOPLAY_DELAY = 5200
const RESUME_DELAY = 7000
const SWIPE_THRESHOLD = 48

export function HeroSection({ banners, productCount, brandCount, categoryCount }: HeroSectionProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [isInteracting, setIsInteracting] = useState(false)
  const [loadedSlides, setLoadedSlides] = useState<Set<string>>(() => new Set())
  const resumeTimeoutRef = useRef<number | null>(null)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)

  const clearResumeTimeout = useCallback(() => {
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current)
      resumeTimeoutRef.current = null
    }
  }, [])

  const scheduleResume = useCallback(() => {
    clearResumeTimeout()
    resumeTimeoutRef.current = window.setTimeout(() => {
      setIsInteracting(false)
      resumeTimeoutRef.current = null
    }, RESUME_DELAY)
  }, [clearResumeTimeout])

  const moveTo = useCallback((index: number, resumeAfterInteraction = false) => {
    if (banners.length <= 1) return
    setCurrentSlide((index + banners.length) % banners.length)
    if (resumeAfterInteraction) {
      setIsInteracting(true)
      scheduleResume()
    }
  }, [banners.length, scheduleResume])

  const moveBy = useCallback((direction: number) => {
    moveTo(currentSlide + direction, true)
  }, [currentSlide, moveTo])

  useEffect(() => {
    if (banners.length <= 1 || isHovered || isInteracting) return
    const interval = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length)
    }, AUTOPLAY_DELAY)
    return () => window.clearInterval(interval)
  }, [banners.length, isHovered, isInteracting])

  useEffect(() => {
    return () => clearResumeTimeout()
  }, [clearResumeTimeout])

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
  const previousIndex = (activeIndex - 1 + banners.length) % banners.length
  const nextIndex = (activeIndex + 1) % banners.length
  const visibleIndexes = new Set([activeIndex, previousIndex, nextIndex])

  function markLoaded(id: string) {
    setLoadedSlides((previous) => {
      if (previous.has(id)) return previous
      const next = new Set(previous)
      next.add(id)
      return next
    })
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerStartRef.current = { x: event.clientX, y: event.clientY }
    setIsInteracting(true)
    clearResumeTimeout()
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
      suppressClickRef.current = true
      moveBy(deltaX < 0 ? 1 : -1)
      window.setTimeout(() => { suppressClickRef.current = false }, 0)
    } else {
      scheduleResume()
    }
  }

  function handlePointerCancel() {
    pointerStartRef.current = null
    scheduleResume()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      moveBy(-1)
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      moveBy(1)
    }
  }

  return (
    <section aria-label="Promotional banners" className="bg-slate-950">
      <div
        className="group relative mx-auto aspect-[2.8/1] min-h-[142px] w-full max-w-[1920px] touch-pan-y select-none overflow-hidden rounded-none bg-slate-900 shadow-[0_18px_48px_-30px_rgba(15,23,42,0.85)] sm:min-h-[210px] sm:rounded-b-2xl lg:rounded-2xl"
        role="region"
        aria-roledescription="carousel"
        aria-label={`Promotional banner ${activeIndex + 1} of ${banners.length}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault()
            event.stopPropagation()
            suppressClickRef.current = false
          }
        }}
      >
        <div className="absolute inset-0 bg-slate-800" aria-hidden="true">
          <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.04),rgba(255,255,255,0.12),rgba(255,255,255,0.04))]" />
          <div className="motion-safe:animate-[loading-progress_1.8s_ease-in-out_infinite] motion-reduce:animate-none absolute inset-y-0 left-0 w-1/2 bg-white/10 blur-2xl" />
        </div>

        {banners.map((banner, idx) => {
          if (!visibleIndexes.has(idx)) return null
          const isActive = idx === activeIndex
          const isLoaded = loadedSlides.has(banner.id)
          return (
            <div key={banner.id} aria-hidden={!isActive} className={`absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none ${isActive ? 'z-10 opacity-100' : 'z-0 opacity-0'}`}>
              <Image
                src={banner.desktop_image_url || banner.mobile_image_url}
                alt=""
                fill
                sizes="100vw"
                priority={idx === 0}
                loading={idx === 0 ? 'eager' : 'lazy'}
                quality={82}
                onLoad={() => markLoaded(banner.id)}
                className={`object-cover transition-opacity duration-500 motion-reduce:transition-none ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
            </div>
          )
        })}

        <Link href={destination} aria-label={`Open promotion ${activeIndex + 1}`} className="absolute inset-0 z-20 block cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-emerald-300">
          <span className="sr-only">Open promotion</span>
        </Link>

        {banners.length > 1 ? (
          <>
            <button type="button" aria-label="Previous banner" onClick={(event) => { event.stopPropagation(); moveBy(-1) }} className="absolute left-2 top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-slate-950/35 text-white backdrop-blur transition hover:bg-slate-950/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 sm:flex sm:opacity-0 sm:group-hover:opacity-100">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Next banner" onClick={(event) => { event.stopPropagation(); moveBy(1) }} className="absolute right-2 top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-slate-950/35 text-white backdrop-blur transition hover:bg-slate-950/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 sm:flex sm:opacity-0 sm:group-hover:opacity-100">
              <ArrowRight className="h-4 w-4" />
            </button>
            <div className="absolute inset-x-0 bottom-3 z-30 flex justify-center gap-2 sm:bottom-4" aria-label="Choose banner">
              {banners.map((banner, idx) => (
                <button key={banner.id} type="button" aria-label={`Show banner ${idx + 1}`} aria-current={idx === activeIndex ? 'true' : undefined} onClick={(event) => { event.stopPropagation(); moveTo(idx, true) }} className={`h-2 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 motion-reduce:transition-none ${idx === activeIndex ? 'w-8 bg-white shadow-sm' : 'w-2 bg-white/50 hover:bg-white/80'}`} />
              ))}
            </div>
            <span className="sr-only" aria-live="polite">Showing banner {activeIndex + 1} of {banners.length}</span>
          </>
        ) : null}
      </div>
    </section>
  )
}

function StatsCard({ productCount, brandCount, categoryCount }: { productCount: number; brandCount: number; categoryCount: number }) {
  return <div className="relative mx-auto w-full max-w-md lg:ml-auto"><div className="absolute -inset-4 rounded-[2.5rem] bg-emerald-400/10 blur-2xl" /><div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7"><div className="flex items-center justify-between border-b border-white/10 pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 sm:text-xs">Store snapshot</p><p className="mt-1 text-2xl font-black tracking-tight">{siteConfig.name}</p></div><div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 shadow-md"><Image src="/logo.png" alt="SahiGadget Logo" width={48} height={48} className="h-full w-full object-cover" /></div></div><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/[0.06] p-4"><p className="text-2xl font-black text-white sm:text-3xl">{productCount}</p><p className="mt-1 text-[10px] text-slate-300 sm:text-xs">Active products</p></div><div className="rounded-2xl bg-white/[0.06] p-4"><p className="text-2xl font-black text-white sm:text-3xl">{brandCount}</p><p className="mt-1 text-[10px] text-slate-300 sm:text-xs">Verified brands</p></div><div className="rounded-2xl bg-white/[0.06] p-4"><p className="text-2xl font-black text-white sm:text-3xl">{categoryCount}</p><p className="mt-1 text-[10px] text-slate-300 sm:text-xs">Categories</p></div><div className="rounded-2xl bg-emerald-400 p-4 text-slate-950"><p className="text-xs font-bold uppercase tracking-wider text-slate-800">Support</p><p className="mt-1 truncate text-xs font-black">{siteConfig.contact.phone}</p></div></div><div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4"><p className="text-xs font-bold text-emerald-200">{siteConfig.brandPromise}</p><p className="mt-1.5 text-[10px] leading-5 text-slate-300">Clear specs, valid warranty terms, and prompt delivery across Bangladesh.</p></div></div></div>
}
