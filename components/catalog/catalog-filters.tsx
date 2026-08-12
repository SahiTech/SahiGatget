import Link from 'next/link'

import type { StorefrontBrand, StorefrontCategory, ProductFilters } from '@/lib/services/storefront'

export function CatalogFilters({ brands, categories, productTypes, filters }: { brands: StorefrontBrand[]; categories: StorefrontCategory[]; productTypes: string[]; filters: ProductFilters }) {
  return (
    <form method="get" className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="category" className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Category</label>
          <select id="category" name="category" defaultValue={filters.category || ''} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-100">
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="brand" className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Brand</label>
          <select id="brand" name="brand" defaultValue={filters.brand || ''} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-100">
            <option value="">All brands</option>
            {brands.map((brand) => <option key={brand.id} value={brand.slug}>{brand.name}</option>)}
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="availability" className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Availability</label>
          <select id="availability" name="availability" defaultValue={filters.availability || 'all'} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-100">
            <option value="all">All products</option>
            <option value="in-stock">In stock</option>
            <option value="low-stock">Low stock</option>
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="type" className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Product type</label>
          <select id="type" name="type" defaultValue={filters.productType || ''} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-100">
            <option value="">All product types</option>
            {productTypes.map((type) => <option key={type} value={type}>{type.replace(/[-_]/g, ' ')}</option>)}
          </select>
        </div>
        <div className="min-w-0 flex-[1.2]">
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Price range</label>
          <div className="flex gap-2"><input name="min" type="number" min="0" inputMode="numeric" defaultValue={filters.minPrice ?? ''} placeholder="Min ৳" aria-label="Minimum price" className="h-11 min-w-0 w-1/2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-100" /><input name="max" type="number" min="0" inputMode="numeric" defaultValue={filters.maxPrice ?? ''} placeholder="Max ৳" aria-label="Maximum price" className="h-11 min-w-0 w-1/2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-100" /></div>
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="sort" className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Sort by</label>
          <select id="sort" name="sort" defaultValue={filters.sort || 'newest'} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-100">
            <option value="newest">Newest</option>
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>
        <button type="submit" className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">Apply filters</button>
      </div>
      {(filters.category || filters.brand || filters.productType || filters.minPrice !== undefined || filters.maxPrice !== undefined || filters.availability && filters.availability !== 'all' || filters.sort && filters.sort !== 'newest') && <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500"><span>Filters are reflected in the URL so this view is shareable.</span><Link href="/products" className="font-bold text-slate-900 underline underline-offset-4 hover:text-emerald-700">Clear filters</Link></div>}
      {filters.query && <input type="hidden" name="q" value={filters.query} />}
      {filters.page && filters.page > 1 && <input type="hidden" name="page" value="1" />}
    </form>
  )
}
