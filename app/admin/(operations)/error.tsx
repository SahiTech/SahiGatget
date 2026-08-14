'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function AdminOperationsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {}, [])
  return <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><AlertCircle className="h-5 w-5" /></div><h2 className="mt-4 text-lg font-semibold text-slate-950">Administrative data could not be loaded</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">No changes were made. Verify your access and try again.</p><button onClick={() => reset()} className="mx-auto mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" />Try again</button></div>
}
