import type { Metadata } from 'next'
import Link from 'next/link'

import { CategoryCard } from '@/components/storefront/discovery-card'
import { PageIntro } from '@/components/storefront/page-intro'
import { getCategories } from '@/lib/services/storefront'

export const metadata: Metadata = { title: 'Browse categories', description: 'Explore active mobile phone and gadget categories from the SahiGadget catalogue.', alternates: { canonical: '/categories' } }

export default async function CategoriesPage() {
  const categories = await getCategories()
  return <main className="flex-1"><PageIntro eyebrow="Find your fit" title="Browse categories" description="Explore the active product categories in the live catalogue, arranged for quick discovery on mobile and desktop." /><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">{categories.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category) => <CategoryCard key={category.id} category={category} />)}</div> : <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><p className="text-xl font-black text-slate-950">No categories published yet</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Categories will appear here as soon as active records are added to the live catalogue.</p><Link href="/products" className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 hover:text-slate-950">Browse products</Link></div>}</div></main>
}
