'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function PaymentStatusPage() {
  const params = useSearchParams()
  const orderId = params.get('orderId')
  const checkoutRequestId = params.get('checkoutRequestId')
  const [state, setState] = useState<'loading' | 'pending' | 'paid' | 'failed'>(orderId && checkoutRequestId ? 'loading' : 'failed')
  const [message, setMessage] = useState(orderId && checkoutRequestId ? 'We are verifying your payment securely.' : 'We could not verify this payment return. Please contact support.')

  useEffect(() => {
    if (!orderId || !checkoutRequestId) return
    let cancelled = false
    const verify = async () => {
      try {
        const response = await fetch('/api/payments/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, checkoutRequestId }), cache: 'no-store' })
        const payload = await response.json() as { ok?: boolean; data?: { status?: string }; message?: string }
        if (cancelled) return
        if (payload.data?.status === 'PAID') { setState('paid'); setMessage('Payment verified successfully. Your order is being confirmed.'); return }
        if (payload.data?.status === 'FAILED' || payload.data?.status === 'CANCELLED' || payload.data?.status === 'EXPIRED') { setState('failed'); setMessage('The payment was not completed. No order confirmation was issued.'); return }
        setState('pending'); setMessage('Payment is still being verified. Please wait a moment and try again.')
      } catch { if (!cancelled) { setState('pending'); setMessage('Payment verification is temporarily unavailable. Please try again shortly.') } }
    }
    void verify()
    return () => { cancelled = true }
  }, [checkoutRequestId, orderId])

  return <main className="min-h-screen bg-slate-50 px-4 py-16"><section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">SahiGadget secure payment</p><h1 className="mt-3 text-2xl font-semibold text-slate-950">{state === 'paid' ? 'Payment successful' : state === 'failed' ? 'Payment not completed' : 'Payment verification'}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>{state === 'pending' ? <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white">Check again</button> : null}<Link href="/" className="mt-6 block text-sm font-semibold text-emerald-700">Return to SahiGadget</Link></section></main>
}
