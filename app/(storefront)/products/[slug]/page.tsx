import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'

import { siteConfig } from '@/config/site'
import { ProductDetailInteractive } from '@/components/product/product-detail-interactive'
import { ProductGrid } from '@/components/product/product-card'
import { getProductBySlug, getRelatedProducts, getStorefrontSettings } from '@/lib/services/storefront'
import { formatPrice, getCategoryPath, getProductMetaDescription, getProductMetaTitle, getProductPrimaryImage } from '@/lib/services/storefront-utils'

export const dynamic = 'force-dynamic'

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: 'Product not found' }

  const title = getProductMetaTitle(product)
  const description = getProductMetaDescription(product)
  const image = getProductPrimaryImage(product)
  return {
    title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title, description, url: `/products/${product.slug}`, type: 'website', images: image ? [{ url: image, alt: title }] : [] },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : [] },
  }
}

type ProductForSeo = Awaited<ReturnType<typeof getProductBySlug>> extends infer T ? Exclude<T, null> : never

function getProductBreadcrumbItems(product: ProductForSeo) {
  return [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
    ...(product.brand ? [{ label: product.brand.name, href: `/brands/${encodeURIComponent(product.brand.slug)}` }] : []),
    ...(product.category ? [{ label: product.category.name, href: getCategoryPath(product.category.slug) }] : []),
    { label: product.name, href: `/products/${encodeURIComponent(product.slug)}` },
  ]
}

function ProductBreadcrumbs({ product }: { product: ProductForSeo }) {
  const items = getProductBreadcrumbItems(product)
  return <nav aria-label="Breadcrumb" className="min-w-0 overflow-hidden text-xs font-semibold text-slate-500"><ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">{items.map((item, index) => <li key={`${item.href}-${item.label}`} className="inline-flex min-w-0 items-center gap-2">{index === items.length - 1 ? <span aria-current="page" className="min-w-0 max-w-full truncate font-bold text-slate-950">{item.label}</span> : <><Link href={item.href} className="max-w-[12rem] truncate transition-colors hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">{item.label}</Link><span aria-hidden="true" className="text-slate-300">/</span></>}</li>)}</ol></nav>
}

