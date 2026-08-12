'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, Search, X } from 'lucide-react'
import { useState } from 'react'

import { siteConfig } from '@/config/site'
import { Button } from '@/components/ui/button'

const navItems = [
  { label: 'Shop', href: '/products' },
  { label: 'Categories', href: '/categories' },
  { label: 'Brands', href: '/brands' },
]

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = query.trim()
    if (value) router.push(`/search?q=${encodeURIComponent(value)}`)
    else router.push('/search')
    setMenuOpen(false)
  }

  return (
    <>
      <div className="border-b border-slate-200 bg-slate-950 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
        <span className="text-emerald-300">{siteConfig.tagline}</span>
        <span className="mx-2 text-slate-600">•</span>
        <span>{siteConfig.brandPromise}</span>
      </div>
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex shrink-0 items-center gap-3" aria-label={`${siteConfig.name} home`}>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black tracking-tight text-emerald-300 shadow-lg shadow-slate-900/10 transition-transform group-hover:-rotate-3">
              SG
            </span>
            <span className="hidden sm:block">
              <span className="block text-base font-black tracking-tight text-slate-950">{siteConfig.name}</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Mobile & gadgets</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link key={item.href} href={item.href} className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <form onSubmit={submitSearch} className="ml-auto hidden min-w-0 max-w-sm flex-1 items-center md:flex" role="search">
            <label className="sr-only" htmlFor="desktop-search">Search the catalogue</label>
            <div className="flex w-full items-center rounded-full border border-slate-200 bg-slate-50 px-4 transition-colors focus-within:border-slate-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100">
              <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input id="desktop-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search phones, gadgets, or SKU" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" />
              <button type="submit" className="text-xs font-bold text-slate-500 transition-colors hover:text-slate-950">Search</button>
            </div>
          </form>

          <Link href="/track-order" className="hidden text-sm font-semibold text-slate-500 transition-colors hover:text-slate-950 lg:block">Track order</Link>
          <Button asChild className="hidden rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 md:inline-flex">
            <Link href="/products">Shop now</Link>
          </Button>
          <button type="button" className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 md:hidden" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {menuOpen && (
          <div id="mobile-navigation" className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
            <form onSubmit={submitSearch} className="mb-4 flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-emerald-100" role="search">
              <label className="sr-only" htmlFor="mobile-search">Search the catalogue</label>
              <Search className="mr-2 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input id="mobile-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the catalogue" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" />
              <button type="submit" className="text-xs font-bold text-slate-500">Search</button>
            </form>
            <nav className="grid gap-1" aria-label="Mobile navigation">
              <Link href="/" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Home</Link>
              {navItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">{item.label}</Link>)}
              <Link href="/track-order" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Track order</Link>
            </nav>
          </div>
        )}
      </header>
    </>
  )
}
