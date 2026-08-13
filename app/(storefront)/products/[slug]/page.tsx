import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'

import { siteConfig } from '@/config/site'
import { ProductDetailInteractive } from '@/components/product/product-detail-interactive'
import { Breadcrumbs } from '@/components/storefront/page-intro'
import { getProductBySlug, getProductMetaDescription, getProductMetaTitle, getStorefrontSettings } from '@/lib/services/storefront'

export const dynamic = 'force-dynamic'

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: 'Product not found' }
  return { title: getProductMetaTitle(product), description: getProductMetaDescription(product), alternates: { canonical: `/products/${product.slug}` }, openGraph: { title: getProductMetaTitle(product), description: getProductMetaDescription(product), url: `/products/${product.slug}`, type: 'website' } }
}

export default async function ProductDetailPage({ params }: { params: Params }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()
  const settings = await getStorefrontSettings()
  return <main className="flex-1"><div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8"><Breadcrumbs items={[{ label: 'Products', href: '/products' }, ...(product.category ? [{ label: product.category.name, href: `/products?category=${encodeURIComponent(product.category.slug)}` }] : []), { label: product.name, href: `/products/${product.slug}` }]} /><div className="mt-8"><ProductDetailInteractive product={product} warranty={settings.warranty.policyText} phone={siteConfig.contact.phone} /></div>{(product.description || product.short_description) && <section className="mt-16 grid gap-8 border-t border-slate-200 pt-12 lg:grid-cols-[0.7fr_1.3fr]"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Product information</p><h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">Know what you are choosing.</h2></div><div className="prose prose-slate max-w-none text-sm leading-8 text-slate-600"><p>{product.description || product.short_description}</p></div></section>}{product.brand && <section className="mt-12 rounded-[1.5rem] bg-slate-950 p-7 text-white sm:p-9"><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">More from {product.brand.name}</p><h2 className="mt-3 text-2xl font-black tracking-tight">Explore the full brand catalogue.</h2><Link href={`/products?brand=${encodeURIComponent(product.brand.slug)}`} className="mt-5 inline-flex rounded-full bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-emerald-300">Browse {product.brand.name}</Link></section>}</div></main>
}
