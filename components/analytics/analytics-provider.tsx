'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { DEFAULT_ANALYTICS_PROJECT_CONFIG } from '@/lib/analytics/project-config'
import { configureAnalyticsRuntime, getAnalyticsConsent, hasAnalyticsConsent, initializeGtm, isAnalyticsPageViewPathAllowed, setAnalyticsConsent, trackPageView } from '@/lib/analytics/client'

type Consent = { necessary: true; analytics: boolean; marketing: boolean }
type RuntimeConfig = { projectKey: string; currency: string; enabled: boolean; marketingEnabled: boolean; ga4MeasurementId: string; gtmContainerId: string; metaPixelId: string; tiktokPixelId: string; ga4ServerDeliveryEnabled?: boolean; eventControls: Record<string, boolean> }
const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = { ...DEFAULT_ANALYTICS_PROJECT_CONFIG, enabled: false, marketingEnabled: false, ga4MeasurementId: '', gtmContainerId: '', metaPixelId: '', tiktokPixelId: '', ga4ServerDeliveryEnabled: false, eventControls: {} }

function trackPageViewOnce(path: string | null, lastPathRef: { current: string | null }) {
  if (!path || !isAnalyticsPageViewPathAllowed(path) || !hasAnalyticsConsent()) return
  const currentConsent = getAnalyticsConsent()
  if (!currentConsent.analytics && !currentConsent.marketing) return
  if (lastPathRef.current === path) return
  trackPageView()
  lastPathRef.current = path
}

