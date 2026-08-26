'use client'
/* eslint-disable @next/next/no-img-element -- product image URLs are dynamic Supabase assets and the project does not configure Next remote image optimization. */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { trackClientEvent } from '@/lib/analytics/client'
import { Check, ChevronLeft, ChevronRight, MapPin, PackageCheck, Phone, ShieldCheck } from 'lucide-react'
import { addToCartAction } from '@/lib/commerce/actions'

import { BrandLogo } from '@/components/storefront/brand-logo'
import type { StorefrontProduct, StorefrontSettings } from '@/lib/services/storefront-utils'
import { formatPrice, getBrandPath, getProductImageAlt, getProductImageUrl, getProductTypeLabel, getPublicAvailability, getVariantLabel } from '@/lib/services/storefront-utils'

export function ProductDetailInteractive({ product, settings, phone }: { product: StorefrontProduct; settings: StorefrontSettings; phone: string }) {
  const [selectedId, setSelectedId] = useState(product.variants[0]?.id || '')
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [cartMessage, setCartMessage] = useState('')
  const [cartBusy, setCartBusy] = useState(false)
  const selected = useMemo(() => product.variants.find((variant) => variant.id === selectedId) || product.variants[0] || null, [product.variants, selectedId])
  const status = selected ? getPublicAvailability([selected]) : { label: 'Price on request', tone: 'out' as const }
  const discount = selected && selected.compare_at_price && selected.compare_at_price > selected.price ? Math.round(((selected.compare_at_price - selected.price) / selected.compare_at_price) * 100) : null
  const attributes = selected ? [selected.ram && ['RAM', selected.ram], selected.storage && ['Storage', selected.storage], selected.color && ['Colour', selected.color]].filter(Boolean) as string[][] : []
  const imageCount = product.images.length
  const activeImage = product.images[activeImageIndex] || product.images[0]
  const imageUrl = activeImage?.image_url || getProductImageUrl(product)
  useEffect(() => { if (selected) trackClientEvent({ eventName: 'view_item', commerce: { currency: 'BDT', value: selected.price, items: [{ item_id: selected.sku || selected.id, item_name: product.name, item_brand: product.brand?.name, item_category: product.category?.name, price: selected.price, quantity: 1 }] } }) }, [product.brand?.name, product.category?.name, product.name, selected])

  function selectVariant(id: string) { const variant = product.variants.find((item) => item.id === id); if (variant) trackClientEvent({ eventName: 'select_item', commerce: { item_list_name: 'product_detail', items: [{ item_id: variant.sku || variant.id, item_name: product.name, price: variant.price, quantity: 1 }] } }); setSelectedId(id) }

  async function addSelectedToCart() {
    if (!selected) return
    setCartBusy(true)
    setCartMessage('')
    const result = await addToCartAction({ productId: product.id, variantId: selected.id, quantity: 1 })
    if (result.ok) trackClientEvent({ eventName: 'add_to_cart', commerce: { currency: 'BDT', value: selected.price, items: [{ item_id: selected.sku || selected.id, item_name: product.name, price: selected.price, quantity: 1 }] } })
    setCartBusy(false)
    setCartMessage(result.ok ? 'Added to cart.' : result.message ?? 'Unable to update your cart.')
  }

  function selectImage(index: number) {
    setActiveImageIndex(Math.max(0, Math.min(index, Math.max(imageCount - 1, 0))))
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)] lg:gap-16">
      <div className="min-w-0">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_50%_35%,#ffffff_0%,#eef5f2_42%,#d8e7e1_100%)] p-6 shadow-sm sm:p-10">
          {imageUrl ? (
            <img src={imageUrl} alt={activeImage?.alt_text || getProductImageAlt(product)} fetchPriority="high" className="h-full w-full object-contain transition-opacity duration-200" />
          ) : (
            <div className="text-center" role="img" aria-label={`${product.name} image unavailable`}>
              <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-[2rem] bg-slate-950 text-4xl font-black tracking-[-0.08em] text-emerald-300 shadow-2xl shadow-slate-950/20 sm:h-36 sm:w-36 sm:rounded-[2.5rem] sm:text-5xl">{product.name.slice(0, 2).toUpperCase()}</div>
              <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 sm:text-[11px]">Product image coming soon</p>
            </div>
          )}
          {discount ? <span className="absolute left-5 top-5 rounded-full bg-slate-950 px-3.5 py-1.5 text-xs font-black text-emerald-300 shadow-lg">-{discount}%</span> : null}
          {imageCount > 1 ? (
            <>
              <button type="button" onClick={() => selectImage(activeImageIndex - 1)} disabled={activeImageIndex === 0} aria-label="Previous product image" className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-900 shadow-sm transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"><ChevronLeft className="h-5 w-5" /></button>
              <button type="button" onClick={() => selectImage(activeImageIndex + 1)} disabled={activeImageIndex === imageCount - 1} aria-label="Next product image" className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-900 shadow-sm transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"><ChevronRight className="h-5 w-5" /></button>
            </>
          ) : null}
        </div>

        {imageCount > 1 ? <div className="mt-4 flex gap-3 overflow-x-auto pb-2" aria-label="Product image gallery">{product.images.map((image, index) => <button key={image.id} type="button" onClick={() => selectImage(index)} aria-label={`View product image ${index + 1}`} aria-current={activeImageIndex === index ? 'true' : undefined} className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-white p-1.5 transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 ${activeImageIndex === index ? 'border-emerald-600 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-400'}`}>
          <img src={image.image_url} alt={image.alt_text || `${product.name} image ${index + 1}`} loading="lazy" className="h-full w-full object-contain" />
        </button>)}</div> : null}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><ShieldCheck className="h-5 w-5 text-emerald-600" /><p className="mt-2 text-xs font-bold text-slate-900">Warranty context</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Policy information is shown before ordering.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><PackageCheck className="h-5 w-5 text-emerald-600" /><p className="mt-2 text-xs font-bold text-slate-900">Live availability</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Availability follows the selected variant.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><Check className="h-5 w-5 text-emerald-600" /><p className="mt-2 text-xs font-bold text-slate-900">Cash on Delivery</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Available through the existing order flow.</p></div>
        </div>
      </div>

      <div className="min-w-0">
        {product.brand ? <Link href={getBrandPath(product.brand.slug)} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 transition-colors hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 sm:text-xs"><BrandLogo brand={product.brand} size="sm" className="h-8 w-8 rounded-lg p-1" /><span>{product.brand.name}</span><span className="normal-case tracking-normal text-slate-400">View brand</span></Link> : <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 sm:text-xs">SahiGadget</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500"><span>{getProductTypeLabel(product.product_type)}</span>{product.category ? <><span aria-hidden="true">·</span><Link href={`/products?category=${encodeURIComponent(product.category.slug)}`} className="transition-colors hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200">{product.category.name}</Link></> : null}</div>
        <h1 className="mt-3 break-words text-3xl font-black tracking-[-0.05em] text-slate-950 sm:text-4xl md:text-5xl">{product.name}</h1>
        {product.short_description ? <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base sm:leading-8">{product.short_description}</p> : null}

        <div className="mt-7 flex flex-wrap items-baseline gap-3"><p className="break-words text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{selected ? formatPrice(selected.price) : 'Price on request'}</p>{selected?.compare_at_price && selected.compare_at_price > selected.price ? <><p className="text-sm text-slate-400 line-through">{formatPrice(selected.compare_at_price)}</p><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Save {formatPrice(selected.compare_at_price - selected.price)} · {discount}% off</span></> : null}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className={`rounded-full px-2.5 py-1 font-bold ${status.tone === 'in' ? 'bg-emerald-50 text-emerald-700' : status.tone === 'low' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{status.label}</span>{selected?.sku ? <span className="text-slate-400">SKU: <span className="font-semibold text-slate-600">{selected.sku}</span></span> : null}</div>

        {product.variants.length > 0 ? <div className="mt-8"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-slate-950">Choose a variant</p><span className="text-xs font-semibold text-slate-400">{product.variants.length} option{product.variants.length === 1 ? '' : 's'}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{product.variants.map((variant) => { const variantStatus = getPublicAvailability([variant]); const isSelected = selected?.id === variant.id; const isDisabled = !variant.is_in_stock && !isSelected; return <button key={variant.id} type="button" onClick={() => selectVariant(variant.id)} disabled={isDisabled} aria-pressed={isSelected} className={`flex min-h-16 flex-wrap items-center justify-between gap-2 rounded-2xl border p-4 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-50 ${isSelected ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-slate-400'}`}><span className="min-w-0 flex-1"><span className="block break-words font-bold text-slate-950">{getVariantLabel(variant)}</span><span className="mt-1 block break-all text-xs text-slate-500">{formatPrice(variant.price)}{variant.sku ? ` · ${variant.sku}` : ''}</span></span><span className={`shrink-0 text-[10px] font-black uppercase tracking-[0.12em] ${variantStatus.tone === 'in' ? 'text-emerald-700' : variantStatus.tone === 'low' ? 'text-amber-700' : 'text-slate-400'}`}>{variantStatus.label}</span></button> })}</div></div> : <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">This product does not currently have a purchasable variant.</p>}

        <div className="mt-8 grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><p className="text-sm font-black text-slate-950">Warranty & guarantee</p><p className="mt-1 text-sm leading-6 text-slate-500">{product.warranty_policy || settings.warranty.policyText}</p><Link href="/warranty" className="mt-2 inline-flex text-xs font-bold text-emerald-700 underline underline-offset-4 hover:text-emerald-800">View warranty policy</Link></div></div><div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><p className="text-sm font-black text-slate-950">Delivery across Bangladesh</p><p className="mt-1 text-sm leading-6 text-slate-500">Dhaka {formatPrice(settings.delivery.dhakaCharge)} · Outside Dhaka {formatPrice(settings.delivery.outsideDhakaCharge)}</p><Link href="/shipping" className="mt-2 inline-flex text-xs font-bold text-emerald-700 underline underline-offset-4 hover:text-emerald-800">View delivery policy</Link></div></div><div className="flex items-start gap-3"><Phone className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><p className="text-sm font-black text-slate-950">Need help before ordering?</p><a href={`tel:${phone.replace(/\s+/g, '')}`} className="mt-1 inline-block text-sm font-bold text-slate-700 underline underline-offset-4 hover:text-emerald-700">Call {phone}</a></div></div></div>

        <div className="mt-6 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5"><p className="font-black text-slate-950">Ready to order?</p><p className="mt-1 text-sm leading-6 text-slate-600">Cash on Delivery is available. Final delivery charge and stock are checked through the existing order flow.</p>{selected && selected.is_in_stock ? <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={cartBusy} onClick={addSelectedToCart} className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-black text-slate-800 transition hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-60">{cartBusy ? 'Adding…' : 'Add to cart'}</button><Link href={`/order?productId=${encodeURIComponent(product.id)}&variantId=${encodeURIComponent(selected.id)}`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition duration-150 hover:bg-emerald-600 hover:text-slate-950 active:scale-[.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300">Order now · Cash on Delivery</Link>{cartMessage ? <p role="status" className="mt-3 text-sm font-bold text-emerald-700">{cartMessage} <Link href="/cart" className="underline underline-offset-4">View cart</Link></p> : null}</div> : <p className="mt-4 text-sm font-bold text-slate-500">This selected variant is unavailable to order.</p>}</div>

        {selected ? <dl className="mt-8 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-slate-200 pt-6 text-sm sm:gap-x-8">{attributes.map(([label, value]) => <div key={label} className="min-w-0"><dt className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:text-xs">{label}</dt><dd className="mt-1 break-words font-bold text-slate-950">{value}</dd></div>)}{selected.sku ? <div className="min-w-0"><dt className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:text-xs">SKU</dt><dd className="mt-1 break-all font-bold text-slate-950">{selected.sku}</dd></div> : null}<div className="min-w-0"><dt className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:text-xs">Availability</dt><dd className={`mt-1 truncate font-bold ${status.tone === 'in' ? 'text-emerald-700' : status.tone === 'low' ? 'text-amber-700' : 'text-slate-500'}`}>{status.label}</dd></div></dl> : null}
      </div>
    </div>
  )
}
