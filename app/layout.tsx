import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { siteConfig } from '@/config/site'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: `${siteConfig.name} · ${siteConfig.tagline}`, template: `%s · ${siteConfig.name}` },
  description: `${siteConfig.brandPromise}. Shop mobile phones and gadgets in Bangladesh with clear pricing, delivery information, and warranty context.`,
  keywords: ['mobile phones Bangladesh', 'gadgets Bangladesh', 'SahiGadget', 'mobile shop Narayanganj'],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'en_BD', title: `${siteConfig.name} · ${siteConfig.tagline}`, description: siteConfig.brandPromise, siteName: siteConfig.name, url: siteConfig.url },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}><body className="min-h-full bg-slate-50 text-slate-950"><SiteHeader />{children}<SiteFooter /></body></html>
}