function runWhenIdle(callback: () => void, timeout = 1500) {
  if (typeof window === 'undefined') return () => undefined
  const idleWindow = window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
  if (idleWindow.requestIdleCallback) {
    const id = idleWindow.requestIdleCallback(callback, { timeout })
    return () => idleWindow.cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(callback, Math.min(timeout, 1200))
  return () => window.clearTimeout(id)
}

export function AnalyticsRuntime({ runtimeConfig = DEFAULT_RUNTIME_CONFIG }: { runtimeConfig?: RuntimeConfig }) {
  const [consent, setConsent] = useState<Consent | null>(null)
  const [showPreferences, setShowPreferences] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const pathname = usePathname()
  const currentPathRef = useRef<string | null>(pathname)
  const lastPageViewPathRef = useRef<string | null>(null)

  // Read persisted consent after hydration so the server and first client render match.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (hasAnalyticsConsent()) setConsent(getAnalyticsConsent())
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  // Next.js App Router transitions don't reload the document. Track each
  // public route explicitly so Pixel history auto-tracking can stay disabled.
  useEffect(() => {
    const previousPath = currentPathRef.current
    currentPathRef.current = pathname
    if (previousPath !== pathname && pathname) {
      const currentConsent = hasAnalyticsConsent() ? getAnalyticsConsent() : null
      if (currentConsent && (currentConsent.analytics || currentConsent.marketing) && isAnalyticsPageViewPathAllowed(pathname)) {
        trackPageView()
        lastPageViewPathRef.current = pathname
      }
    }
  }, [pathname])

  useEffect(() => {
    let cancelled = false
    let configRequestStarted = false

    const loadRuntimeConfig = () => {
      if (configRequestStarted || cancelled) return
      configRequestStarted = true
      void fetch('/api/analytics/config', { cache: 'no-store' })
        .then((response) => response.ok ? response.json() as Promise<RuntimeConfig> : null)
        .then((config: RuntimeConfig | null) => {
          if (cancelled) return
          if (!config || typeof config.enabled !== 'boolean') {
            configRequestStarted = false
            return
          }
          configureAnalyticsRuntime(config, true)
          initializeGtm()
          trackPageViewOnce(currentPathRef.current, lastPageViewPathRef)
        })
        .catch(() => { configRequestStarted = false })
    }

    const sync = () => {
      const next = hasAnalyticsConsent() ? getAnalyticsConsent() : null
      if (next && (next.analytics || next.marketing)) {
        // Dispatch promptly; browser provider calls are queued until public config
        // has loaded, so first-landing PageView/ViewContent events are not lost.
        trackPageViewOnce(currentPathRef.current, lastPageViewPathRef)
        const cancelIdle = runWhenIdle(loadRuntimeConfig, 1200)
        if (cancelled) cancelIdle()
      }
    }

    configureAnalyticsRuntime(runtimeConfig)
    sync()

    const onConsentChange = () => {
      setConsent(hasAnalyticsConsent() ? getAnalyticsConsent() : null)
      sync()
    }
    window.addEventListener('analytics-consent-change', onConsentChange)

    return () => {
      cancelled = true
      window.removeEventListener('analytics-consent-change', onConsentChange)
    }
  }, [runtimeConfig])

  const saveConsent = (next: Consent) => {
    setAnalyticsConsent(next)
    setConsent(next)
    setShowPreferences(false)
    setIsLeaving(true)
    window.setTimeout(() => setIsLeaving(false), 240)
  }

  const showBanner = consent === null || showPreferences || isLeaving

  return <>
    {showBanner ? <section
      role="dialog"
      aria-label="কুকি ও গোপনীয়তা পছন্দ"
      aria-modal="false"
      className={`fixed inset-x-3 bottom-3 z-50 mx-auto w-auto max-w-md overflow-hidden rounded-2xl border border-emerald-100 bg-white text-slate-700 shadow-[0_18px_60px_-18px_rgba(15,23,42,0.35)] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[min(25rem,calc(100vw-2rem))] ${isLeaving ? "privacy-banner-exit" : ""}`}
    >
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-lime-300" />
      <div className="privacy-banner-enter p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5c0-.6-.4-1-1-1h-1.2a2.3 2.3 0 0 1-2.3-2.3V7.5A4 4 0 0 0 12 3.5Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.8 11h.1m3.1-3.2h.1m2.2 7.1h.1m3.1-3.3h.1" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-extrabold leading-6 tracking-tight text-slate-950 sm:text-base">আপনার কেনাকাটা আরও সহজ ও ব্যক্তিগত করি</p>
            <p className="mt-1.5 text-xs leading-5 text-slate-600 sm:text-[13px]">
              সাইটের অভিজ্ঞতা উন্নত করতে, কোন পণ্য জনপ্রিয় তা বুঝতে এবং বিজ্ঞাপনের কার্যকারিতা মাপতে আমরা কুকিজ ব্যবহার করি। আপনার পছন্দ যেকোনো সময় বদলাতে পারবেন।
            </p>
          </div>
          {showPreferences ? <button type="button" onClick={() => setShowPreferences(false)} aria-label="গোপনীয়তা সেটিংস বন্ধ করুন" className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="m5 5 10 10M15 5 5 15" /></svg>
          </button> : null}
        </div>

        {showPreferences ? <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
          <p className="font-bold text-slate-800">আপনার পছন্দ বেছে নিন</p>
          <p className="mt-1">প্রয়োজনীয় কুকিজ কেনাকাটা ও নিরাপত্তার জন্য চালু থাকে। Analytics ব্যবহার বুঝতে এবং Marketing প্রাসঙ্গিক প্রচার ও বিজ্ঞাপনের ফলাফল মাপতে সাহায্য করে।</p>
        </div> : null}

        <div className="mt-4 grid grid-cols-1 gap-2">
          <button type="button" onClick={() => saveConsent({ necessary: true, analytics: true, marketing: true })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m4 10 4 4 8-8" /></svg>
            সব কুকিজ অনুমতি দিন
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => saveConsent({ necessary: true, analytics: true, marketing: false })} className="min-h-10 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              শুধু Analytics
            </button>
            <button type="button" onClick={() => saveConsent({ necessary: true, analytics: false, marketing: false })} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
              শুধু প্রয়োজনীয়
            </button>
          </div>
          {!showPreferences ? <button type="button" onClick={() => setShowPreferences(true)} className="mt-0.5 min-h-8 text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            কুকিজ কীভাবে ব্যবহার হয় জানুন
          </button> : null}
        </div>
        <p className="mt-3 text-[10px] leading-4 text-slate-400">
          আপনার পছন্দ আমাদের <a href="/privacy-policy" className="font-semibold text-slate-500 underline underline-offset-2 hover:text-emerald-700">প্রাইভেসি পলিসি</a> অনুযায়ী সংরক্ষিত হবে।
        </p>
      </div>
      <style jsx>{`
        .privacy-banner-enter { animation: privacyBannerEnter 420ms cubic-bezier(.2,.8,.2,1) both; }
        @keyframes privacyBannerEnter {
          from { opacity: 0; transform: translate3d(0, 12px, 0) scale(.985); }
          to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }
        .privacy-banner-exit { animation: privacyBannerExit 220ms ease-in forwards; pointer-events: none; }
        @keyframes privacyBannerExit {
          to { opacity: 0; transform: translate3d(0, 10px, 0) scale(.985); }
        }
        @media (prefers-reduced-motion: reduce) {
          .privacy-banner-enter, .privacy-banner-exit { animation: none; }
        }
      `}</style>
    </section> : <div className="w-full px-4 py-3 text-center"><button type="button" onClick={() => setShowPreferences(true)} aria-label="কুকি ও গোপনীয়তা পছন্দ পরিবর্তন করুন" className="inline-flex min-h-8 items-center rounded-lg px-3 py-1.5 text-[11px] font-medium text-slate-400 underline decoration-slate-200 underline-offset-4 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">কুকি ও গোপনীয়তা পছন্দ</button></div>}
  </>
}
