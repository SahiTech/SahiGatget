'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { KeyRound, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export function AdminForgotPasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  async function onSubmit(formData: FormData) {
    const email = formData.get('email') as string
    if (!email) return

    setMessage(null)
    startTransition(async () => {
      try {
        const client = createClient()
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
        
        // Use client-side reset to ensure PKCE verifier is stored in the browser
        await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${siteUrl}/auth/reset-password`,
        })
        
        // Always show success message to prevent enumeration
        setMessage('If an account exists for this email address, a password reset link has been sent.')
        setIsSubmitted(true)
      } catch {
        // Even on error, we might want to show success to prevent enumeration, 
        // but here we can show a generic error if something actually broke.
        setMessage('If an account exists for this email address, a password reset link has been sent.')
        setIsSubmitted(true)
      }
    })
  }

  return (
    <div className="space-y-6">
      {isSubmitted && message ? (
        <div className="space-y-4 rounded-2xl bg-emerald-50/80 p-6 text-emerald-900 border border-emerald-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-medium leading-relaxed">{message}</p>
          </div>
          <p className="text-xs text-emerald-700">Please check your inbox and spam folder for the recovery link. You can safely close this page or return to sign-in.</p>
          <div className="pt-2">
            <Link href="/admin/login" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-950">
              <ArrowLeft className="h-4 w-4" /> Return to admin sign in
            </Link>
          </div>
        </div>
      ) : (
        <form action={onSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <label htmlFor="reset-email" className="text-sm font-semibold text-slate-800">Admin email address</label>
            <input id="reset-email" name="email" type="email" autoComplete="email" required disabled={isPending} placeholder="name@company.com" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed" />
          </div>
          {message && !isSubmitted ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p> : null}
          <Button type="submit" disabled={isPending} className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {isPending ? 'Sending reset link…' : 'Send password recovery link'}
          </Button>
          <div className="text-center pt-2">
            <Link href="/admin/login" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition">
              <ArrowLeft className="h-3.5 w-3.5" /> Return to admin sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
