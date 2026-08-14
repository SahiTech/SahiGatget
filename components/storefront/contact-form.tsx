'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { submitSupportRequest, type SupportActionState } from '@/lib/support/actions'

const initialState: SupportActionState = { ok: false, message: '' }

function SubmitButton() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-6 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">{pending ? 'Sending request…' : 'Send support request'}</button>
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs font-semibold text-rose-600">{message}</p> : null
}

export function ContactForm() {
  const [state, action] = useActionState(submitSupportRequest, initialState)
  return (
    <form action={action} className="grid gap-5" aria-label="Customer support request form">
      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-slate-800">Full name<input name="full_name" required maxLength={120} autoComplete="name" className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 font-normal outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="Your full name" /> <FieldError message={state.fieldErrors?.full_name} /></label>
        <label className="grid gap-2 text-sm font-bold text-slate-800">Phone<input name="phone" required maxLength={30} autoComplete="tel" className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 font-normal outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="01XXXXXXXXX" /> <FieldError message={state.fieldErrors?.phone} /></label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-slate-800">Email<input name="email" required type="email" maxLength={254} autoComplete="email" className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 font-normal outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="you@example.com" /> <FieldError message={state.fieldErrors?.email} /></label>
        <label className="grid gap-2 text-sm font-bold text-slate-800">Order number <span className="font-normal text-slate-500">(optional)</span><input name="order_number" maxLength={80} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 font-normal outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="For order-related help" /></label>
      </div>
      <label className="grid gap-2 text-sm font-bold text-slate-800">Subject<input name="subject" required maxLength={160} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 font-normal outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="How can we help?" /> <FieldError message={state.fieldErrors?.subject} /></label>
      <label className="grid gap-2 text-sm font-bold text-slate-800">Message<textarea name="message" required minLength={10} maxLength={5000} rows={6} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-normal outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="Tell us what happened and what support you need." /> <FieldError message={state.fieldErrors?.message} /></label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-slate-500">Please avoid sending passwords, payment details, or other sensitive information.</p><SubmitButton /></div>
      {state.message && <p role="status" aria-live="polite" className={`rounded-2xl px-4 py-3 text-sm font-semibold ${state.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{state.message}</p>}
    </form>
  )
}
