import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, CheckCircle2 } from 'lucide-react'

import { BrandLogo } from '@/components/storefront/brand-logo'
import { ProductGrid } from '@/components/product/product-card'
import { siteConfig } from '@/config/site'
import { getBrandBySlug, getBrandDescription, getBrandMetaTitle, getBrandPath, getProducts } from '@/lib/services/storefront'

export const revalidate = 300

type BrandPageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { slug } = await params
  const brand = await getBrandBySlug(slug)
  if (!brand) return { title: 'Brand not found' }
  return { title: getBrandMetaTitle(brand), description: brand.meta_description || getBrandDescription(brand), alternates: { canonical: getBrandPath(brand.slug) } }
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { slug } = await params
  const brand = await getBrandBySlug(slug)
  if (!brand) notFound()
  const result = await getProducts({ brand: brand.slug, pageSize: 48 })
  const breadcrumbItems = [
    { name: 'Home', url: `${siteConfig.url}/` },
    { name: 'Brands', url: `${siteConfig.url}/brands` },
    { name: brand.name, url: `${siteConfig.url}/brands/${encodeURIComponent(brand.slug)}` },
  ]
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Brand',
        name: brand.name,
        url: breadcrumbItems[2].url,
        ...(brand.logo_url ? { logo: brand.logo_url } : {}),
        description: getBrandDescription(brand),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((item, position) => ({ '@type': 'ListItem', position: position + 1, name: item.name, item: item.url })),
      },
    ],
  }

  return <main className="flex-1 bg-slate-50"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8"><nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500"><Link href="/" className="transition-colors hover:text-emerald-700">Home</Link><span aria-hidden="true">/</span><Link href="/brands" className="transition-colors hover:text-emerald-700">Brands</Link><span aria-hidden="true">/</span><span className="text-slate-900">{brand.name}</span></nav><section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10"><div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-5 sm:gap-7"><BrandLogo brand={brand} size="lg" className="bg-white" /><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Verified catalogue brand</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">{brand.name}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">{getBrandDescription(brand)}</p></div></div><div className="grid shrink-0 gap-3 sm:grid-cols-2 md:grid-cols-1"><div className="rounded-2xl bg-slate-50 px-5 py-4"><p className="text-2xl font-black text-slate-950">{result.total}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Published products</p></div><div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Active catalogue</div></div></div></section><div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Shop {brand.name}</p><h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Available products</h2></div><Link href="/brands" className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 transition-colors hover:text-emerald-700"><ArrowLeft className="h-4 w-4" aria-hidden="true" />All brands</Link></div>{result.products.length ? <div className="mt-6"><ProductGrid products={result.products} /></div> : <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><p className="text-xl font-black text-slate-950">No published products yet</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">This brand is active, but its catalogue is being prepared. Browse all products to continue exploring.</p><Link href="/products" className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-600 hover:text-slate-950">Browse products <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link></div>}</div></main>
}
