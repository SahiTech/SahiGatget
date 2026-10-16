import { Suspense } from 'react'
import ResetPasswordClient from './reset-password-client'

function ResetPasswordFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">Verifying recovery session</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Please wait while your secure password recovery link is verified.</p>
      </section>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordClient />
    </Suspense>
  )
}
