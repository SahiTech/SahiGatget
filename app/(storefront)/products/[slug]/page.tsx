import type { Metadata } from 'next'
/* eslint-disable @next/next/no-img-element -- product recommendations use stored Supabase image URLs directly, matching the product gallery. */
import { notFound } from 'next/navigation'

import { siteConfig } from '@/config/site'
import { ProductDetailInteractive } from '@/components/product/product-detail-interactive'
import { getProductBySlug, getRelatedProducts } from '@/lib/services/storefront'
import { formatPrice, getProductMetaDescription, getProductMetaTitle, getProductPrimaryImage, getStartingPrice } from '@/lib/services/storefront-utils'

export const revalidate = 60

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: 'Product not found' }

  const title = getProductMetaTitle(product).replace(/\s*[|·—-]\s*SahiGadget$/i, '')
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
    ...(product.category ? [{ label: product.category.name, href: `/products?category=${encodeURIComponent(product.category.slug)}` }] : []),
    { label: product.name, href: `/products/${encodeURIComponent(product.slug)}` },
  ]
}

export default async function ProductDetailPage({ params }: { params: Params }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const primaryImage = getProductPrimaryImage(product)
  const breadcrumbItems = getProductBreadcrumbItems(product)
  const relatedCandidates = await getRelatedProducts(product, 8)
  const currentPrice = getStartingPrice(product)
  const sameCategory = relatedCandidates.filter((candidate) => candidate.id !== product.id && candidate.category?.id === product.category?.id)
  const priceMatched = sameCategory.filter((candidate) => {
    const price = getStartingPrice(candidate)
    return price !== null && (currentPrice === null || (price >= currentPrice * 0.5 && price <= currentPrice * 1.75))
  })
  const relatedProducts = [...(priceMatched.length ? priceMatched : sameCategory)]
    .sort((a, b) => Math.abs((getStartingPrice(a) ?? currentPrice ?? 0) - (currentPrice ?? 0)) - Math.abs((getStartingPrice(b) ?? currentPrice ?? 0) - (currentPrice ?? 0)))
    .slice(0, 4)
  const productUrl = `${siteConfig.url}/products/${encodeURIComponent(product.slug)}`
  const productId = `${productUrl}#product`
  const brandEntity = product.brand ? { '@type': 'Brand', '@id': `${siteConfig.url}/brands/${encodeURIComponent(product.brand.slug)}#brand`, name: product.brand.name } : undefined
  const variesBy = [
    product.variants.some((variant) => variant.color) ? 'https://schema.org/color' : null,
    product.variants.some((variant) => variant.ram || variant.storage || variant.variant_title) ? 'https://schema.org/additionalProperty' : null,
  ].filter((value): value is string => Boolean(value))
  const variantEntities = product.variants.map((variant, index) => {
    const variantProperties = [
      variant.ram ? { '@type': 'PropertyValue', name: 'RAM', value: variant.ram } : null,
      variant.storage ? { '@type': 'PropertyValue', name: 'Storage', value: variant.storage } : null,
      variant.variant_title ? { '@type': 'PropertyValue', name: 'Variant', value: variant.variant_title } : null,
    ].filter((property): property is { '@type': string; name: string; value: string } => Boolean(property))
    return {
      '@type': 'Product',
      '@id': `${productId}#variant-${index + 1}`,
      name: `${product.name}${variant.variant_title ? ` · ${variant.variant_title}` : ''}`,
      description: product.short_description || product.description || undefined,
      image: primaryImage ? [primaryImage] : undefined,
      sku: variant.sku || undefined,
      color: variant.color || undefined,
      brand: brandEntity,
      category: product.category?.name || undefined,
      isVariantOf: { '@id': productId },
      additionalProperty: variantProperties.length ? variantProperties : undefined,
      offers: {
        '@type': 'Offer',
        url: productUrl,
        priceCurrency: siteConfig.currency.code,
        price: variant.price,
        availability: variant.is_in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', '@id': `${siteConfig.url}/#organization`, name: siteConfig.name },
      },
    }
  })
  const productEntity = product.variants.length > 1 ? {
    '@type': 'ProductGroup',
    '@id': productId,
    name: product.name,
    description: product.short_description || product.description || undefined,
    url: productUrl,
    image: primaryImage ? [primaryImage] : undefined,
    brand: brandEntity,
    category: product.category?.name || undefined,
    productGroupID: product.slug,
    ...(variesBy.length ? { variesBy } : {}),
    hasVariant: variantEntities,
  } : variantEntities[0] ?? {
    '@type': 'Product',
    '@id': productId,
    name: product.name,
    description: product.short_description || product.description || undefined,
    image: primaryImage ? [primaryImage] : undefined,
    brand: brandEntity,
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

  return <main className="flex-1"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><div className="mx-auto max-w-7xl px-4 pb-20 pt-4 sm:px-6 sm:pt-5 lg:px-8"><ProductDetailInteractive product={product} />
    {relatedProducts.length > 0 ? <section aria-labelledby="related-products-title" className="mt-10 border-t border-slate-200 pt-7 sm:mt-14 sm:pt-9">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-600">You may also like</p><h2 id="related-products-title" className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Similar feature phones</h2><p className="mt-1 text-sm text-slate-500">Closest matches from the same category and price range.</p></div>
        {product.category ? <a href={'/products?category=' + encodeURIComponent(product.category.slug)} className="shrink-0 text-xs font-bold text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-orange-700">View all</a> : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {relatedProducts.map((candidate) => {
          const price = getStartingPrice(candidate)
          const image = getProductPrimaryImage(candidate)
          const compareAt = candidate.variants.map((variant) => variant.compare_at_price).filter((value): value is number => value !== null).sort((a, b) => b - a)[0]
          return <a key={candidate.id} href={'/products/' + encodeURIComponent(candidate.slug)} className="group min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md sm:p-3">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-50">{image ? <img src={image} alt={candidate.name} loading="lazy" decoding="async" className="h-full w-full object-contain p-3 transition-transform duration-200 group-hover:scale-[1.03]" /> : <span className="text-2xl font-black text-slate-300">{candidate.name.slice(0, 2).toUpperCase()}</span>}</div>
            <p className="mt-3 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-900 group-hover:text-orange-700">{candidate.name}</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span className="text-sm font-black text-slate-950">{price === null ? 'Price on request' : formatPrice(price)}</span>{compareAt && price !== null && compareAt > price ? <span className="text-[11px] text-slate-400 line-through">{formatPrice(compareAt)}</span> : null}</div>
          </a>
        })}
      </div>
    </section> : null}
  </div></main>
}
