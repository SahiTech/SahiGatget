import { Suspense } from 'react'
import PaymentStatusClient from './payment-status-client'

function PaymentStatusFallback() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Secure payment</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Verifying payment</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Please wait while we securely verify your payment return.</p>
      </section>
    </main>
  )
}

export default function PaymentStatusPage() {
  return (
    <Suspense fallback={<PaymentStatusFallback />}>
      <PaymentStatusClient />
    </Suspense>
  )
}
