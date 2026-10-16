'use client'
/* eslint-disable @next/next/no-img-element -- product image URLs are dynamic Supabase assets and the project does not configure Next remote image optimization. */

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BatteryCharging, Banknote, Camera, CheckCircle2, ChevronLeft, ChevronRight, Cpu, HardDrive, Minus, Monitor, Palette, Plus, Radio, Ruler, Share2, ShieldCheck, ShoppingCart, Smartphone, Tag, Truck, Weight, Wifi, Zap } from 'lucide-react'
import { addToCartAction } from '@/lib/commerce/actions'
import { prepareGuestCheckoutAction } from '@/lib/commerce/actions'

import { BrandLogo } from '@/components/storefront/brand-logo'
import type { StorefrontProduct } from '@/lib/services/storefront-utils'

type ProductAnalyticsInput = Parameters<typeof import('@/lib/analytics/client').trackClientEvent>[0]

function trackProductEvent(input: ProductAnalyticsInput) {
  void import('@/lib/analytics/client').then(({ trackClientEvent }) => trackClientEvent(input))
}
import { formatPrice, getBrandPath, getProductImageAlt, getProductImageUrl, getProductTypeLabel, getPublicAvailability, getVariantLabel } from '@/lib/services/storefront-utils'

export function ProductDetailInteractive({ product }: { product: StorefrontProduct }) {
  const [selectedId, setSelectedId] = useState(product.variants.find((variant) => variant.is_in_stock)?.id || product.variants[0]?.id || '')
  const [quantity, setQuantity] = useState(1)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [cartMessage, setCartMessage] = useState('')
  const [cartBusy, setCartBusy] = useState(false)
  const [cartAdded, setCartAdded] = useState(false)
  const [buyBusy, setBuyBusy] = useState(false)
  const router = useRouter()
  const selected = useMemo(() => product.variants.find((variant) => variant.id === selectedId) || product.variants[0] || null, [product.variants, selectedId])
  const status = selected ? getPublicAvailability([selected]) : { label: 'Price on request', tone: 'out' as const }
  const discount = selected && selected.compare_at_price && selected.compare_at_price > selected.price ? Math.round(((selected.compare_at_price - selected.price) / selected.compare_at_price) * 100) : null
  // Keep every product image in the gallery. Some legacy image rows are linked to old variant IDs,
  // so filtering strictly by variant_id can hide every other colour when one colour is selected.
  // Prefer images linked to the selected variant, then legacy images whose alt text matches its colour,
  // then the generic primary image, followed by the remaining colour images.
  const displayImages = useMemo(() => {
    const selectedColor = selected?.color?.trim().toLocaleLowerCase() || ''
    const imagePriority = (image: (typeof product.images)[number]) => {
      if (selected && image.variant_id === selected.id) return 0
      if (selectedColor && image.alt_text?.toLocaleLowerCase().includes(selectedColor)) return 1
      if (!image.variant_id) return 2
      return 3
    }
    return [...product.images].sort((a, b) =>
      imagePriority(a) - imagePriority(b) ||
      Number(b.is_primary) - Number(a.is_primary) ||
      a.sort_order - b.sort_order,
    )
  }, [product, selected])
  const imageCount = displayImages.length
  const activeImage = displayImages[activeImageIndex] || displayImages[0]
  const imageUrl = activeImage?.image_url || getProductImageUrl(product)
  const viewedProductIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selected || viewedProductIdRef.current === product.id) return
    viewedProductIdRef.current = product.id
    trackProductEvent({ eventName: 'view_item', commerce: { currency: 'BDT', value: selected.price, items: [{ item_id: selected.sku || selected.id, item_name: product.name, item_brand: product.brand?.name, item_category: product.category?.name, price: selected.price, quantity: 1 }] } })
  }, [product.brand?.name, product.category?.name, product.id, product.name, selected])

  function selectVariant(id: string) { const variant = product.variants.find((item) => item.id === id); if (variant) { trackProductEvent({ eventName: 'select_item', commerce: { item_list_name: 'product_detail', items: [{ item_id: variant.sku || variant.id, item_name: product.name, price: variant.price, quantity: 1 }] } }); setActiveImageIndex(0); setSelectedId(id) } }

  async function addSelectedToCart() {
    if (!selected || selected.product_id !== product.id || !selected.is_in_stock || cartBusy || buyBusy) {
      setCartMessage(!selected || selected.product_id !== product.id ? 'This product option needs a refresh. Please reload the page and try again.' : 'This product option is currently out of stock.')
      return
    }
    setCartBusy(true)
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('sahigadget:cart-pending'))
    setCartAdded(false)
    setCartMessage('')
    const result = await addToCartAction({ productId: product.id, variantId: selected.id, quantity })
    if (result.ok) trackProductEvent({ eventName: 'add_to_cart', commerce: { currency: 'BDT', value: selected.price * quantity, items: [{ item_id: selected.sku || selected.id, item_name: product.name, item_brand: product.brand?.name, item_category: product.category?.name, price: selected.price, quantity }] } })
    setCartBusy(false)
    setCartAdded(result.ok)
    setCartMessage(result.ok ? 'Added to cart.' : result.message ?? 'Unable to update your cart.')
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(result.ok ? 'sahigadget:cart-updated' : 'sahigadget:cart-error'))
  }

  async function buySelectedNow() {
    if (!selected || !selected.is_in_stock || buyBusy || cartBusy) return
    setBuyBusy(true)
    setCartMessage('')
    const result = await prepareGuestCheckoutAction({ productId: product.id, variantId: selected.id, quantity })
    if (!result.ok) {
      setBuyBusy(false)
      setCartMessage(result.message)
      return
    }
    trackProductEvent({
      eventName: 'begin_checkout',
      commerce: {
        currency: 'BDT',
        value: selected.price * quantity,
        items: [{ item_id: selected.sku || selected.id, item_name: product.name, price: selected.price, quantity }],
      },
    })
    router.push(result.data.redirectUrl)
  }

  async function shareProduct() {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
    if (!shareUrl) return
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url: shareUrl })
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        setCartMessage('Product link copied.')
      }
    } catch {
      // User cancelled the native share sheet; no UI error is needed.
    }
  }

  const ramValues = Array.from(new Set(product.variants.map((variant) => variant.ram).filter(Boolean))).join(' · ')
  const storageValues = Array.from(new Set(product.variants.map((variant) => variant.storage).filter(Boolean))).join(' · ')
  const colourValues = Array.from(new Set(product.variants.map((variant) => variant.color).filter(Boolean))).join(' · ')
  // Product descriptions have historically been entered as plain text, Markdown, or HTML.
  // Normalize those formats once so every product uses the same specification layout.
  const normalizedDescription = (product.description || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const productSpecText = [product.short_description, normalizedDescription].filter(Boolean).join(' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')
  const readSpec = (pattern: RegExp) => {
    const match = productSpecText.match(pattern)
    return match?.[1]?.trim().replace(/\s+/g, ' ').replace(/[.,;]+$/, '') || ''
  }
  const isNokia2720Flip = /nokia\s*2720\s*flip/i.test(product.name)
  const rawDisplaySpec = readSpec(/(?:display(?:\s*size)?|screen\s*size)\s*[:\-]\s*([^|;\n\r<]{1,100})/i)
  const displaySpec = (rawDisplaySpec.split(/[,;]|\b(?:aspect ratio|approximately|pixel density)\b/i)[0] || '').trim() || (isNokia2720Flip ? '2.8″ + 1.3″ external' : '')
  const rawBatterySpec = readSpec(/(?:battery(?:\s*capacity)?|battery\s*size)\s*[:\-]\s*([^|;\n\r<]{1,70})/i)
  const batterySpec = rawBatterySpec.match(/\b\d[\d,.]*\s*mAh\b/i)?.[0] || (rawBatterySpec.split(/[,;]/)[0] || '').trim() || (isNokia2720Flip ? '1,500 mAh' : '')
  const parsedDescriptionSections = normalizedDescription.split(/(?=^##\s)/m).map((section) => {
    const lines = section.split(/\n/).map((line) => line.trim()).filter(Boolean)
    const firstLine = lines[0] || ''
    const title = firstLine.startsWith('## ') ? firstLine.replace(/^##\s*/, '') : 'About this phone'
    const bodyLines = firstLine.startsWith('## ') ? lines.slice(1) : lines
    const details = bodyLines.flatMap((line) => {
      const match = line.replace(/^[-*•]\s*/, '').match(/^([^:]{2,48}):\s*(.{1,180})$/)
      return match ? [{ label: match[1].trim(), value: match[2].trim() }] : []
    })
    const paragraphs = bodyLines.filter((line) => !line.replace(/^[-*•]\s*/, '').match(/^[^:]{2,48}:\s*\S/))
    return { title, details, paragraphs }
  }).filter((section) => section.details.length || section.paragraphs.length)
  const descriptionSections = parsedDescriptionSections.length ? parsedDescriptionSections : [{
    title: 'Product overview',
    details: [
      ...(product.brand?.name ? [{ label: 'Brand', value: product.brand.name }] : []),
      ...(product.category?.name ? [{ label: 'Category', value: product.category.name }] : []),
      ...(product.product_type ? [{ label: 'Product type', value: getProductTypeLabel(product.product_type) }] : []),
      ...(colourValues ? [{ label: 'Available colour', value: colourValues }] : []),
      ...(ramValues ? [{ label: 'RAM', value: ramValues }] : []),
      ...(storageValues ? [{ label: 'Storage', value: storageValues }] : []),
      ...(product.warranty_policy ? [{ label: 'Warranty', value: product.warranty_policy }] : []),
    ],
    paragraphs: product.short_description ? [product.short_description] : [],
  }]


  function selectImage(index: number) {
    setActiveImageIndex(Math.max(0, Math.min(index, Math.max(imageCount - 1, 0))))
  }

  return (
    <div>
      <div className="mb-4 min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="min-w-0 flex-1 break-words text-3xl font-black tracking-[-0.055em] text-slate-950 sm:text-4xl lg:text-[2.75rem]">{product.name}</h1>
          <button type="button" onClick={shareProduct} aria-label="Share product" title="Share product" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition duration-150 hover:border-orange-300 hover:text-orange-700 hover:shadow-md active:scale-[.96] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100">
            <Share2 className="h-4 w-4" />
          </button>
        </div>
        {product.brand ? <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500"><Link href={getBrandPath(product.brand.slug)} className="inline-flex items-center gap-2 rounded-full transition-colors hover:text-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"><BrandLogo brand={product.brand} size="sm" className="h-7 w-7 rounded-lg bg-white p-1 ring-1 ring-slate-200" /><span className="font-black text-slate-700">{product.brand.name}</span></Link><span aria-hidden="true" className="text-slate-300">·</span><span>{getProductTypeLabel(product.product_type)}</span></div> : <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">SahiGadget</p>}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,.94fr)_minmax(0,1.06fr)] lg:items-start lg:gap-10 xl:gap-14">
        <div className="min-w-0">
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[radial-gradient(circle_at_50%_35%,#ffffff_0%,#f8fafc_58%,#eef2f7_100%)] p-5 shadow-sm sm:p-8 lg:rounded-[2rem]">
            {imageUrl ? <img src={imageUrl} alt={activeImage?.alt_text || getProductImageAlt(product)} fetchPriority="high" className="h-full w-full object-contain transition-opacity duration-200" /> : <div className="text-center" role="img" aria-label={product.name + ' image unavailable'}><div className="mx-auto flex h-32 w-32 items-center justify-center rounded-[2rem] bg-slate-950 text-4xl font-black tracking-[-0.08em] text-orange-300 shadow-2xl shadow-slate-950/20 sm:h-36 sm:w-36 sm:rounded-[2.5rem] sm:text-5xl">{product.name.slice(0, 2).toUpperCase()}</div><p className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 sm:text-[11px]">Product image coming soon</p></div>}{discount ? <span className="absolute left-4 top-4 rounded-full bg-slate-950 px-3.5 py-1.5 text-xs font-black text-orange-300 shadow-lg sm:left-5 sm:top-5">-{discount}%</span> : null}{imageCount > 1 ? <><button type="button" onClick={() => selectImage(activeImageIndex - 1)} disabled={activeImageIndex === 0} aria-label="Previous product image" className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-900 shadow-sm transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"><ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={() => selectImage(activeImageIndex + 1)} disabled={activeImageIndex === imageCount - 1} aria-label="Next product image" className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-900 shadow-sm transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200"><ChevronRight className="h-5 w-5" /></button></> : null}
          </div>
          {imageCount > 1 ? <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1" aria-label="Product image gallery">{displayImages.map((image, index) => <button key={image.id} type="button" onClick={() => selectImage(index)} aria-label={'View product image ' + (index + 1)} aria-current={activeImageIndex === index ? 'true' : undefined} className={'relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white p-1 transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 sm:h-[4.5rem] sm:w-[4.5rem] ' + (activeImageIndex === index ? 'border-orange-600 ring-2 ring-orange-100' : 'border-slate-200 hover:border-slate-400')}><img src={image.image_url} alt={image.alt_text || product.name + ' image ' + (index + 1)} loading="lazy" decoding="async" className="h-full w-full object-contain" /></button>)}</div> : null}
        </div>

        <div className="min-w-0">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <span className={status.tone === 'out' ? 'inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700' : status.tone === 'low' ? 'inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700' : 'inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700'}>
                <span className={status.tone === 'out' ? 'h-1.5 w-1.5 rounded-full bg-rose-500' : status.tone === 'low' ? 'h-1.5 w-1.5 rounded-full bg-amber-500' : 'h-1.5 w-1.5 rounded-full bg-emerald-500'} />
                {status.label}
              </span>
              {product.category ? <Link href={'/products?category=' + encodeURIComponent(product.category.slug)} className="text-xs font-bold text-slate-400 transition-colors hover:text-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200">{product.category.name}</Link> : null}
            </div>

            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(108px,.7fr)] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(145px,.55fr)] sm:gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Price</p>
                <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <p className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{selected ? formatPrice(selected.price) : 'Price on request'}</p>
                  {selected?.compare_at_price && selected.compare_at_price > selected.price ? <p className="pb-1 text-sm text-slate-400 line-through">{formatPrice(selected.compare_at_price)}</p> : null}
                </div>
                {selected?.compare_at_price && selected.compare_at_price > selected.price ? <span className="mt-2 inline-flex rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-700">Save {formatPrice(selected.compare_at_price - selected.price)} · {discount}% off</span> : null}
              </div>
              <div className="flex min-h-[76px] flex-col justify-center rounded-xl border border-orange-100 bg-orange-50/70 p-2.5 sm:min-h-[80px] sm:p-3">
                <span className="mb-1.5 inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white text-orange-700 ring-1 ring-orange-100"><Banknote className="h-3.5 w-3.5" /></span>
                <p className="text-xs font-black leading-4 text-slate-950">Cash on Delivery</p>
              </div>
            </div>

            {(product.brand || product.category || product.product_type || colourValues || ramValues || storageValues) ? (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-sm font-black text-slate-950">মূল তথ্য</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {product.brand ? <div className="flex min-h-[60px] items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"><Tag aria-hidden="true" className="h-4 w-4 shrink-0 text-orange-600" /><div className="min-w-0"><p className="text-[10px] font-semibold text-slate-500">Brand</p><p className="break-words text-xs font-bold text-slate-950">{product.brand.name}</p></div></div> : null}
                  <div className="flex min-h-[60px] items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"><Monitor aria-hidden="true" className="h-4 w-4 shrink-0 text-orange-600" /><div className="min-w-0"><p className="text-[10px] font-semibold text-slate-500">Display</p><p className="break-words text-xs font-bold text-slate-950">{displaySpec || 'Details below'}</p></div></div>
                  {colourValues ? <div className="flex min-h-[60px] items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"><Palette aria-hidden="true" className="h-4 w-4 shrink-0 text-orange-600" /><div className="min-w-0"><p className="text-[10px] font-semibold text-slate-500">Colour</p><p className="break-words text-xs font-bold text-slate-950">{colourValues}</p></div></div> : null}
                  <div className="flex min-h-[60px] items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"><BatteryCharging aria-hidden="true" className="h-4 w-4 shrink-0 text-orange-600" /><div className="min-w-0"><p className="text-[10px] font-semibold text-slate-500">Battery</p><p className="break-words text-xs font-bold text-slate-950">{batterySpec || 'Details below'}</p></div></div>
                </div>
              </div>
            ) : null}

            {product.variants.length > 0 ? (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-slate-950">Choose a variant</p><span className="text-xs font-semibold text-slate-400">{product.variants.length} option{product.variants.length === 1 ? '' : 's'}</span></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {product.variants.map((variant) => {
                    const isSelected = selected?.id === variant.id
                    const isDisabled = !variant.is_in_stock && !isSelected
                    const variantImage = product.images.find((image) => image.variant_id === variant.id) || product.images.find((image) => image.variant_id === null)
                    return <button key={variant.id} type="button" onClick={() => selectVariant(variant.id)} disabled={isDisabled} aria-pressed={isSelected} className={"flex min-h-14 items-center justify-between gap-3 rounded-xl border p-2.5 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-50 " + (isSelected ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-100' : 'border-slate-200 bg-white hover:border-slate-400')}>
                      <span className="flex min-w-0 flex-1 items-center gap-2.5">
                        {variantImage ? <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white"><img src={variantImage.image_url} alt={variantImage.alt_text || getVariantLabel(variant) + ' color'} width={40} height={40} loading="lazy" decoding="async" className="h-full w-full object-contain" /></span> : <span aria-hidden="true" className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 bg-slate-100" />}
                        <span className="min-w-0"><span className="block break-words text-xs font-bold text-slate-950">{getVariantLabel(variant)}</span><span className="mt-0.5 block break-all text-[11px] text-slate-500">{formatPrice(variant.price)}{variant.sku ? ' · ' + variant.sku : ''}</span></span>
                      </span>
                      {isSelected ? <span className="shrink-0 rounded-full bg-orange-600 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white">Selected</span> : null}
                    </button>
                  })}
                </div>
              </div>
            ) : <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">This product does not currently have a purchasable variant.</p>}

            <div className="mt-6 border-t border-slate-100 pt-5">
              {selected && selected.is_in_stock ? <div className="space-y-3">
                <div className="flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Quantity</span><div className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm"><button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1 || cartBusy || buyBusy} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-white hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100"><Minus className="h-4 w-4" /></button><span aria-live="polite" className="w-8 text-center text-sm font-black text-slate-950">{quantity}</span><button type="button" aria-label="Increase quantity" onClick={() => setQuantity((value) => Math.min(10, value + 1))} disabled={quantity >= 10 || cartBusy || buyBusy} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-700 transition hover:bg-white hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100"><Plus className="h-4 w-4" /></button></div></div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" disabled={cartBusy || buyBusy} onClick={addSelectedToCart} aria-label={cartAdded ? 'Added to cart successfully' : 'Add product to cart'} className={"inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-black transition duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60 " + (cartAdded ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300' : 'border-slate-300 bg-white text-slate-800 hover:border-orange-500 hover:text-orange-700')}>
                    {cartBusy ? <ShoppingCart className="h-4 w-4 animate-pulse" /> : cartAdded ? <CheckCircle2 className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                    {cartBusy ? 'Adding…' : cartAdded ? 'Added to Cart' : 'Add to cart'}</button>
                  <button type="button" disabled={cartBusy || buyBusy} onClick={buySelectedNow} className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-orange-600 hover:text-slate-950 hover:shadow-lg active:translate-y-0 active:scale-[.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-60"><Zap className="h-4 w-4 transition-transform duration-150 group-hover:scale-110 group-active:scale-90" />{buyBusy ? 'Preparing…' : 'Buy Now'}</button>
                </div>
                {cartMessage && cartMessage !== 'Added to cart.' ? <p role="status" className={"text-sm font-bold " + (cartMessage === 'Product link copied.' ? 'text-orange-700' : 'text-rose-600')}>{cartMessage}</p> : null}
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Purchase benefits">
                  <div className="group relative flex min-w-0 items-center gap-2.5 overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white px-3 py-2.5 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-sm motion-reduce:transform-none">
                    <span aria-hidden="true" className="purchase-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100 transition-transform duration-150 group-hover:scale-105 motion-reduce:transform-none"><Banknote className="h-4 w-4" /></span>
                    <span className="min-w-0"><span className="block text-xs font-extrabold leading-4 text-slate-950">ক্যাশ অন ডেলিভারি</span><span className="mt-0.5 block text-[10px] font-medium leading-4 text-slate-500">পণ্য পেয়ে মূল্য দিন</span></span>
                  </div>
                  <div className="group relative flex min-w-0 items-center gap-2.5 overflow-hidden rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50/90 to-white px-3 py-2.5 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-sm motion-reduce:transform-none">
                    <span aria-hidden="true" className="purchase-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm ring-1 ring-sky-100 transition-transform duration-150 group-hover:scale-105 motion-reduce:transform-none"><Truck className="h-4 w-4" /></span>
                    <span className="min-w-0"><span className="block text-xs font-extrabold leading-4 text-slate-950">সারা দেশে ডেলিভারি</span><span className="mt-0.5 block text-[10px] font-semibold leading-4 text-slate-600">ঢাকা ৳80 · বাইরে ৳130</span></span>
                  </div>
                  <div className="group relative flex min-w-0 items-center gap-2.5 overflow-hidden rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50/90 to-white px-3 py-2.5 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-sm motion-reduce:transform-none">
                    <span aria-hidden="true" className="purchase-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-orange-700 shadow-sm ring-1 ring-orange-100 transition-transform duration-150 group-hover:scale-105 motion-reduce:transform-none"><ShieldCheck className="h-4 w-4" /></span>
                    <span className="min-w-0"><span className="block text-xs font-extrabold leading-4 text-slate-950">ওয়ারেন্টি ও সাপোর্ট</span><span className="mt-0.5 block text-[10px] leading-4 text-slate-600">৭ দিন গ্যারান্টি · ১ বছর সার্ভিস</span></span>
                  </div>
                </div>
              </div> : <p className="text-sm font-bold text-slate-500">This selected variant is unavailable to order.</p>}
            </div>
          </div>
        </div>
      </div>

      {descriptionSections.length > 0 ? (
        <section className="mt-5 space-y-3 border-t border-slate-100 pt-5 sm:mt-7 sm:pt-6" aria-labelledby="product-details-heading">
          <div className="max-w-2xl">
            <h2 id="product-details-heading" className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">প্রোডাক্টের বিস্তারিত</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {descriptionSections.map((section, index) => (
              <section key={section.title + index} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <h3 className="border-b border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm font-black text-slate-900">{section.title}</h3>
                {section.paragraphs.length > 0 ? <div className="space-y-2 px-4 py-4">{section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex} className="text-sm leading-6 text-slate-600">{paragraph.replace(/^[-*•]\s*/, '')}</p>)}</div> : null}
                {section.details.length > 0 ? <dl className="divide-y divide-slate-100 px-4">{section.details.map((detail, detailIndex) => {
                  const label = detail.label.toLowerCase()
                  const SpecIcon = /display|screen/.test(label) ? Monitor : /battery|power/.test(label) ? BatteryCharging : /colour|color/.test(label) ? Palette : /network|gsm|sim/.test(label) ? Smartphone : /bluetooth|connectivity/.test(label) ? Share2 : /usb|charging|port/.test(label) ? Zap : /radio|audio|speaker|sound/.test(label) ? Radio : /warranty|guarantee|support/.test(label) ? ShieldCheck : /delivery|shipping/.test(label) ? Truck : /price|cost/.test(label) ? Banknote : /ram|processor|chip/.test(label) ? Cpu : /memory|storage|card/.test(label) ? HardDrive : /camera|photo/.test(label) ? Camera : /dimension|size/.test(label) ? Ruler : /weight/.test(label) ? Weight : /wifi|wireless|network/.test(label) ? Wifi : /brand|model|type|name/.test(label) ? Tag : CheckCircle2
                  return <div key={detail.label + detailIndex} className="grid grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] gap-3 py-3"><dt className="flex min-w-0 items-start gap-1.5 text-xs font-semibold leading-5 text-slate-500"><SpecIcon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-600" /><span className="break-words">{detail.label}</span></dt><dd className="break-words text-right text-xs font-bold leading-5 text-slate-900">{detail.value}</dd></div>
                })}</dl> : null}
              </section>
            ))}
          </div>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-slate-500">{selected ? getVariantLabel(selected) : product.name}</p><p className="text-base font-black text-slate-950">{selected ? formatPrice(selected.price) : 'Price on request'}</p></div>
          <button type="button" disabled={!selected || !selected.is_in_stock || cartBusy || buyBusy} onClick={addSelectedToCart} aria-label={cartAdded ? 'Added to cart successfully' : 'Add product to cart'} className={"inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black transition duration-150 active:scale-[.97] disabled:opacity-50 " + (cartAdded ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-800')}>
            {cartBusy ? <ShoppingCart className="h-4 w-4 animate-pulse" /> : cartAdded ? <CheckCircle2 className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            {cartBusy ? 'Adding…' : cartAdded ? 'Added' : 'Add to Cart'}</button>
          <button type="button" disabled={!selected || !selected.is_in_stock || cartBusy || buyBusy} onClick={buySelectedNow} className="group inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#FF6B00] px-4 text-xs font-black text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[.98] disabled:opacity-50"><Zap className="h-4 w-4 transition-transform duration-150 group-hover:scale-110 group-active:scale-90" />{buyBusy ? 'Opening…' : 'Buy Now'}</button>
        </div>
      </div>
    </div>
  )
}
