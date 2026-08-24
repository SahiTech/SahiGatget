/* eslint-disable @next/next/no-img-element */
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, Search, X, Sparkles, ArrowRight, Loader2, ShieldCheck } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

import { siteConfig } from '@/config/site'
import { Button } from '@/components/ui/button'
import { getProductPrimaryImage, getProductPriceRange, getProductAvailability } from '@/lib/services/storefront-utils'
import type { StorefrontProduct } from '@/lib/services/storefront'

const navItems = [
  { label: 'Shop', href: '/products' },
  { label: 'Categories', href: '/categories' },
  { label: 'Brands', href: '/brands' },
]

// Real popular searches based on available catalogue data
const popularSearches = ['Samsung', 'Feature Phone', 'Smartwatch', 'SKMEI', 'Watch']

type SearchDropdownProps = {
  showDropdown: boolean
  query: string
  isSearching: boolean
  suggestions: StorefrontProduct[]
  isMobile?: boolean
  onPopularSearch: (term: string) => void
  onViewAll: () => void
  onProductClick: () => void
}

function SearchDropdown({ showDropdown, query, isSearching, suggestions, isMobile = false, onPopularSearch, onViewAll, onProductClick }: SearchDropdownProps) {
  if (!showDropdown) return null

  const isEmpty = query.trim().length === 0
  const isTooShort = !isEmpty && query.trim().length < 2

  return (
    <div className={`motion-safe:animate-[dropdown-in_160ms_ease-out_both] motion-reduce:animate-none absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${isMobile ? 'max-h-[60vh] overflow-y-auto' : ''}`}>
      {isEmpty ? (
        <div className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Popular searches
          </p>
          <div className="flex flex-wrap gap-2">
            {popularSearches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => onPopularSearch(term)}
                className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-950 hover:text-white"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      ) : isSearching ? (
        <div className="flex items-center justify-center p-8 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm font-medium">Searching catalogue...</span>
        </div>
      ) : isTooShort ? (
        <div className="p-4 text-center text-xs text-slate-500">Type at least 2 characters to search...</div>
      ) : suggestions.length > 0 ? (
        <div className="py-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Catalogue matches ({suggestions.length})</p>
            <button
              type="button"
              onClick={onViewAll}
              className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {suggestions.map((product) => {
            const imageUrl = getProductPrimaryImage(product)
            const priceRange = getProductPriceRange(product)
            const availability = getProductAvailability(product)
            return (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                onClick={onProductClick}
                className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 transition hover:bg-slate-50 last:border-0"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-black text-slate-300">SG</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{product.name}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-600">{priceRange}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${availability.tone === 'in' ? 'text-emerald-500' : availability.tone === 'low' ? 'text-amber-500' : 'text-rose-500'}`}>
                      {availability.label}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="p-8 text-center">
          <p className="text-sm font-bold text-slate-950">No products found for “{query}”</p>
          <p className="mt-1 text-xs text-slate-500">Try searching for brand names, watch, phone, or SKU.</p>
        </div>
      )}
    </div>
  )
}

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<StorefrontProduct[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const mobileSearchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node) && 
          mobileSearchRef.current && !mobileSearchRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) return

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        const data = await res.json()
        setSuggestions(data.products || [])
      } catch {
        setSuggestions([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  function selectPopularSearch(term: string) {
    setQuery(term)
    router.push(`/search?q=${encodeURIComponent(term)}`)
    setShowDropdown(false)
    setMenuOpen(false)
  }

  function submitViewAll() {
    router.push(`/search?q=${encodeURIComponent(query)}`)
    setShowDropdown(false)
    setMenuOpen(false)
  }

  function closeSearchDropdown() {
    setShowDropdown(false)
    setMenuOpen(false)
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = query.trim()
    setShowDropdown(false)
    setMenuOpen(false)
    if (value) router.push(`/search?q=${encodeURIComponent(value)}`)
    else router.push('/search')
  }

  return (
    <>
      <div className="border-b border-slate-200 bg-slate-950 px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-300 sm:text-[11px] sm:tracking-[0.18em]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-1 sm:flex-row sm:gap-0">
          <span className="text-emerald-300">{siteConfig.tagline}</span>
          <span className="hidden mx-2 text-slate-600 sm:inline">•</span>
          <span>{siteConfig.brandPromise}</span>
        </div>
      </div>
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <Link href="/" className="group flex min-w-0 shrink-0 items-center gap-2.5 sm:gap-3" aria-label={`${siteConfig.name} home`}>
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-950 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5 transition-transform duration-200 group-hover:-rotate-3 sm:h-11 sm:w-11 sm:rounded-2xl">
              <Image src="/logo.png" alt="SahiGadget Logo" width={44} height={44} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <span className="motion-safe:animate-[brand-in_240ms_ease-out_both] motion-reduce:animate-none block truncate bg-gradient-to-r from-slate-950 via-slate-800 to-emerald-600 bg-clip-text text-[17px] font-black leading-tight tracking-[-0.035em] text-transparent sm:text-lg">{siteConfig.name}</span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 sm:block">Mobile & gadgets</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link key={item.href} href={item.href} className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div ref={searchRef} className="relative hidden min-w-0 max-w-md flex-1 items-center lg:block lg:mx-4">
            <form onSubmit={submitSearch} role="search">
              <label className="sr-only" htmlFor="desktop-search">Search the catalogue</label>
              <div className="flex w-full items-center rounded-full border border-slate-200 bg-slate-50 px-4 transition-colors focus-within:border-emerald-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-100/80">
                <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <input 
                  id="desktop-search" data-search-input
                  value={query} 
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  autoComplete="off"
                  placeholder="Search phones, gadgets, or SKU" 
                  className="h-10 min-w-0 flex-1 appearance-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {query && (
                  <button 
                    type="button" 
                    onClick={() => { setQuery(''); setSuggestions([]) }} 
                    className="mr-2 text-slate-400 hover:text-slate-700"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button type="submit" className="border-l border-slate-200 pl-3 text-xs font-bold text-slate-500 transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2">Search</button>
              </div>
            </form>
            <SearchDropdown showDropdown={showDropdown} query={query} isSearching={isSearching} suggestions={suggestions} onPopularSearch={selectPopularSearch} onViewAll={submitViewAll} onProductClick={closeSearchDropdown} />
          </div>

          <div className="flex items-center gap-2">
            <Link href="/admin" className="hidden items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 lg:inline-flex" aria-label="Open Admin Portal">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Admin Portal
            </Link>
            <Link href="/track-order" className="hidden text-sm font-semibold text-slate-500 transition-colors hover:text-slate-950 lg:block">Track order</Link>
            <Button asChild className="hidden rounded-full bg-emerald-500 text-slate-950 transition-transform duration-150 hover:-translate-y-0.5 hover:bg-emerald-400 motion-reduce:transform-none lg:inline-flex">
              <Link href="/products">Shop now</Link>
            </Button>
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 lg:hidden" onClick={() => { setMenuOpen((open) => !open); if (!menuOpen) setShowDropdown(false); }} aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
              {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div id="mobile-navigation" className="motion-safe:animate-[menu-in_180ms_ease-out_both] motion-reduce:animate-none border-t border-slate-200 bg-white px-4 py-5 shadow-xl lg:hidden">
            <div ref={mobileSearchRef} className="relative mb-4">
                <form onSubmit={submitSearch} className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 transition-colors focus-within:border-emerald-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-100/80" role="search">
                <label className="sr-only" htmlFor="mobile-search">Search the catalogue</label>
                <Search className="mr-2 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input 
                  id="mobile-search" data-search-input
                  value={query} 
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  autoComplete="off"
                  placeholder="Search phones, gadgets, SKU" 
                  className="h-11 min-w-0 flex-1 appearance-none bg-transparent text-sm outline-none placeholder:text-slate-400 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                {query && (
                  <button type="button" onClick={() => { setQuery(''); setSuggestions([]) }} className="mr-2 text-slate-400">
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button type="submit" className="border-l border-slate-200 pl-2 text-xs font-bold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2">Search</button>
              </form>
              <SearchDropdown showDropdown={showDropdown} query={query} isSearching={isSearching} suggestions={suggestions} isMobile onPopularSearch={selectPopularSearch} onViewAll={submitViewAll} onProductClick={closeSearchDropdown} />
            </div>
            
            <nav className="grid gap-1 border-t border-slate-100 pt-3" aria-label="Mobile navigation">
              <Link href="/" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Home</Link>
              {navItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">{item.label}</Link>)}
              <Link href="/track-order" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">Track order</Link>
              <Link href="/admin" onClick={() => setMenuOpen(false)} className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50" aria-label="Open Admin Portal">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Admin Portal
              </Link>
            </nav>
          </div>
        )}
      </header>
    </>
  )
}
