import type { Metadata } from 'next'
import Link from 'next/link'

import { BrandCard } from '@/components/storefront/discovery-card'
import { PageIntro } from '@/components/storefront/page-intro'
import { getBrands } from '@/lib/services/storefront'

export const metadata: Metadata = { title: 'Browse brands', description: 'Explore active mobile phone and gadget brands available through the SahiGadget catalogue.', alternates: { canonical: '/brands' } }

export default async function BrandsPage() {
  const brands = await getBrands()
  return <main className="flex-1"><PageIntro eyebrow="Shop by maker" title="Browse brands" description="Explore active brands from the live catalogue. Brand content is shown only when it exists in the public data layer." /><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">{brands.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{brands.map((brand) => <BrandCard key={brand.id} brand={brand} />)}</div> : <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><p className="text-xl font-black text-slate-950">No brands published yet</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Brands will appear here as soon as active records are added to the live catalogue.</p><Link href="/products" className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 hover:text-slate-950">Browse products</Link></div>}</div></main>
}
