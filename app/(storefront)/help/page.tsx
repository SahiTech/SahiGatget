import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldCheck, Truck, RefreshCw, FileText, Lock, Phone, HelpCircle, ArrowRight } from 'lucide-react'

import { siteConfig } from '@/config/site'
import { Breadcrumbs } from '@/components/storefront/page-intro'

export const metadata: Metadata = {
  title: 'Help & Policies · SahiGadget',
  description: 'Customer care, delivery information, warranty terms, return policies, and contact information for SahiGadget Bangladesh.',
}

const policySections = [
  {
    title: 'Warranty & Guarantee',
    description: `Every product comes with our standard ${siteConfig.warranty.guaranteeDays} days guarantee and ${siteConfig.warranty.serviceWarrantyYears} year service warranty. Manufacturer terms apply where applicable.`,
    icon: ShieldCheck,
    href: '#warranty',
  },
  {
    title: 'Shipping & Delivery',
    description: `We deliver across Bangladesh. Standard delivery is ৳${siteConfig.delivery.dhakaCharge} inside Dhaka and ৳${siteConfig.delivery.outsideDhakaCharge} outside Dhaka via secure courier.`,
    icon: Truck,
    href: '#shipping',
  },
  {
    title: 'Returns & Replacements',
    description: 'If you receive a damaged, defective, or incorrect product, report it within 7 days for prompt verification and replacement support.',
    icon: RefreshCw,
    href: '#returns',
  },
  {
    title: 'Terms & Conditions',
    description: 'Clear guidelines on purchasing, Cash on Delivery verification, pricing accuracy, and user responsibilities when shopping on SahiGadget.',
    icon: FileText,
    href: '#terms',
  },
  {
    title: 'Privacy Policy',
    description: 'We respect your privacy. Your order details and phone numbers are securely protected and used solely for fulfillment and communication.',
    icon: Lock,
    href: '#privacy',
  },
  {
    title: 'Customer Support',
    description: `Need assistance before ordering? Call us at ${siteConfig.contact.phone} or email ${siteConfig.contact.publicEmail}.`,
    icon: Phone,
    href: '#support',
  },
]

export default function HelpPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Help & Policies', href: '/help' }]} />
        
        <div className="mt-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Customer care & guidelines</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl md:text-5xl">Help & Policies Hub</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
            Transparent information for online shoppers in Bangladesh. Everything you need to know about ordering, delivery, warranty, and store policies from {siteConfig.name}.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {policySections.map((section) => {
            const Icon = section.icon
            return (
              <div key={section.title} className="flex flex-col rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-md sm:p-7">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-xl font-black tracking-tight text-slate-950">{section.title}</h2>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{section.description}</p>
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <Link href="/track-order" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-950 hover:text-emerald-700">
                    Track order status <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-16 rounded-[2rem] bg-slate-950 p-8 text-white sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Ready to shop?</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Explore authentic mobile phones and gadgets.</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">Browse our published catalogue with transparent pricing, verified specifications, and Cash on Delivery support across Bangladesh.</p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link href="/products" className="inline-flex h-12 items-center justify-center rounded-full bg-emerald-400 px-6 text-sm font-black text-slate-955 transition hover:bg-emerald-300">
                Browse catalogue
              </Link>
              <Link href="/track-order" className="inline-flex h-12 items-center justify-center rounded-full border border-slate-700 px-6 text-sm font-bold text-white transition hover:border-slate-400 hover:bg-white/5">
                Track order
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
