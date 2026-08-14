'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LockKeyhole, Loader2 } from 'lucide-react'

import { signInAdmin } from '@/lib/admin/actions'
import { Button } from '@/components/ui/button'

export function AdminLoginForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const result = await signInAdmin({
        email: formData.get('email'),
        password: formData.get('password'),
      })
      if (!result.ok) {
        setMessage(result.message)
        return
      }
      router.replace('/admin')
      router.refresh()
    })
  }

  return (
    <form action={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="admin-email" className="text-sm font-semibold text-slate-800">Admin email</label>
        <input id="admin-email" name="email" type="email" autoComplete="email" required disabled={isPending} placeholder="name@company.com" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="admin-password" className="text-sm font-semibold text-slate-800">Password</label>
          <Link href="/admin/forgot-password" tabIndex={-1} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">Forgot password?</Link>
        </div>
        <input id="admin-password" name="password" type="password" autoComplete="current-password" required disabled={isPending} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed" />
      </div>
      {message ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p> : null}
      <Button type="submit" disabled={isPending} className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
        {isPending ? 'Signing in…' : 'Sign in securely'}
      </Button>
      <p className="text-center text-xs leading-5 text-slate-500">This restricted area uses Supabase Auth. Only active SahiGadget administration records can continue.</p>
    </form>
  )
}
