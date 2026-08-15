import { BadgeCheck, Headphones, ShieldCheck, Truck } from 'lucide-react'

import { siteConfig } from '@/config/site'

const items = [
  { icon: Truck, title: 'Nationwide Delivery', detail: 'Dhaka & all 64 districts' },
  { icon: ShieldCheck, title: 'Cash on Delivery', detail: 'Pay when it arrives' },
  { icon: BadgeCheck, title: 'Authentic Devices', detail: 'Genuine brand warranty' },
  { icon: Headphones, title: 'Dedicated Support', detail: siteConfig.contact.phone },
]

export function TrustStrip() {
  return (
    <section aria-label="Store benefits" className="border-b border-slate-200/80 bg-slate-50/90">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2.5 px-3 py-3.5 sm:gap-3 sm:px-6 sm:py-5 lg:grid-cols-4 lg:px-8">
        {items.map(({ icon: Icon, title, detail }) => (
          <div key={title} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-2.5 py-2.5 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.7)] sm:gap-3 sm:rounded-2xl sm:p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 sm:h-11 sm:w-11">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black leading-tight text-slate-950 sm:text-sm">{title}</p>
              <p className="mt-0.5 truncate text-[9px] leading-4 text-slate-500 sm:text-xs">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
