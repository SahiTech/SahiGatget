'use client'

import { useEffect, useState } from 'react'
import { getAnalyticsConsent, setAnalyticsConsent, trackPageView } from '@/lib/analytics/client'

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<'granted' | 'denied' | null>(null)
  useEffect(() => { const onConsent = () => setConsent(getAnalyticsConsent().analytics ? 'granted' : 'denied'); window.addEventListener('sahigadget-consent-change', onConsent); trackPageView(); return () => window.removeEventListener('sahigadget-consent-change', onConsent) }, [])
  return <>{children}{consent === null ? <div className="fixed bottom-4 left-4 z-50 max-w-sm rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-2xl"><p className="font-bold text-slate-900">Privacy choices</p><p className="mt-1 leading-5">Necessary commerce cookies keep cart and checkout working. Optional analytics and marketing tracking stay off until you allow them.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => { setAnalyticsConsent('denied'); setConsent('denied') }} className="rounded-full border border-slate-300 px-3 py-2 font-bold">Essential only</button><button type="button" onClick={() => { setAnalyticsConsent('granted'); setConsent('granted') }} className="rounded-full bg-slate-950 px-3 py-2 font-bold text-white">Allow analytics</button></div></div> : null}</>
}
