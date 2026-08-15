'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react'

import type { StorefrontBrand, StorefrontCategory, ProductFilters } from '@/lib/services/storefront'
import { getCatalogQuery, getProductTypeLabel } from '@/lib/services/storefront-utils'

type CatalogFiltersProps = {
  brands: StorefrontBrand[]
  categories: StorefrontCategory[]
  productTypes: string[]
  filters: ProductFilters
}

function hasActiveFilters(filters: ProductFilters) {
  return Boolean(filters.category || filters.brand || filters.productType || filters.minPrice !== undefined || filters.maxPrice !== undefined || (filters.availability && filters.availability !== 'all'))
}

function getActiveFilterCount(filters: ProductFilters) {
  return [filters.category, filters.brand, filters.productType, filters.minPrice !== undefined, filters.maxPrice !== undefined, filters.availability && filters.availability !== 'all'].filter(Boolean).length
}

function buildCatalogUrl(filters: ProductFilters) {
  const params = new URLSearchParams(getCatalogQuery({ ...filters, page: 1 }))
  if (filters.query) params.set('q', filters.query)
  const query = params.toString()
  return query ? `/products?${query}` : '/products'
}

function toNumber(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

function readFormFilters(form: HTMLFormElement, current: ProductFilters): ProductFilters {
  const data = new FormData(form)
  const availability = String(data.get('availability') || 'all')
  const sort = String(data.get('sort') || 'newest')
  return {
    query: current.query,
    category: String(data.get('category') || '') || undefined,
    brand: String(data.get('brand') || '') || undefined,
    availability: availability === 'in-stock' || availability === 'low-stock' ? availability : 'all',
    productType: String(data.get('type') || '') || undefined,
    minPrice: toNumber(data.get('min')),
    maxPrice: toNumber(data.get('max')),
    sort: sort === 'featured' || sort === 'price-asc' || sort === 'price-desc' ? sort : 'newest',
    page: 1,
  }
}

function SelectField({ id, name, label, defaultValue, children }: { id: string; name: string; label: string; defaultValue: string; children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</label>
      <select id={id} name={name} defaultValue={defaultValue} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-100">
        {children}
      </select>
    </div>
  )
}

function FilterFields({ brands, categories, productTypes, filters, idPrefix }: CatalogFiltersProps & { idPrefix: string }) {
  return (
    <>
      <SelectField id={`${idPrefix}-category`} name="category" label="Category" defaultValue={filters.category || ''}>
        <option value="">All categories</option>
        {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
      </SelectField>
      <SelectField id={`${idPrefix}-brand`} name="brand" label="Brand" defaultValue={filters.brand || ''}>
        <option value="">All brands</option>
        {brands.map((brand) => <option key={brand.id} value={brand.slug}>{brand.name}</option>)}
      </SelectField>
      <SelectField id={`${idPrefix}-availability`} name="availability" label="Availability" defaultValue={filters.availability || 'all'}>
        <option value="all">All products</option>
        <option value="in-stock">In stock</option>
        <option value="low-stock">Low stock</option>
      </SelectField>
      <SelectField id={`${idPrefix}-type`} name="type" label="Product type" defaultValue={filters.productType || ''}>
        <option value="">All product types</option>
        {productTypes.map((type) => <option key={type} value={type}>{getProductTypeLabel(type)}</option>)}
      </SelectField>
      <div className="min-w-0 flex-[1.2]">
        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Price range</label>
        <div className="flex gap-2">
          <input name="min" type="number" min="0" inputMode="numeric" defaultValue={filters.minPrice ?? ''} placeholder="Min ৳" aria-label="Minimum price" className="h-11 min-w-0 w-1/2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
          <input name="max" type="number" min="0" inputMode="numeric" defaultValue={filters.maxPrice ?? ''} placeholder="Max ৳" aria-label="Maximum price" className="h-11 min-w-0 w-1/2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
        </div>
      </div>
      <SelectField id={`${idPrefix}-sort`} name="sort" label="Sort by" defaultValue={filters.sort || 'newest'}>
        <option value="newest">Newest</option>
        <option value="featured">Featured</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
      </SelectField>
    </>
  )
}

function ActiveFilters({ filters, brands, categories, onRemove }: Omit<CatalogFiltersProps, 'productTypes'> & { onRemove: (next: ProductFilters) => void }) {
  const chips: { label: string; key: string; next: ProductFilters }[] = []
  if (filters.category) chips.push({ label: `Category: ${categories.find((item) => item.slug === filters.category)?.name || filters.category}`, key: 'category', next: { ...filters, category: undefined, page: 1 } })
  if (filters.brand) chips.push({ label: `Brand: ${brands.find((item) => item.slug === filters.brand)?.name || filters.brand}`, key: 'brand', next: { ...filters, brand: undefined, page: 1 } })
  if (filters.availability && filters.availability !== 'all') chips.push({ label: filters.availability === 'in-stock' ? 'In stock' : 'Low stock', key: 'availability', next: { ...filters, availability: 'all', page: 1 } })
  if (filters.productType) chips.push({ label: `Type: ${getProductTypeLabel(filters.productType)}`, key: 'productType', next: { ...filters, productType: undefined, page: 1 } })
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) chips.push({ label: `Price: ৳${filters.minPrice ?? 0}–${filters.maxPrice ?? '∞'}`, key: 'price', next: { ...filters, minPrice: undefined, maxPrice: undefined, page: 1 } })
  if (!chips.length) return null
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((chip) => <button key={chip.key} type="button" onClick={() => onRemove(chip.next)} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 transition hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"><span className="truncate">{chip.label}</span><X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="sr-only">Remove {chip.label}</span></button>)}
    </div>
  )
}

export function CatalogFilters({ brands, categories, productTypes, filters }: CatalogFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const wasOpenRef = useRef(false)
  const activeCount = getActiveFilterCount(filters)
  const active = hasActiveFilters(filters)

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = ''
      if (wasOpenRef.current) triggerRef.current?.focus({ preventScroll: true })
      return undefined
    }
    wasOpenRef.current = true
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    headingRef.current?.focus({ preventScroll: true })
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown) }
  }, [isOpen])

  const navigate = (next: ProductFilters, close = false) => {
    const destination = buildCatalogUrl(next)
    if (destination !== `${pathname}${window.location.search}`) router.push(destination)
    if (close) setIsOpen(false)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    navigate(readFormFilters(event.currentTarget, filters), true)
  }

  const handleMobileSort = (event: ChangeEvent<HTMLSelectElement>) => {
    const sort = event.target.value as ProductFilters['sort']
    navigate({ ...filters, sort: sort || 'newest', page: 1 })
  }

  return (
    <>
      <div className="hidden lg:block">
        <form method="get" onSubmit={handleSubmit} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <FilterFields brands={brands} categories={categories} productTypes={productTypes} filters={filters} idPrefix="desktop" />
            <button type="submit" className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">Apply filters</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span className="min-w-0 flex-1">Filters are reflected in the URL so this view is shareable.</span>
            <Link href="/products" className={`shrink-0 font-bold underline underline-offset-4 hover:text-emerald-700 ${active ? 'text-slate-900' : 'pointer-events-none text-slate-300'}`}>Clear filters</Link>
          </div>
          {filters.query && <input type="hidden" name="q" value={filters.query} />}
        </form>
      </div>

      <div className="lg:hidden">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <button ref={triggerRef} type="button" onClick={() => setIsOpen(true)} aria-haspopup="dialog" aria-expanded={isOpen} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-emerald-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 active:scale-[0.98]"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Filter{activeCount > 0 && <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-xs font-black text-slate-950">{activeCount}</span>}</button>
          <label className="relative flex min-h-11 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-slate-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100"><span className="sr-only">Sort products</span><select aria-label="Sort products" value={filters.sort || 'newest'} onChange={handleMobileSort} className="w-full appearance-none bg-transparent pr-5 text-center text-sm font-bold text-slate-800 outline-none"><option value="newest">Sort: Newest</option><option value="featured">Sort: Featured</option><option value="price-asc">Sort: Price low</option><option value="price-desc">Sort: Price high</option></select><ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" aria-hidden="true" /></label>
        </div>
        <ActiveFilters filters={filters} brands={brands} categories={categories} onRemove={(next) => navigate(next)} />
      </div>

      {isOpen && <div className="lg:hidden fixed inset-0 z-50 flex items-end" role="presentation">
        <button type="button" aria-label="Close filters" onClick={() => setIsOpen(false)} className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] motion-safe:animate-[catalog-fade-in_180ms_ease-out]" />
        <section role="dialog" aria-modal="true" aria-labelledby="mobile-filter-title" className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl motion-safe:animate-[catalog-sheet-in_220ms_cubic-bezier(0.23,1,0.32,1)]">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Refine catalogue</p><h2 ref={headingRef} id="mobile-filter-title" tabIndex={-1} className="mt-1 text-2xl font-black tracking-tight text-slate-950">Filters</h2></div><button type="button" onClick={() => setIsOpen(false)} aria-label="Close filter panel" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:border-slate-400 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"><X className="h-5 w-5" aria-hidden="true" /></button></div>
          <form method="get" onSubmit={handleSubmit}>
            <div className="grid gap-4"><FilterFields brands={brands} categories={categories} productTypes={productTypes} filters={filters} idPrefix="mobile" /></div>
            {filters.query && <input type="hidden" name="q" value={filters.query} />}
            <div className="sticky bottom-0 mt-6 flex gap-3 border-t border-slate-100 bg-white pt-4"><button type="button" onClick={() => { navigate({ query: filters.query, sort: 'newest', availability: 'all', page: 1 }); setIsOpen(false) }} disabled={!active} className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100">Clear all</button><button type="submit" className="min-h-11 flex-[1.3] rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-emerald-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 active:scale-[0.98]"><Check className="mr-2 inline-block h-4 w-4" aria-hidden="true" />Apply filters</button></div>
          </form>
        </section>
      </div>}
    </>
  )
}
