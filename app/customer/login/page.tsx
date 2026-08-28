import Link from 'next/link'
import { Chrome, Facebook, ShoppingBag } from 'lucide-react'

import { signInCustomer } from '@/lib/customer/actions'

export const dynamic = 'force-dynamic'

type CustomerLoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>
}

function safeNext(value?: string) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/cart'
}

export default async function CustomerLoginPage({ searchParams }: CustomerLoginPageProps) {
  const params = await searchParams
  const next = safeNext(params.next)
  const hasError = params.error === 'oauth'

  return (
    <main className="min-h-[70vh] bg-slate-50 px-4 py-12 sm:py-16">
      <section className="mx-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <div className="bg-slate-950 px-6 py-8 text-white sm:px-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-emerald-300">SahiGadget account</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Sign in to your account</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Sign in to use your cart and keep your shopping activity connected to your account.</p>
        </div>

        <div className="p-6 sm:p-8">
          {hasError ? <div role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-700">We could not start secure sign-in. Please try again.</div> : null}

          <div className="space-y-3">
            <form action={signInCustomer}>
              <input type="hidden" name="provider" value="google" />
              <input type="hidden" name="next" value={next} />
              <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100">
                <Chrome className="h-5 w-5" /> Continue with Google
              </button>
            </form>

            <form action={signInCustomer}>
              <input type="hidden" name="provider" value="facebook" />
              <input type="hidden" name="next" value={next} />
              <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl bg-[#1877F2] px-4 py-3 text-sm font-black text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
                <Facebook className="h-5 w-5" /> Continue with Facebook
              </button>
            </form>
          </div>

          <div className="my-7 flex items-center gap-3 text-xs font-semibold text-slate-400"><span className="h-px flex-1 bg-slate-200" /><span>Guest checkout remains available</span><span className="h-px flex-1 bg-slate-200" /></div>
          <p className="text-center text-sm leading-6 text-slate-500">You can still place a direct Cash on Delivery order without signing in.</p>
          <Link href="/products" className="mt-5 flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Continue shopping</Link>
        </div>
      </section>
    </main>
  )
}
