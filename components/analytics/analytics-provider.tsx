'use client'

import { useEffect, useState } from 'react'
import { configureAnalyticsRuntime, getAnalyticsConsent, setAnalyticsConsent, trackPageView } from '@/lib/analytics/client'

type Consent = { necessary: true; analytics: boolean; marketing: boolean }

export function AnalyticsProvider({ children, runtimeConfig }: { children: React.ReactNode; runtimeConfig: { enabled: boolean; marketingEnabled: boolean; metaPixelId: string } }) {
  const [consent, setConsent] = useState<Consent | null>(null)
  useEffect(() => { configureAnalyticsRuntime(runtimeConfig); const sync = () => setConsent(getAnalyticsConsent()); window.addEventListener('sahigadget-consent-change', sync); sync(); trackPageView(); return () => window.removeEventListener('sahigadget-consent-change', sync) }, [runtimeConfig])
  return <>{children}{consent === null ? <div className="fixed bottom-4 left-4 z-50 max-w-sm rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-2xl"><p className="font-bold text-slate-900">Privacy choices</p><p className="mt-1 leading-5">Necessary commerce storage always remains active. Choose analytics and marketing separately.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setAnalyticsConsent({ necessary: true, analytics: false, marketing: false })} className="rounded-full border border-slate-300 px-3 py-2 font-bold">Essential only</button><button type="button" onClick={() => setAnalyticsConsent({ necessary: true, analytics: true, marketing: false })} className="rounded-full border border-slate-300 px-3 py-2 font-bold">Analytics only</button><button type="button" onClick={() => setAnalyticsConsent({ necessary: true, analytics: true, marketing: true })} className="rounded-full bg-slate-950 px-3 py-2 font-bold text-white">Allow all</button></div></div> : null}</>
}
