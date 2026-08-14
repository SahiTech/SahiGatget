import type { Metadata } from 'next'
import { Mail, MapPin, Phone } from 'lucide-react'

import { PolicyPage } from '@/components/storefront/policy-page'
import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Contact Support · SahiGadget',
  description: 'Contact SahiGadget customer support about orders, delivery, warranty, returns, and product assistance.',
}

export default function ContactPage() {
  return <PolicyPage
    eyebrow="Customer support"
    title="Contact Support"
    description="Need help with an order, delivery, warranty, return, replacement, or product question? Contact SahiGadget using the verified support details below."
    sections={[
      { id: 'support', title: 'Customer support', body: 'Please include your name, phone number, order information, and a clear description of your question so the support team can review the matter efficiently.' },
      { id: 'phone', title: 'Phone', body: siteConfig.contact.phone },
      { id: 'email', title: 'Email', body: siteConfig.contact.publicEmail },
      { id: 'location', title: 'Location', body: siteConfig.location.address },
      { id: 'before-contacting', title: 'What to include', bullets: [
        'Your name and the phone number used for the order.',
        'Order information, product name, variant, or serial/IMEI details where applicable.',
        'Photos or videos when reporting a damaged, defective, or incorrect product.',
        'A concise description of the requested help and any relevant delivery information.'
      ]},
    ]}
    aside={<div className="mt-4 grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><a href={`tel:${siteConfig.contact.phone.replace(/\s+/g, '')}`} className="flex items-start gap-3 text-sm font-semibold text-slate-700 hover:text-slate-950"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{siteConfig.contact.phone}</a><a href={`mailto:${siteConfig.contact.publicEmail}`} className="flex items-start gap-3 break-all text-sm font-semibold text-slate-700 hover:text-slate-950"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{siteConfig.contact.publicEmail}</a><span className="flex items-start gap-3 text-sm font-semibold text-slate-700"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{siteConfig.location.address}</span></div>}
    relatedLinks={[{ label: 'Track an order', href: '/track-order' }, { label: 'Warranty & guarantee', href: '/warranty' }, { label: 'Returns & replacements', href: '/returns' }, { label: 'Shipping & delivery', href: '/shipping' }]}
  />
}
