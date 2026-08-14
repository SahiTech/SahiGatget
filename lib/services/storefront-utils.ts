import { siteConfig } from '@/config/site'
import type { Database } from '@/lib/types/database'

export type BrandRow = Database['public']['Tables']['brands']['Row']
export type CategoryRow = Database['public']['Tables']['categories']['Row']
export type ProductRow = Database['public']['Tables']['products']['Row']
export type ProductImageRow = Database['public']['Tables']['product_images']['Row']

export type StorefrontBrand = Pick<BrandRow, 'id' | 'name' | 'slug' | 'logo_url' | 'description' | 'meta_title' | 'meta_description'>
export type StorefrontCategory = Pick<CategoryRow, 'id' | 'name' | 'slug' | 'description' | 'image_url' | 'sort_order' | 'meta_title' | 'meta_description'>
export type StorefrontProductImage = Pick<ProductImageRow, 'id' | 'image_url' | 'alt_text' | 'is_primary' | 'sort_order'>

export type StorefrontVariant = {
  id: string
  product_id: string
  sku: string
  variant_title: string
  ram: string | null
  storage: string | null
  color: string | null
  price: number
  compare_at_price: number | null
  is_in_stock: boolean
  is_low_stock: boolean
}

export type StorefrontProduct = Pick<ProductRow, 'id' | 'name' | 'slug' | 'short_description' | 'description' | 'product_type' | 'status' | 'is_featured' | 'is_published' | 'warranty_policy' | 'meta_title' | 'meta_description' | 'created_at' | 'updated_at'> & {
  brand: StorefrontBrand | null
  category: StorefrontCategory | null
  variants: StorefrontVariant[]
  images: StorefrontProductImage[]
}

type RawProduct = ProductRow & { 
  brand?: BrandRow | null; 
  category?: CategoryRow | null;
  product_images?: ProductImageRow[]
}
type RawStorefrontVariant = Omit<StorefrontVariant, 'price' | 'compare_at_price'> & { price: number | string; compare_at_price: number | string | null }

export function normalizeVariant(variant: RawStorefrontVariant): StorefrontVariant {
  return {
    id: variant.id,
    product_id: variant.product_id,
    sku: variant.sku,
    variant_title: variant.variant_title,
    ram: variant.ram,
    storage: variant.storage,
    color: variant.color,
    price: Number(variant.price),
    compare_at_price: variant.compare_at_price === null ? null : Number(variant.compare_at_price),
    is_in_stock: Boolean(variant.is_in_stock),
    is_low_stock: Boolean(variant.is_low_stock),
  }
}

export function normalizeProduct(row: RawProduct, variants: StorefrontVariant[] = []): StorefrontProduct {
  const brand = row.brand
    ? { id: row.brand.id, name: row.brand.name, slug: row.brand.slug, logo_url: row.brand.logo_url, description: row.brand.description, meta_title: row.brand.meta_title, meta_description: row.brand.meta_description }
    : null
  const category = row.category
    ? { id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description, image_url: row.category.image_url, sort_order: row.category.sort_order, meta_title: row.category.meta_title, meta_description: row.category.meta_description }
    : null
  const images = (row.product_images || []).map(img => ({
    id: img.id,
    image_url: img.image_url,
    alt_text: img.alt_text,
    is_primary: img.is_primary,
    sort_order: img.sort_order
  })).sort((a, b) => {
    if (a.is_primary) return -1
    if (b.is_primary) return 1
    return a.sort_order - b.sort_order
  })

  return { 
    id: row.id, 
    name: row.name, 
    slug: row.slug, 
    short_description: row.short_description, 
    description: row.description, 
    product_type: row.product_type, 
    status: row.status, 
    is_featured: row.is_featured, 
    is_published: row.is_published, 
    warranty_policy: row.warranty_policy, 
    meta_title: row.meta_title, 
    meta_description: row.meta_description, 
    created_at: row.created_at, 
    updated_at: row.updated_at, 
    brand, 
    category, 
    variants,
    images
  }
}

export function cleanTerm(value: string) {
  return value.trim().replace(/[%,]/g, ' ').replace(/\s+/g, ' ').slice(0, 80)
}

export function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'Price on request'
  return `${siteConfig.currency.symbol}${new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(value)}`
}

export function getStartingPrice(product: StorefrontProduct) {
  const prices = product.variants.map((variant) => variant.price).filter(Number.isFinite)
  return prices.length ? Math.min(...prices) : null
}

export function getCompareAtPrice(product: StorefrontProduct) {
  const prices = product.variants.map((variant) => variant.compare_at_price).filter((price): price is number => price !== null && Number.isFinite(price))
  return prices.length ? Math.max(...prices) : null
}

export function getProductDiscount(product: StorefrontProduct) {
  const selling = getStartingPrice(product)
  const compareAt = getCompareAtPrice(product)
  return selling && compareAt && compareAt > selling ? Math.round(((compareAt - selling) / compareAt) * 100) : null
}

export function getPublicAvailability(variants: StorefrontVariant[]) {
  if (!variants.some((variant) => variant.is_in_stock)) return { label: 'Out of stock', tone: 'out' as const }
  if (variants.some((variant) => variant.is_low_stock)) return { label: 'Low stock', tone: 'low' as const }
  return { label: 'In stock', tone: 'in' as const }
}

export function getProductAvailability(product: StorefrontProduct) {
  return getPublicAvailability(product.variants)
}

export function getVariantLabel(variant: StorefrontVariant) {
  return [variant.ram, variant.storage, variant.color].filter(Boolean).join(' · ') || variant.variant_title
}

export function getProductImageAlt(product: StorefrontProduct) {
  const primaryImage = product.images.find(img => img.is_primary)
  if (primaryImage?.alt_text) return primaryImage.alt_text
  return `${product.brand?.name ? `${product.brand.name} ` : ''}${product.name}`
}

export function getProductPrimaryImage(product: StorefrontProduct) {
  return product.images.find(img => img.is_primary)?.image_url || null
}

export function getProductImageUrl(product: StorefrontProduct) {
  return getProductPrimaryImage(product)
}

export function getProductMetaTitle(product: StorefrontProduct) {
  if (product.meta_title) return product.meta_title
  const brandName = product.brand?.name ? `${product.brand.name} ` : ''
  return `${brandName}${product.name} | SahiGadget`
}

export function getProductMetaDescription(product: StorefrontProduct) {
  if (product.meta_description) return product.meta_description
  const price = getStartingPrice(product)
  const priceText = price ? ` at ${formatPrice(price)}` : ''
  return `Buy ${product.name}${priceText}. ${product.short_description || siteConfig.brandPromise || ''}`
}

export function getProductPriceRange(product: StorefrontProduct) {
  const prices = product.variants.map(v => v.price).filter(Number.isFinite)
  if (!prices.length) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return formatPrice(min)
  return `${formatPrice(min)} - ${formatPrice(max)}`
}

export function getProductVariantSummary(product: StorefrontProduct) {
  const colors = Array.from(new Set(product.variants.map(v => v.color).filter(Boolean)))
  const storage = Array.from(new Set(product.variants.map(v => v.storage).filter(Boolean)))
  return [...colors, ...storage]
}
