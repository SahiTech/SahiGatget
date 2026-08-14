/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { ArrowUpRight, Layers3, Sparkles } from 'lucide-react'

import type { StorefrontBrand, StorefrontCategory } from '@/lib/services/storefront'

// Mapping of category slugs to high-quality fallback visuals from existing catalogue
const categoryFallbacks: Record<string, string> = {
  'feature-phone': 'https://ncknpaezdhsqiicdjtgr.supabase.co/storage/v1/object/public/product-images/e4db52a2-114f-4ce5-8fec-41f69343bc1d/samsung-guru-music-2-main-320w.webp',
  'smartwatch': 'https://ncknpaezdhsqiicdjtgr.supabase.co/storage/v1/object/public/product-images/2d6c8454-98f1-4068-bb11-1a866f87a7b2/black-1.jpeg',
}

export function BrandCard({ brand }: { brand: StorefrontBrand }) {
  return (
    <Link 
      href={`/products?brand=${encodeURIComponent(brand.slug)}`} 
      className="group rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-900/8 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 text-lg font-black text-emerald-300">
          {brand.logo_url ? (
            <>
              <span className="sr-only">{brand.name} logo</span>
              <img src={brand.logo_url} alt={`${brand.name} logo`} className="h-full w-full object-contain bg-white p-2" />
            </>
          ) : (
            brand.name.slice(0, 2).toUpperCase()
          )}
        </div>
        <ArrowUpRight className="h-5 w-5 text-slate-300 transition-colors group-hover:text-emerald-600" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-lg font-black tracking-tight text-slate-950">{brand.name}</h2>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{brand.description || 'Explore published products from this brand.'}</p>
      <span className="mt-4 inline-flex text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">Browse products</span>
    </Link>
  )
}

export function CategoryCard({ category }: { category: StorefrontCategory }) {
  const imageUrl = category.image_url || categoryFallbacks[category.slug]

  return (
    <Link 
      href={`/products?category=${encodeURIComponent(category.slug)}`} 
      className="group relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 min-h-[210px] flex flex-col justify-between"
    >
      {imageUrl ? (
        <div className="absolute inset-0 z-0">
          <img src={imageUrl} alt="" className="h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/10" />
        </div>
      ) : (
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.3),transparent_60%),radial-gradient(circle_at_10%_90%,rgba(14,165,233,0.25),transparent_60%)] transition-transform duration-700 group-hover:scale-105" />
      )}

      <div className="relative z-10 flex items-center justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-xl text-emerald-300 shadow-inner border border-white/10 group-hover:bg-emerald-400 group-hover:text-slate-950 transition-colors duration-300">
          <Layers3 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-xl text-white transition-all group-hover:bg-emerald-400 group-hover:text-slate-950 shadow-md">
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>

      <div className="relative z-10 mt-8">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 mb-1">
          <Sparkles className="h-3 w-3" /> Category
        </div>
        <h2 className="text-xl font-black tracking-tight text-white">{category.name}</h2>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-300">{category.description || 'Explore verified devices in this collection.'}</p>
      </div>
    </Link>
  )
}
