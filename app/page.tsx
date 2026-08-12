import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/config/site'
import { ShieldCheck, Truck, Headphones, Smartphone, CheckCircle2, Lock } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Header / Announcement bar */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xl">
              SG
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                {siteConfig.name}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {siteConfig.tagline}
              </p>
            </div>
          </div>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-600">
            <Link href="/products" className="hover:text-blue-600 transition-colors">Products</Link>
            <Link href="/brands" className="hover:text-blue-600 transition-colors">Brands</Link>
            <Link href="/categories" className="hover:text-blue-600 transition-colors">Categories</Link>
            <Link href="/track-order" className="hover:text-blue-600 transition-colors">Track Order</Link>
          </nav>
          <div className="flex items-center space-x-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/login">Admin Portal</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/products">Shop Now</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-900 via-blue-800 to-slate-900 text-white py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-200 ring-1 ring-inset ring-blue-400/30 mb-6">
            <ShieldCheck className="h-4 w-4 text-blue-400" />
            {siteConfig.brandPromise}
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl mb-6">
            Official Mobile Phones & Gadgets in Bangladesh
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-300 mb-10">
            Established in {siteConfig.established}. Delivering authentic mobile phones and premium smart gadgets across Bangladesh with trusted warranty support.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8">
              <Link href="/products">Browse Catalog</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-slate-600 text-white hover:bg-white/10">
              <Link href="/track-order">Track Your Order</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start space-x-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">100% Official Products</h3>
                <p className="mt-1 text-sm text-slate-600">Authentic mobile phones with official brand warranty.</p>
              </div>
            </div>
            <div className="flex items-start space-x-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Nationwide Delivery</h3>
                <p className="mt-1 text-sm text-slate-600">Fast delivery (Dhaka ৳{siteConfig.delivery.dhakaCharge}, Outside ৳{siteConfig.delivery.outsideDhakaCharge}).</p>
              </div>
            </div>
            <div className="flex items-start space-x-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Warranty Protection</h3>
                <p className="mt-1 text-sm text-slate-600">{siteConfig.warranty.defaultPolicy}</p>
              </div>
            </div>
            <div className="flex items-start space-x-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Headphones className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Dedicated Support</h3>
                <p className="mt-1 text-sm text-slate-600">Call us at {siteConfig.contact.phone} for expert assistance.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Phase 1 Architecture Notice */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8 shadow-sm">
          <div className="inline-flex items-center justify-center rounded-full bg-blue-600 text-white p-3 mb-4">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Phase 1 Clean Production Foundation Active
          </h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            The Next.js App Router architecture, TypeScript configuration, Tailwind CSS, shadcn/ui components, Supabase client/server boundaries, security enforcement, and robust error handling are successfully established in repository <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-700 font-mono">SahiTech/SahiGatget</code>.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-xs font-semibold text-blue-700 bg-white/80 py-3 px-4 rounded-lg border border-blue-100">
            <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Secure Server Boundary</span>
            <span>•</span>
            <span>PostgreSQL Ready</span>
            <span>•</span>
            <span>Vercel Optimized</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} {siteConfig.name} ({siteConfig.location.address}). All rights reserved.</p>
          <p className="mt-1 text-xs text-slate-400">
            Contact: {siteConfig.contact.publicEmail} | Phone: {siteConfig.contact.phone}
          </p>
        </div>
      </footer>
    </div>
  )
}
