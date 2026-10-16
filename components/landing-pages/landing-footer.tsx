import Link from 'next/link'
import { CircleCheck, ShieldCheck, Truck } from 'lucide-react'
import { siteConfig } from '@/config/site'

type LandingFooterProps = {
  brandName?: string
  tagline?: string
  termsHref?: string
  privacyHref?: string
}

export function LandingFooter({
  brandName = 'SahiGadget',
  tagline = '১০০% অরিজিনাল পণ্য',
  termsHref = '/terms',
  privacyHref = '/privacy',
}: LandingFooterProps) {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-300">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-center sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-6 sm:py-5">
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight text-white">{brandName}</p>
          <p className="mt-0.5 text-xs text-slate-400">{tagline}</p>
          <p className="mt-1 text-[11px] text-slate-500">© {new Date().getFullYear()} {brandName}. সর্বস্বত্ব সংরক্ষিত।</p>
        </div>
        <nav aria-label="ল্যান্ডিং পেজের নীতিমালা" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-400 sm:justify-end">
          <Link href={termsHref} className="min-h-8 inline-flex items-center underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">শর্তাবলি</Link>
          <Link href={privacyHref} className="min-h-8 inline-flex items-center underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">গোপনীয়তা নীতি</Link>
        </nav>
      </div>
    </footer>
  )
}


export function LandingTrustBridge() {
  const benefits = [
    { Icon: CircleCheck, title: 'ভ্যারিয়েন্ট অনুযায়ী মূল্য', description: 'নির্বাচিত পণ্য ও পরিমাণের দাম' },
    { Icon: Truck, title: 'ডেলিভারি চার্জ আগে দেখুন', description: 'বিভাগ নির্বাচন করলেই চার্জ দেখাবে' },
    { Icon: ShieldCheck, title: 'ক্যাশ অন ডেলিভারি', description: 'পণ্য হাতে পেয়ে মূল্য পরিশোধ' },
  ]

  return (
    <section aria-labelledby="landing-trust-bridge-title" className="border-y border-emerald-100 bg-gradient-to-b from-white via-emerald-50/50 to-white">
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-7">
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 px-4 py-3.5 text-white sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id="landing-trust-bridge-title" className="text-sm font-black tracking-tight sm:text-base">অর্ডার সহজ, তথ্য পরিষ্কার</h2>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-300 sm:text-xs">সিদ্ধান্তের আগে প্রয়োজনীয় তথ্য দেখে নিন</p>
              </div>
            </div>
            <span className="hidden shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold text-emerald-100 sm:inline-flex">{siteConfig.name}</span>
          </header>
          <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {benefits.map(({ Icon, title, description }) => (
              <article key={title} className="flex min-w-0 items-center gap-3 px-4 py-3.5 sm:px-4 sm:py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-xs font-extrabold text-slate-900 sm:text-sm">{title}</h3>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
