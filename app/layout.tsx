import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'

import { siteConfig } from '@/config/site'
import { Toaster } from 'sonner'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { 
    default: `${siteConfig.name} · ${siteConfig.tagline}`, 
    template: `%s · ${siteConfig.name}` 
  },
  description: `${siteConfig.brandPromise}. Shop mobile phones and gadgets in Bangladesh with clear pricing, delivery information, and warranty context.`,
  keywords: [
    'mobile phones Bangladesh', 
    'gadgets Bangladesh', 
    'SahiGadget', 
    'mobile shop Narayanganj',
    'buy phones online Bangladesh',
    'authentic gadgets Bangladesh'
  ],
  alternates: { canonical: '/' },
  openGraph: { 
    type: 'website', 
    locale: 'en_BD', 
    title: `${siteConfig.name} · ${siteConfig.tagline}`, 
    description: siteConfig.brandPromise, 
    siteName: siteConfig.name, 
    url: siteConfig.url 
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteConfig.name} · ${siteConfig.tagline}`,
    description: siteConfig.brandPromise,
  },
  robots: { 
    index: true, 
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
    other: [
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        url: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        url: '/favicon-16x16.png',
      },
    ],
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-950">
        <Toaster position="top-right" richColors />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': `${siteConfig.url}/#organization`,
                  name: siteConfig.name,
                  url: siteConfig.url,
                  description: `${siteConfig.brandPromise}.`,
                  telephone: siteConfig.contact.phone,
                  email: siteConfig.contact.publicEmail,
                  address: {
                    '@type': 'PostalAddress',
                    addressLocality: siteConfig.location.city,
                    addressCountry: siteConfig.location.country,
                    postalCode: '1460',
                    streetAddress: 'Araihazar',
                  },
                  areaServed: { '@type': 'Country', name: 'Bangladesh' },
                  sameAs: [siteConfig.contact.facebook],
                  contactPoint: [{
                    '@type': 'ContactPoint',
                    contactType: 'customer support',
                    telephone: siteConfig.contact.phone,
                    email: siteConfig.contact.supportEmail,
                    areaServed: 'BD',
                    availableLanguage: ['en', 'bn'],
                  }],
                },
                {
                  '@type': 'WebSite',
                  '@id': `${siteConfig.url}/#website`,
                  name: siteConfig.name,
                  url: siteConfig.url,
                  publisher: { '@id': `${siteConfig.url}/#organization` },
                  inLanguage: 'en-BD',
                },
              ],
            }),
          }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
