import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { getPaginationPages, type ProductFilters } from '@/lib/services/storefront'

export function CatalogPagination({ filters, page, pageCount }: { filters: ProductFilters; page: number; pageCount: number }) {
  if (pageCount <= 1) return null
  const pages = getPaginationPages(page, pageCount)
  function href(nextPage: number) {
    const params = new URLSearchParams()
    if (filters.query) params.set('q', filters.query)
    if (filters.category) params.set('category', filters.category)
    if (filters.brand) params.set('brand', filters.brand)
    if (filters.availability && filters.availability !== 'all') params.set('availability', filters.availability)
    if (filters.productType) params.set('type', filters.productType)
    if (filters.minPrice !== undefined) params.set('min', String(filters.minPrice))
    if (filters.maxPrice !== undefined) params.set('max', String(filters.maxPrice))
    if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort)
    params.set('page', String(nextPage))
    return `/products?${params.toString()}`
  }
  return (
    <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Catalogue pagination">
      {page > 1 ? <Link href={href(page - 1)} className="inline-flex h-10 items-center gap-1 rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-700 transition-colors hover:border-slate-950 hover:text-slate-950"><ChevronLeft className="h-4 w-4" />Previous</Link> : <span className="inline-flex h-10 items-center gap-1 rounded-full border border-slate-100 px-4 text-sm font-bold text-slate-300"><ChevronLeft className="h-4 w-4" />Previous</span>}
      <div className="flex items-center gap-1" aria-label={`Page ${page} of ${pageCount}`}>
        {pages.map((item) => <Link key={item} href={href(item)} aria-current={item === page ? 'page' : undefined} className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-bold transition-colors ${item === page ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{item}</Link>)}
      </div>
      {page < pageCount ? <Link href={href(page + 1)} className="inline-flex h-10 items-center gap-1 rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-700 transition-colors hover:border-slate-950 hover:text-slate-950">Next<ChevronRight className="h-4 w-4" /></Link> : <span className="inline-flex h-10 items-center gap-1 rounded-full border border-slate-100 px-4 text-sm font-bold text-slate-300">Next<ChevronRight className="h-4 w-4" /></span>}
    </nav>
  )
}
