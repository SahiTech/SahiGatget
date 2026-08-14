import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, Globe2, MapPin, Phone, Mail } from 'lucide-react'

import { siteConfig } from '@/config/site'
import { getStorefrontSettings, formatPrice } from '@/lib/services/storefront'

export async function SiteFooter() {
  const settings = await getStorefrontSettings()
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 shadow-md">
              <Image src="/logo.png" alt="SahiGadget Logo" width={44} height={44} className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="font-black tracking-tight">{siteConfig.name}</p>
              <p className="text-xs text-slate-400">{siteConfig.tagline}</p>
            </div>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">{siteConfig.brandPromise}. A clean, customer-first storefront for mobile phones and gadgets in Bangladesh.</p>
          <div className="mt-6 flex items-center gap-3">
            <a href={siteConfig.contact.facebook} target="_blank" rel="noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 transition-colors hover:border-emerald-400 hover:text-emerald-300" aria-label="SahiGadget on Facebook"><Globe2 className="h-4 w-4" /></a>
            <a href={`tel:${siteConfig.contact.phone.replace(/\s+/g, '')}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 transition-colors hover:border-emerald-400 hover:text-emerald-300" aria-label="Call SahiGadget"><Phone className="h-4 w-4" /></a>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Explore</p>
          <nav className="mt-5 grid gap-3 text-sm text-slate-300" aria-label="Footer navigation">
            <Link href="/products" className="transition-colors hover:text-white">Shop products</Link>
            <Link href="/categories" className="transition-colors hover:text-white">Browse categories</Link>
            <Link href="/brands" className="transition-colors hover:text-white">Browse brands</Link>
            <Link href="/search" className="transition-colors hover:text-white">Search catalogue</Link>
          </nav>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Customer care</p>
          <nav className="mt-5 grid gap-3 text-sm text-slate-300">
            <Link href="/track-order" className="transition-colors hover:text-white">Track an order</Link>
            <Link href="/order" className="transition-colors hover:text-white">Order information</Link>
            <Link href="/admin/login" className="transition-colors hover:text-white">Admin portal</Link>
          </nav>
          <p className="mt-6 text-xs leading-6 text-slate-500">Checkout and payments will be connected in a later phase.</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Store information</p>
          <div className="mt-5 grid gap-3 text-sm text-slate-300">
            <a href={`tel:${siteConfig.contact.phone.replace(/\s+/g, '')}`} className="flex items-start gap-3 transition-colors hover:text-white"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />{siteConfig.contact.phone}</a>
            <a href={`mailto:${siteConfig.contact.publicEmail}`} className="flex items-start gap-3 break-all transition-colors hover:text-white"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />{siteConfig.contact.publicEmail}</a>
            <span className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />{siteConfig.location.address}</span>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs leading-6 text-slate-400">
            <p className="font-semibold text-slate-200">Delivery guide</p>
            <p className="mt-1">Dhaka {formatPrice(settings.delivery.dhakaCharge)} · Outside Dhaka {formatPrice(settings.delivery.outsideDhakaCharge)}</p>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5 lg:px-8">
          <p>© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
          <p className="flex items-center gap-1">Built for Bangladesh <ArrowUpRight className="h-3 w-3" /></p>
        </div>
      </div>
    </footer>
  )
}
