export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import AuthCallbackClient from './auth-callback-client'

function AuthCallbackFallback() {
  return <main className="grid min-h-screen place-items-center bg-slate-100 px-4"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><span className="text-lg">✓</span></span><h1 className="mt-4 text-xl font-semibold text-slate-950">Completing secure sign-in</h1><p className="mt-3 text-sm leading-6 text-slate-600">Your invitation is being verified.</p></section></main>
}

export default function AuthCallbackPage() {
  return <Suspense fallback={<AuthCallbackFallback />}><AuthCallbackClient /></Suspense>
}
