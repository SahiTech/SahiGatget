import type { Metadata } from 'next'
import Link from 'next/link'

import { CatalogFilters } from '@/components/catalog/catalog-filters'
import { CatalogPagination } from '@/components/catalog/catalog-pagination'
import { ProductGrid } from '@/components/product/product-card'
import { PageIntro } from '@/components/storefront/page-intro'
import { getBrands, getCategories, getProductTypes, getProducts, parsePage, parsePrice, type ProductFilters } from '@/lib/services/storefront'

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams
  const hasQueryState = Object.values(params).some((value) => Array.isArray(value) ? value.some(Boolean) : Boolean(value))
  return {
    title: 'Shop the catalogue',
    description: 'Browse published mobile phones and gadgets from the SahiGadget catalogue.',
    alternates: { canonical: '/products' },
    robots: hasQueryState ? { index: false, follow: true } : { index: true, follow: true },
  }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>
function valueOf(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value }

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const availability = valueOf(params.availability)
  const sort = valueOf(params.sort)
  const filters: ProductFilters = {
    query: valueOf(params.q),
    category: valueOf(params.category),
    brand: valueOf(params.brand),
    availability: availability === 'in-stock' || availability === 'low-stock' ? availability : 'all',
    productType: valueOf(params.type),
    minPrice: parsePrice(valueOf(params.min)),
    maxPrice: parsePrice(valueOf(params.max)),
    sort: sort === 'featured' || sort === 'price-asc' || sort === 'price-desc' ? sort : 'newest',
    page: parsePage(valueOf(params.page)),
    pageSize: 12,
  }
  const [result, brands, categories, productTypes] = await Promise.all([getProducts(filters), getBrands(), getCategories(), getProductTypes()])
  return <main className="flex-1"><PageIntro eyebrow="Live catalogue" title="Shop the catalogue" description="Explore published products with customer-safe availability, authoritative variant pricing, and shareable URL filters." /><div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><CatalogFilters brands={brands} categories={categories} productTypes={productTypes} filters={filters} /><div className="mt-8 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-slate-950">{result.total} product{result.total === 1 ? '' : 's'}</p><p className="mt-1 text-xs text-slate-500">Prices are read from the live product variant records.</p></div>{result.pageCount > 1 && <p className="text-xs font-semibold text-slate-400">Page {result.page} of {result.pageCount}</p>}</div><div className="mt-8">{result.products.length ? <ProductGrid products={result.products} /> : <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><p className="text-xl font-black text-slate-950">No matching products</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Try clearing a filter or searching for another product, brand, SKU, or variant attribute.</p><Link href="/products" className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 hover:text-slate-950">Clear filters</Link></div>}</div><CatalogPagination filters={filters} page={result.page} pageCount={result.pageCount} /></div></main>
}
