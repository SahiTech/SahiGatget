import type { Metadata } from 'next'
import { Mail, MapPin, Phone } from 'lucide-react'

import { Breadcrumbs } from '@/components/storefront/page-intro'
import { ContactForm } from '@/components/storefront/contact-form'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Contact Support · SahiGadget',
  description: 'Contact SahiGadget customer support about orders, delivery, warranty, returns, and product assistance.',
}

export default function ContactPage() {
  const mapQuery = encodeURIComponent('Araihazar, Narayanganj, Bangladesh')
  return (
    <main className="flex-1 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Help & Policies', href: '/help' }, { label: 'Contact Support', href: '#support' }]} />
        <header className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Customer support</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">Contact Support</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">Need help with an order, delivery, warranty, return, replacement, or product question? Send the support team a request or use the verified contact details below.</p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <section id="support" className="scroll-mt-24 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="support-form-title">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">Send a request</p>
            <h2 id="support-form-title" className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">How can we help?</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Share the essentials and our team will review your request. For order, warranty, return, or delivery questions, include the order number when available.</p>
            <div className="mt-7"><ContactForm /></div>
          </section>

          <aside className="grid gap-5 lg:sticky lg:top-24">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="direct-support-title">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">Direct support</p>
              <h2 id="direct-support-title" className="mt-2 text-lg font-black text-slate-950">Reach the team</h2>
              <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-700">
                <a href={`tel:${siteConfig.contact.phone.replace(/\s+/g, '')}`} className="flex items-start gap-3 hover:text-slate-950"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{siteConfig.contact.phone}</a>
                <a href={`mailto:${siteConfig.contact.supportEmail}`} className="flex items-start gap-3 break-all hover:text-slate-950"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{siteConfig.contact.supportEmail}</a>
                <span className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{siteConfig.location.address}</span>
              </div>
            </section>
            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm" aria-labelledby="location-title">
              <div className="p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">Location</p><h2 id="location-title" className="mt-2 text-lg font-black text-slate-950">Araihazar, Narayanganj</h2><p className="mt-2 text-sm leading-6 text-slate-600">Our listed business location in Bangladesh.</p></div>
              <iframe title="SahiGadget location map" src={`https://www.openstreetmap.org/export/embed.html?search=${mapQuery}&zoom=12`} className="h-64 w-full border-0" loading="lazy" />
              <a href={`https://www.openstreetmap.org/search?query=${mapQuery}`} target="_blank" rel="noreferrer" className="block border-t border-slate-100 px-5 py-3 text-xs font-bold text-emerald-700 hover:text-slate-950">Open map in a new tab</a>
            </section>
          </aside>
        </div>

        <nav className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Related customer care pages">
          {[['Track an order', '/track-order'], ['Warranty & guarantee', '/warranty'], ['Returns & replacements', '/returns'], ['Shipping & delivery', '/shipping']].map(([label, href]) => <a key={href} href={href} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-slate-950">{label}</a>)}
        </nav>
      </div>
    </main>
  )
}
