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

export type FooterConfig = {
  social: { facebook: string; tiktok: string; instagram: string; x: string; youtube: string }
  payments: { cash_on_delivery: boolean; visa: boolean; mastercard: boolean }
}

export type StorefrontSettings = {
  delivery: { dhakaCharge: number; outsideDhakaCharge: number }
  warranty: { guaranteeDays: number; serviceWarrantyYears: number; policyText: string }
  footer: FooterConfig
}

export type HomepageBanner = {
  id: string
  desktop_image_url: string
  mobile_image_url: string
  heading: string
  description: string
  primary_cta_text: string
  primary_cta_url: string
  secondary_cta_text?: string | null
  secondary_cta_url?: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type ProductListResult = { products: StorefrontProduct[]; total: number; page: number; pageSize: number; pageCount: number }

export type ProductFilters = {
  query?: string
  category?: string
  brand?: string
  availability?: 'all' | 'in-stock' | 'low-stock'
  productType?: string
  minPrice?: number
  maxPrice?: number
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'featured'
  page?: number
  pageSize?: number
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

export function getProductPath(slug: string) { return `/products/${slug}` }
export function getBrandPath(slug: string) { return `/brands/${encodeURIComponent(slug)}` }
export function getCategoryPath(slug: string) { return `/products?category=${encodeURIComponent(slug)}` }
export function getSearchPath(query: string) { return `/search?q=${encodeURIComponent(query)}` }

export function getPaginationPages(page: number, pageCount: number) { 
  const start = Math.max(1, page - 2); 
  const end = Math.min(pageCount, page + 2); 
  return pageCount > 1 ? Array.from({ length: end - start + 1 }, (_, index) => start + index) : [] 
}

export function getProductTypeLabel(value: string) { 
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()) 
}

export function getProductImagePlaceholder(product: StorefrontProduct) { 
  return product.name.slice(0, 2).toUpperCase() 
}

export function parsePage(value: string | undefined) { 
  const page = Number(value); 
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1 
}

export function parsePrice(value: string | undefined) { 
  const price = Number(value); 
  return value && Number.isFinite(price) && price >= 0 ? price : undefined 
}

export function getStorefrontPolicySummary(settings: StorefrontSettings) { 
  return `${settings.warranty.guaranteeDays} Days Guarantee · ${settings.warranty.serviceWarrantyYears} Year Service Warranty` 
}

export function getDeliverySummary(settings: StorefrontSettings) { 
  return `Dhaka ${formatPrice(settings.delivery.dhakaCharge)} · Outside Dhaka ${formatPrice(settings.delivery.outsideDhakaCharge)}` 
}

export function getProductAvailabilityCopy(product: StorefrontProduct) { 
  return getProductAvailability(product).label 
}

export function getProductDiscountLabel(product: StorefrontProduct) { 
  const discount = getProductDiscount(product); 
  return discount ? `Save ${discount}%` : null 
}

export function getProductDescription(product: StorefrontProduct) { 
  return product.description || product.short_description || 'Product information will be updated soon.' 
}

export function getCatalogQuery(filters: ProductFilters) { 
  const params = new URLSearchParams(); 
  if (filters.category) params.set('category', filters.category); 
  if (filters.brand) params.set('brand', filters.brand); 
  if (filters.availability && filters.availability !== 'all') params.set('availability', filters.availability); 
  if (filters.productType) params.set('type', filters.productType); 
  if (filters.minPrice !== undefined) params.set('min', String(filters.minPrice)); 
  if (filters.maxPrice !== undefined) params.set('max', String(filters.maxPrice)); 
  if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort); 
  if (filters.page && filters.page > 1) params.set('page', String(filters.page)); 
  return params.toString() 
}

export function getStorefrontDescription() { 
  return `${siteConfig.brandPromise}. Shop mobile phones and gadgets in Bangladesh with clear pricing, delivery information, and warranty context.` 
}

export function getBrandMetaTitle(brand: StorefrontBrand) { 
  return brand.meta_title || `${brand.name} mobile phones | ${siteConfig.name}` 
}

export function getCategoryMetaTitle(category: StorefrontCategory) { 
  return category.meta_title || `${category.name} | ${siteConfig.name}` 
}

export function getBrandDescription(brand: StorefrontBrand) { 
  return brand.description || `Explore ${brand.name} products from ${siteConfig.name}.` 
}

export function getCategoryDescription(category: StorefrontCategory) { 
  return category.description || `Explore ${category.name} from ${siteConfig.name}.` 
}

export function getOrderBoundaryCopy() { 
  return 'Checkout and order submission will be available in a later phase.' 
}