export default async function ProductDetailPage({ params }: { params: Params }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const settings = await getStorefrontSettings()
  const relatedProducts = await getRelatedProducts(product, 4)
  const primaryImage = getProductPrimaryImage(product)
  const ramValues = Array.from(new Set(product.variants.map((variant) => variant.ram).filter(Boolean))).join(' · ')
  const storageValues = Array.from(new Set(product.variants.map((variant) => variant.storage).filter(Boolean))).join(' · ')
  const colourValues = Array.from(new Set(product.variants.map((variant) => variant.color).filter(Boolean))).join(' · ')
  const specRows = [
    product.brand ? ['Brand', product.brand.name] as [string, string] : null,
    product.category ? ['Category', product.category.name] as [string, string] : null,
    product.product_type ? ['Product type', product.product_type.replace(/[-_]/g, ' ')] as [string, string] : null,
    ramValues ? ['RAM', ramValues] as [string, string] : null,
    storageValues ? ['Storage', storageValues] as [string, string] : null,
    colourValues ? ['Colour', colourValues] as [string, string] : null,
  ].filter((row): row is [string, string] => Boolean(row))
  const breadcrumbItems = getProductBreadcrumbItems(product)
  const variantEntities = product.variants.map((variant) => ({
    '@type': 'Product',
    name: `${product.name}${variant.variant_title ? ` · ${variant.variant_title}` : ''}`,
    description: product.short_description || product.description || undefined,
    image: primaryImage ? [primaryImage] : undefined,
    sku: variant.sku || undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    category: product.category?.name || undefined,
    offers: {
      '@type': 'Offer',
      url: `${siteConfig.url}/products/${product.slug}`,
      priceCurrency: siteConfig.currency.code,
      price: variant.price,
      availability: variant.is_in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: siteConfig.name },
    },
  }))
  const productEntity = product.variants.length > 1 ? {
    '@type': 'ProductGroup',
    name: product.name,
    description: product.short_description || product.description || undefined,
    url: `${siteConfig.url}/products/${product.slug}`,
    image: primaryImage ? [primaryImage] : undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    category: product.category?.name || undefined,
    hasVariant: variantEntities,
  } : variantEntities[0] ?? {
    '@type': 'Product',
    name: product.name,
    description: product.short_description || product.description || undefined,
    image: primaryImage ? [primaryImage] : undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    category: product.category?.name || undefined,
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      productEntity,
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((item, position) => ({ '@type': 'ListItem', position: position + 1, name: item.label, item: `${siteConfig.url}${item.href}` })),
      },
    ],
  }

  return <main className="flex-1"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8"><ProductBreadcrumbs product={product} /><div className="mt-7"><ProductDetailInteractive product={product} settings={settings} phone={siteConfig.contact.phone} /></div>

    <div className="mt-16 grid gap-6 border-t border-slate-200 pt-12 lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)]"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Product information</p><h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">Know what you are choosing.</h2><p className="mt-4 max-w-sm text-sm leading-7 text-slate-500">Review the available product details, specifications, and store policies before placing an order.</p></div><div className="space-y-3">{product.description ? <details open className="group rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer list-none text-base font-black text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"><span className="flex items-center justify-between gap-4">Detailed description<span className="text-emerald-600 transition-transform duration-150 group-open:rotate-45">+</span></span></summary><div className="prose prose-slate mt-4 max-w-none text-sm leading-8 text-slate-600"><p className="whitespace-pre-line">{product.description}</p></div></details> : null}{specRows.length > 0 ? <details open className="group rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer list-none text-base font-black text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"><span className="flex items-center justify-between gap-4">Specifications<span className="text-emerald-600 transition-transform duration-150 group-open:rotate-45">+</span></span></summary><dl className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">{specRows.map(([label, value]) => <div key={label} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[.35fr_1fr] sm:gap-4"><dt className="font-semibold text-slate-500">{label}</dt><dd className="break-words font-bold capitalize text-slate-950">{value}</dd></div>)}</dl></details> : null}<details open className="group rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer list-none text-base font-black text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"><span className="flex items-center justify-between gap-4">Warranty & delivery<span className="text-emerald-600 transition-transform duration-150 group-open:rotate-45">+</span></span></summary><div className="mt-4 grid gap-4 text-sm leading-6 text-slate-600 sm:grid-cols-2"><div><p className="font-bold text-slate-950">Warranty</p><p className="mt-1">{product.warranty_policy || settings.warranty.policyText}</p><Link href="/warranty" className="mt-2 inline-block font-bold text-emerald-700 underline underline-offset-4">Read warranty policy</Link></div><div><p className="font-bold text-slate-950">Delivery across Bangladesh</p><p className="mt-1">Dhaka {formatPrice(settings.delivery.dhakaCharge)} · Outside Dhaka {formatPrice(settings.delivery.outsideDhakaCharge)}</p><Link href="/shipping" className="mt-2 inline-block font-bold text-emerald-700 underline underline-offset-4">Read delivery policy</Link></div></div></details></div></div>

    {relatedProducts.length > 0 ? <section className="mt-16 border-t border-slate-200 pt-12" aria-labelledby="related-products-heading"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Continue exploring</p><h2 id="related-products-heading" className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">You may also like</h2><p className="mt-2 text-sm text-slate-500">Relevant products from the same catalogue, ranked by category, type, brand, and name similarity.</p></div><Link href="/products" className="text-sm font-bold text-slate-900 underline decoration-emerald-500 underline-offset-4 hover:text-emerald-700">Browse all products</Link></div><div className="mt-7"><ProductGrid products={relatedProducts} /></div></section> : null}

    {product.brand ? <section className="mt-16 rounded-[1.75rem] bg-slate-950 p-7 text-white sm:p-9"><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">More from {product.brand.name}</p><h2 className="mt-3 text-2xl font-black tracking-tight">Explore the full brand catalogue.</h2><Link href={`/brands/${encodeURIComponent(product.brand.slug)}`} className="mt-5 inline-flex rounded-full bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition duration-150 hover:bg-emerald-300 active:scale-[.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">Browse {product.brand.name}</Link></section> : null}
  </div></main>
}
