import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ShieldCheck, Store } from 'lucide-react'

import { AdminLoginForm } from '@/components/admin/admin-login-form'
import { getAdminSession } from '@/lib/admin/auth'

export const metadata: Metadata = { title: 'Admin sign in', robots: { index: false, follow: false } }

export default async function AdminLoginPage() {
  const session = await getAdminSession()
  if (session) redirect('/admin')

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#d1fae5,_transparent_32%),linear-gradient(135deg,_#0f172a,_#14532d)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-950/30 lg:grid-cols-[1.08fr_.92fr]">
        <section className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3 text-sm font-semibold tracking-wide text-emerald-300"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 text-slate-950"><Store className="h-5 w-5" /></span>SAHIGADGET OPERATIONS</div>
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">Restricted workspace</p>
            <h1 className="max-w-md text-4xl font-semibold leading-tight">Run the store with clear controls and durable records.</h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">Catalogue, inventory, orders, settings, and audit activity are protected by server-side Supabase Auth and role checks.</p>
          </div>
          <p className="text-xs text-slate-400">SahiGadget Mobile Phone & Gadget Shop</p>
        </section>
        <section className="flex items-center p-6 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-sm">
            <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-emerald-700"><ShieldCheck className="h-4 w-4" /> Return to storefront</Link>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Admin access</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Sign in to operations</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Use your approved SahiGadget administration account.</p>
            <div className="mt-8"><AdminLoginForm /></div>
          </div>
        </section>
      </div>
    </main>
  )
}
