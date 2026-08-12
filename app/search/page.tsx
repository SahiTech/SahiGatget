import type { Metadata } from 'next'
import Link from 'next/link'
import { Search } from 'lucide-react'

import { ProductGrid } from '@/components/product/product-card'
import { PageIntro } from '@/components/storefront/page-intro'
import { getProducts } from '@/lib/services/storefront'

export const metadata: Metadata = { title: 'Search the catalogue', description: 'Search published SahiGadget products by name, brand, SKU, and variant information.', alternates: { canonical: '/search' } }

type SearchParams = Promise<Record<string, string | string[] | undefined>>
function valueOf(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value }

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const query = valueOf(params.q)?.trim() || ''
  const result = query ? await getProducts({ query, pageSize: 12, page: 1, sort: 'newest' }) : { products: [], total: 0, page: 1, pageSize: 12, pageCount: 0 }
  return <main className="flex-1"><PageIntro eyebrow="Find a product" title="Search the catalogue" description="Search published products by name, brand, SKU, or variant details. Search runs on the server against the public catalogue." /><div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><form method="get" className="mx-auto flex max-w-3xl items-center rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-sm focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-emerald-100"><label htmlFor="search-query" className="sr-only">Search the catalogue</label><Search className="ml-4 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" /><input id="search-query" name="q" defaultValue={query} placeholder="Search phones, gadgets, brands, or SKU" className="h-12 min-w-0 flex-1 bg-transparent px-4 text-sm text-slate-950 outline-none placeholder:text-slate-400" /><button type="submit" className="h-12 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition-colors hover:bg-emerald-500 hover:text-slate-950">Search</button></form>{query ? <div className="mt-10"><div className="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold text-slate-950">{result.total} result{result.total === 1 ? '' : 's'} for “{query}”</p><p className="mt-1 text-xs text-slate-500">Only published products are included.</p></div><Link href="/search" className="text-xs font-bold text-slate-500 underline underline-offset-4 hover:text-slate-950">Clear search</Link></div><div className="mt-8">{result.products.length ? <ProductGrid products={result.products} /> : <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><p className="text-xl font-black text-slate-950">No results found</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">No published products matched “{query}”. Try a different product name, brand, SKU, or variant attribute.</p><Link href="/products" className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 hover:text-slate-950">Browse all products</Link></div>}</div></div> : <div className="mx-auto mt-14 max-w-2xl rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><p className="text-xl font-black text-slate-950">What are you looking for?</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Search by product name, brand, SKU, RAM, storage, or colour. The storefront will keep the result set bounded and server-resolved.</p></div>}</div></main>
}
