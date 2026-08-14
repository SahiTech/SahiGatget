'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'

function readableError(code: string | null, description: string | null) {
  if (code === 'otp_expired') return 'This invitation link has expired or was already used. Request a new invitation and open the newest link once.'
  return description?.replace(/\+/g, ' ') || 'We could not complete the authentication request. Please request a new invitation.'
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const client = createClient()
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const errorCode = searchParams.get('error_code') ?? hash.get('error_code')
    const errorDescription = searchParams.get('error_description') ?? hash.get('error_description')
    const code = searchParams.get('code')

    async function completeAuthentication() {
      if (errorCode || errorDescription) {
        if (active) setError(readableError(errorCode, errorDescription))
        return
      }

      if (code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          if (active) setError(readableError(null, exchangeError.message))
          return
        }
      }

      const { data, error: sessionError } = await client.auth.getSession()
      if (sessionError || !data.session) {
        if (active) setError(readableError(null, sessionError?.message ?? null))
        return
      }

      router.replace('/admin')
      router.refresh()
    }

    void completeAuthentication()
    return () => { active = false }
  }, [router, searchParams])

  return <main className="grid min-h-screen place-items-center bg-slate-100 px-4"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">{error ? <><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><AlertCircle className="h-6 w-6" /></span><h1 className="mt-4 text-xl font-semibold text-slate-950">Invitation could not be completed</h1><p role="alert" className="mt-3 text-sm leading-6 text-slate-600">{error}</p><a href="/admin/login" className="mt-6 inline-flex h-10 items-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">Return to admin sign in</a></> : <><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-6 w-6" /></span><h1 className="mt-4 text-xl font-semibold text-slate-950">Completing secure sign-in</h1><p className="mt-3 text-sm leading-6 text-slate-600">Your invitation is being verified with the isolated SahiGatget Auth service.</p><Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-emerald-700" /></>}</section></main>
}
