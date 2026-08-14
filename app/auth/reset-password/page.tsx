'use client'

import { FormEvent, useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Lock, ShieldCheck } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'

function readableError(code: string | null, description: string | null) {
  if (code === 'otp_expired' || description?.toLowerCase().includes('expired') || description?.toLowerCase().includes('invalid')) {
    return 'This password recovery link has expired or was already used. Please request a new password recovery link from the admin sign-in page.'
  }
  return description?.replace(/\+/g, ' ') || 'We could not complete the password recovery request. Please request a new recovery link.'
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    let active = true
    const client = createClient()
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const errorCode = searchParams.get('error_code') ?? hash.get('error_code')
    const errorDescription = searchParams.get('error_description') ?? hash.get('error_description')
    const code = searchParams.get('code')
    const accessToken = hash.get('access_token')
    const refreshToken = hash.get('refresh_token')

    async function initializeRecoverySession() {
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
      } else if (accessToken && refreshToken) {
        const { error: setSessionError } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (setSessionError) {
          if (active) setError(readableError(null, setSessionError.message))
          return
        }
      }

      const { data, error: sessionError } = await client.auth.getSession()
      if (sessionError || !data.session) {
        if (active) {
          setError('No active recovery session found. Please request a fresh password recovery link.')
        }
        return
      }

      if (active) {
        setSessionReady(true)
      }
    }

    void initializeRecoverySession()
    return () => { active = false }
  }, [searchParams])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your new password.')
      return
    }

    startTransition(async () => {
      const client = createClient()
      const { error: updateError } = await client.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(readableError(null, updateError.message))
        return
      }

      setSuccess(true)
      await client.auth.signOut()
      setTimeout(() => {
        router.replace('/admin/login')
        router.refresh()
      }, 2500)
    })
  }

  return (
    <main className="grid min-h-screen bg-slate-100 px-4 py-10 sm:py-16">
      <section className="mx-auto w-full max-w-md self-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          {success ? <CheckCircle2 className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">SahiGadget administration</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Set new password</h1>
        
        {error && !sessionReady ? (
          <div className="mt-6 space-y-4">
            <p role="alert" className="flex gap-2 rounded-lg bg-rose-50 px-3 py-3 text-sm leading-6 text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>
            <a href="/admin/login" className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">Return to admin sign in</a>
          </div>
        ) : !sessionReady ? (
          <div className="mt-8 space-y-4 text-center">
            <p className="text-sm text-slate-600">Verifying your recovery session...</p>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" />
          </div>
        ) : success ? (
          <div className="mt-6 space-y-4 text-center">
            <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">Password updated successfully!</p>
              <p className="mt-1 text-xs text-emerald-700">Redirecting you to admin sign in...</p>
            </div>
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-emerald-700" />
          </div>
        ) : (
          <form className="mt-7 space-y-5" onSubmit={onSubmit} noValidate>
            <p className="text-sm leading-6 text-slate-600">Please enter your new secure password below.</p>
            
            <div className="space-y-2">
              <label htmlFor="new-password" className="text-sm font-semibold text-slate-800">New password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  disabled={isPending}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-sm font-semibold text-slate-800">Confirm new password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  disabled={isPending}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter new password"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
            </div>

            {error ? <p role="alert" className="flex gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm leading-5 text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p> : null}

            <button type="submit" disabled={isPending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-emerald-400">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {isPending ? 'Updating password…' : 'Update password and sign in'}
            </button>
          </form>
        )}

        <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs leading-5 text-slate-500">Remembered your password? <a href="/admin/login" className="font-semibold text-emerald-700 underline-offset-4 hover:underline">Return to admin sign in</a></p>
      </section>
    </main>
  )
}
