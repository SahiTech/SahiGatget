import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, Banknote, Mail, MapPin, Phone, Search, ShoppingBag } from 'lucide-react'

import { siteConfig } from '@/config/site'
import { getStorefrontSettings } from '@/lib/services/storefront'

function isPlatformUrl(value: string, platform: string) {
  if (!value) return false
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '')
    const allowed: Record<string, string[]> = {
      facebook: ['facebook.com', 'm.facebook.com'],
      tiktok: ['tiktok.com'],
      instagram: ['instagram.com'],
      x: ['x.com', 'twitter.com'],
      youtube: ['youtube.com', 'youtu.be'],
    }
    return (allowed[platform] ?? []).some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

function FacebookMark({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H6v4h3v5h4v-5h3.2l.8-4H13V9c0-.6.4-1 1-1Z" /></svg> }
function InstagramMark({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg> }
function YoutubeMark({ className }: { className?: string }) { return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M21 8.2a2.8 2.8 0 0 0-2-2C17.2 5.7 12 5.7 12 5.7s-5.2 0-7 .5a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2.7 12 29 29 0 0 0 3 15.8a2.8 2.8 0 0 0 2 2c1.8.5 7 .5 7 .5s5.2 0 7-.5a2.8 2.8 0 0 0 2-2 29 29 0 0 0 .3-3.8 29 29 0 0 0-.3-3.8ZM10 15V9l5 3-5 3Z" /></svg> }
function TikTokMark({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M15.3 3c.4 1.9 1.5 3.2 3.4 3.4v3a8 8 0 0 1-3.4-1v6.2a5.4 5.4 0 1 1-4.7-5.3v3.1a2.3 2.3 0 1 0 1.6 2.2V3h3.1Z" /></svg>
}

function XMark({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M5.2 4h4.1l3.7 5 4.3-5h2l-5.4 6.2L20 20h-4.1l-4-5.4L7.2 20h-2l5.9-6.8L5.2 4Zm3.1 1.7H6.9l8.9 12.6h1.4L8.3 5.7Z" /></svg>
}

export async function SiteFooter() {
  const settings = await getStorefrontSettings()
  const social = settings.footer.social
  const socialLinks = [
    { key: 'facebook', label: 'Facebook', href: social.facebook || siteConfig.contact.facebook, Icon: FacebookMark },
    { key: 'tiktok', label: 'TikTok', href: social.tiktok, Icon: TikTokMark },
    { key: 'instagram', label: 'Instagram', href: social.instagram, Icon: InstagramMark },
    { key: 'x', label: 'X / Twitter', href: social.x, Icon: XMark },
    { key: 'youtube', label: 'YouTube', href: social.youtube, Icon: YoutubeMark },
  ].filter((item) => isPlatformUrl(item.href, item.key))
  const payments = [
    settings.footer.payments.cash_on_delivery ? { label: 'Cash on Delivery', Icon: Banknote } : null,
    settings.footer.payments.visa ? { label: 'Visa', Icon: PaymentCard } : null,
    settings.footer.payments.mastercard ? { label: 'Mastercard', Icon: PaymentCard } : null,
  ].filter(Boolean) as { label: string; Icon: typeof Banknote }[]

  return <footer className="border-t border-slate-200 bg-slate-950 text-white">
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_.8fr_.9fr_1.1fr] lg:gap-8 lg:px-8">
      <div>
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 shadow-md"><Image src="/logo.png" alt="SahiGadget Logo" width={44} height={44} className="h-full w-full object-cover" /></div>
          <div><p className="font-black tracking-tight">{siteConfig.name}</p><p className="text-xs text-slate-400">{siteConfig.tagline}</p></div>
        </div>
        <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">{siteConfig.brandPromise}. A clean, customer-first storefront for mobile phones and gadgets in Bangladesh.</p>
        {socialLinks.length ? <div className="mt-6 flex flex-wrap gap-2" aria-label="SahiGadget social media links">{socialLinks.map(({ key, label, href, Icon }) => <a key={key} href={href} target="_blank" rel="noreferrer" aria-label={`SahiGadget on ${label}`} title={label} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-300 transition-colors hover:border-emerald-400 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"><Icon className="h-4 w-4" /></a>)}</div> : null}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Explore</p>
        <nav className="mt-5 grid gap-3 text-sm text-slate-300" aria-label="Footer explore navigation"><Link href="/products" className="flex items-center gap-2 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"><ShoppingBag className="h-4 w-4 text-emerald-300" />Shop products</Link><Link href="/search" className="flex items-center gap-2 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"><Search className="h-4 w-4 text-emerald-300" />Search catalogue</Link></nav>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Customer care</p>
        <nav className="mt-5 grid gap-3 text-sm text-slate-300" aria-label="Customer care navigation"><Link href="/track-order" className="transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">Track an order</Link><Link href="/help" className="transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">Help &amp; Policies</Link><Link href="/contact" className="transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">Contact Support</Link></nav>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Contact</p>
        <div className="mt-5 grid gap-3 text-sm text-slate-300"><a href={`tel:${siteConfig.contact.phone.replace(/\s+/g, '')}`} className="flex items-start gap-3 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />{siteConfig.contact.phone}</a><a href={`mailto:${siteConfig.contact.publicEmail}`} className="flex items-start gap-3 break-all transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />{siteConfig.contact.publicEmail}</a><span className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />{siteConfig.location.address}</span></div>
        {payments.length ? <div className="mt-6 border-t border-slate-800 pt-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Payments accepted</p><div className="mt-3 flex flex-wrap gap-2">{payments.map(({ label, Icon }) => <span key={label} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200"><Icon className="h-4 w-4 text-emerald-300" aria-hidden="true" />{label}</span>)}</div></div> : null}
      </div>
    </div>
    <div className="border-t border-slate-800"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><p>© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p><p className="flex items-center gap-1">Built for Bangladesh <ArrowUpRight className="h-3 w-3" aria-hidden="true" /></p></div></div>
  </footer>
}

function PaymentCard({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></svg>
}
