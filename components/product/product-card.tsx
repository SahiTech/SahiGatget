import Link from 'next/link'
import { ArrowUpRight, PackageCheck } from 'lucide-react'

import type { StorefrontProduct } from '@/lib/services/storefront-utils'
import { formatPrice, getCompareAtPrice, getProductAvailability, getProductDiscount, getProductImageAlt, getProductImageUrl, getProductPriceRange, getProductVariantSummary } from '@/lib/services/storefront-utils'

function AvailabilityPill({ product }: { product: StorefrontProduct }) {
  const availability = getProductAvailability(product)
  const styles = availability.tone === 'in' ? 'bg-emerald-50 text-emerald-700' : availability.tone === 'low' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${styles}`}><PackageCheck className="h-3 w-3" aria-hidden="true" />{availability.label}</span>
}

export function ProductMedia({ product, className = '' }: { product: StorefrontProduct; className?: string }) {
  const imageUrl = getProductImageUrl(product)
  return (
    <div className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[1.25rem] bg-[radial-gradient(circle_at_50%_35%,#ffffff_0%,#eef5f2_44%,#dce9e4_100%)] ${className}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={getProductImageAlt(product)} className="h-full w-full object-contain p-8 transition-transform duration-300 group-hover:scale-105" />
      ) : (
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-slate-950 text-2xl font-black tracking-tight text-emerald-300 shadow-xl shadow-slate-950/15">{product.name.slice(0, 2).toUpperCase()}</div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Image coming soon</p>
        </div>
      )}
      {getProductDiscount(product) && <span className="absolute left-3 top-3 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-black text-emerald-300">-{getProductDiscount(product)}%</span>}
    </div>
  )
}

export function ProductCard({ product }: { product: StorefrontProduct }) {
  const variantSummary = getProductVariantSummary(product)
  const compareAt = getCompareAtPrice(product)
  const priceRange = getProductPriceRange(product)
  return (
    <article className="group flex h-full flex-col rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-900/8">
      <Link href={`/products/${product.slug}`} className="block rounded-[1.25rem] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200" aria-label={`View ${product.name}`}>
        <ProductMedia product={product} />
      </Link>
      <div className="flex flex-1 flex-col px-2 pb-2 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          <span className="min-w-0 flex-1 truncate">{product.brand?.name || 'SahiGadget'}</span>
          {product.is_featured && <span className="shrink-0 text-emerald-600">Featured</span>}
        </div>
        <Link href={`/products/${product.slug}`} className="mt-2 block focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">
          <h2 className="line-clamp-2 text-base font-black leading-6 tracking-tight text-slate-950 transition-colors group-hover:text-emerald-700">{product.name}</h2>
        </Link>
        {variantSummary.length > 0 && <p className="mt-2 line-clamp-1 text-xs text-slate-500">{variantSummary.join(' · ')}</p>}
        <div className="mt-auto pt-5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-black tracking-tight text-slate-950">{priceRange ? `From ${priceRange}` : 'Price on request'}</span>
            {compareAt && <span className="text-xs font-medium text-slate-400 line-through">{formatPrice(compareAt)}</span>}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="shrink-0">
              <AvailabilityPill product={product} />
            </div>
            <Link href={`/products/${product.slug}`} className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 transition-colors hover:text-emerald-700" aria-label={`View details for ${product.name}`}>Details <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
          </div>
        </div>
      </div>
    </article>
  )
}

export function ProductGrid({ products }: { products: StorefrontProduct[] }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
}
