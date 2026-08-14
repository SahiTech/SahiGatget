'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Check, PackageCheck, Phone, ShieldCheck } from 'lucide-react'

import type { StorefrontProduct } from '@/lib/services/storefront-utils'
import { getProductImageAlt, getProductImageUrl, getProductDiscount, formatPrice, getVariantLabel, getPublicAvailability } from '@/lib/services/storefront-utils'
import { siteConfig } from '@/config/site'

export function ProductDetailInteractive({ product, warranty, phone }: { product: StorefrontProduct; warranty: string; phone: string }) {
  const [selectedId, setSelectedId] = useState(product.variants[0]?.id || '')
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const selected = useMemo(() => product.variants.find((variant) => variant.id === selectedId) || product.variants[0] || null, [product.variants, selectedId])
  const status = selected ? getPublicAvailability([selected]) : { label: 'Price on request', tone: 'out' as const }
  const discount = getProductDiscount(product)
  const attributes = selected ? [selected.ram && ['RAM', selected.ram], selected.storage && ['Storage', selected.storage], selected.color && ['Colour', selected.color]].filter(Boolean) as string[][] : []

  const activeImage = product.images[activeImageIndex] || product.images[0]
  const imageUrl = activeImage?.image_url || getProductImageUrl(product)

  return (
    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
      <div>
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_50%_35%,#ffffff_0%,#eef5f2_42%,#d8e7e1_100%)] p-8 shadow-sm border border-slate-200">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={imageUrl} 
              alt={activeImage?.alt_text || getProductImageAlt(product)} 
              className="h-full w-full object-contain transition-transform duration-300" 
            />
          ) : (
            <div className="text-center">
              <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-[2rem] bg-slate-950 text-4xl font-black tracking-[-0.08em] text-emerald-300 shadow-2xl shadow-slate-950/20 sm:h-36 sm:w-36 sm:rounded-[2.5rem] sm:text-5xl">
                {product.name.slice(0, 2).toUpperCase()}
              </div>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 sm:text-[11px]">Product image coming soon</p>
            </div>
          )}
          {discount && (
            <span className="absolute left-6 top-6 rounded-full bg-slate-950 px-3.5 py-1.5 text-xs font-black text-emerald-300 shadow-lg">
              -{discount}%
            </span>
          )}
        </div>

        {/* Thumbnail gallery */}
        {product.images.length > 1 && (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {product.images.map((img, idx) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveImageIndex(idx)}
                className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-white transition-all ${activeImageIndex === idx ? 'border-emerald-600 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-400'}`}
                aria-label={`View image ${idx + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.image_url} alt={img.alt_text || product.name} className="h-full w-full object-contain p-2" />
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
            <ShieldCheck className="mx-auto h-5 w-5 text-emerald-600" />
            <p className="mt-2 text-[10px] font-bold text-slate-500 sm:text-[11px]">Warranty context</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
            <PackageCheck className="mx-auto h-5 w-5 text-emerald-600" />
            <p className="mt-2 text-[10px] font-bold text-slate-500 sm:text-[11px]">Live availability</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 text-center sm:col-span-1">
            <Check className="mx-auto h-5 w-5 text-emerald-600" />
            <p className="mt-2 text-[10px] font-bold text-slate-500 sm:text-[11px]">Public-safe data</p>
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 sm:text-xs">{product.brand?.name || 'SahiGadget'} · {product.product_type.replace(/[-_]/g, ' ')}</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950 sm:text-4xl md:text-5xl">{product.name}</h1>
        {product.short_description && (
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base sm:leading-8">{product.short_description}</p>
        )}
        
        <div className="mt-7 flex flex-wrap items-end gap-3">
          <p className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{selected ? formatPrice(selected.price) : 'Price on request'}</p>
          {selected?.compare_at_price && selected.compare_at_price > selected.price && (
            <>
              <p className="text-sm text-slate-400 line-through">{formatPrice(selected.compare_at_price)}</p>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700 sm:text-xs">Save {discount}%</span>
            </>
          )}
        </div>
        <p className="mt-2 text-[10px] text-slate-400 sm:text-xs">Current price from the selected live variant.</p>

        {product.variants.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-slate-950">Choose a variant</p>
              <span className="text-[10px] font-semibold text-slate-400 sm:text-xs">{product.variants.length} option{product.variants.length === 1 ? '' : 's'}</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {product.variants.map((variant) => {
                const variantStatus = getPublicAvailability([variant]);
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedId(variant.id)}
                    className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 ${selected?.id === variant.id ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                    aria-pressed={selected?.id === variant.id}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-950">{getVariantLabel(variant)}</span>
                      <span className="mt-1 block truncate text-[10px] text-slate-500 sm:text-xs">{formatPrice(variant.price)} · {variant.sku}</span>
                    </span>
                    <span className={`ml-3 shrink-0 text-[9px] font-black uppercase tracking-[0.12em] sm:text-[10px] ${variantStatus.tone === 'in' ? 'text-emerald-700' : variantStatus.tone === 'low' ? 'text-amber-700' : 'text-slate-400'}`}>
                      {variantStatus.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-black text-slate-950">Warranty & guarantee</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">{product.warranty_policy || warranty}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-black text-slate-950">Need help before ordering?</p>
              <a href={`tel:${phone.replace(/\s+/g, '')}`} className="mt-1 inline-block text-sm font-bold text-slate-700 underline underline-offset-4 hover:text-emerald-700">Call {phone}</a>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-black text-slate-950">Ready to order?</p>
          <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">Cash on Delivery is available. Your final price, delivery charge, and stock are checked securely before confirmation.</p>
          {selected && selected.is_in_stock ? (
            <Link 
              href={`/order?productId=${encodeURIComponent(product.id)}&variantId=${encodeURIComponent(selected.id)}`} 
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-600 hover:text-slate-950 sm:w-auto"
            >
              Order now · Cash on Delivery
            </Link>
          ) : (
            <p className="mt-4 text-sm font-bold text-slate-500">This selected variant is unavailable to order.</p>
          )}
        </div>

        {selected && (
          <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-slate-200 pt-6 text-sm sm:gap-x-6">
            {attributes.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:text-xs">{label}</dt>
                <dd className="mt-1 font-bold text-slate-950">{value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:text-xs">SKU</dt>
              <dd className="mt-1 break-all font-bold text-slate-950">{selected.sku}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:text-xs">Availability</dt>
              <dd className={`mt-1 font-bold ${status.tone === 'in' ? 'text-emerald-700' : status.tone === 'low' ? 'text-amber-700' : 'text-slate-500'}`}>
                {status.label}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  )
}
