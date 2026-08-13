'use client'

import { FormEvent, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, KeyRound, Loader2, ShieldCheck } from 'lucide-react'

import { authorizeActivatedOwner } from '@/lib/auth/invitation-activation-actions'
import {
  invitationActivationError,
  isValidInvitationEmail,
  isValidInvitationOtp,
  normalizeInvitationEmail,
  normalizeInvitationOtp,
} from '@/lib/auth/invitation-activation'
import { createClient } from '@/lib/supabase/client'

export default function InvitationActivationPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const normalizedEmail = normalizeInvitationEmail(email)
    const normalizedOtp = normalizeInvitationOtp(otp)

    if (!isValidInvitationEmail(normalizedEmail)) {
      setError('Enter the email address that received the invitation.')
      return
    }

    if (!isValidInvitationOtp(normalizedOtp)) {
      setError('Enter the six-digit activation code from your invitation email.')
      return
    }

    startTransition(async () => {
      const client = createClient()
      const { data, error: verificationError } = await client.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedOtp,
        type: 'invite',
      })

      if (verificationError || !data.session || !data.user) {
        setError(invitationActivationError(verificationError?.message))
        return
      }

      const authorization = await authorizeActivatedOwner()
      if (!authorization.ok) {
        setError(authorization.message)
        return
      }

      setCompleted(true)
      router.replace('/admin')
      router.refresh()
    })
  }

  return (
    <main className="grid min-h-screen bg-slate-100 px-4 py-10 sm:py-16">
      <section className="mx-auto w-full max-w-md self-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          {completed ? <CheckCircle2 className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">SahiGadget administration</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Activate your invitation</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Enter the email address that received the invitation and the six-digit code in that email. The code is verified only after you submit it here.</p>

        <form className="mt-7 space-y-5" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <label htmlFor="activation-email" className="text-sm font-semibold text-slate-800">Invitation email</label>
            <input
              id="activation-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              disabled={isPending || completed}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="activation-otp" className="text-sm font-semibold text-slate-800">Six-digit activation code</label>
            <input
              id="activation-otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              disabled={isPending || completed}
              value={otp}
              onChange={(event) => setOtp(normalizeInvitationOtp(event.target.value).replace(/\D/g, ''))}
              placeholder="123456"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-base tracking-[0.22em] outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              aria-describedby="activation-code-hint"
            />
            <p id="activation-code-hint" className="text-xs leading-5 text-slate-500">For your security, do not forward this code or enter it on any other website.</p>
          </div>

          {error ? <p role="alert" className="flex gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm leading-5 text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p> : null}

          <button type="submit" disabled={isPending || completed} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-emerald-400">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {isPending ? 'Verifying activation…' : completed ? 'Activation complete' : 'Verify and continue'}
          </button>
        </form>

        <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs leading-5 text-slate-500">Already activated? <a href="/admin/login" className="font-semibold text-emerald-700 underline-offset-4 hover:underline">Return to admin sign in</a></p>
      </section>
    </main>
  )
}
