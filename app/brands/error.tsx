'use client'

import { RefreshCw } from 'lucide-react'

export default function BrandsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="flex flex-1 items-center justify-center px-4 py-20"><div className="max-w-md rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><RefreshCw className="h-5 w-5" /></div><h1 className="mt-5 text-2xl font-black text-slate-950">Brands temporarily unavailable</h1><p className="mt-3 text-sm leading-6 text-slate-500">We could not load active brands right now. Please try again.</p><button type="button" onClick={reset} className="mt-6 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 hover:text-slate-950">Try again</button></div></main> }
