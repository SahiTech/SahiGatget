import { siteConfig } from '@/config/site'
import { createClient } from '@/lib/supabase/server'
import type { Database, Json } from '@/lib/types/database'

export type BrandRow = Database['public']['Tables']['brands']['Row']
export type CategoryRow = Database['public']['Tables']['categories']['Row']
export type ProductRow = Database['public']['Tables']['products']['Row']

export type StorefrontBrand = Pick<BrandRow, 'id' | 'name' | 'slug' | 'logo_url' | 'description' | 'meta_title' | 'meta_description'>
export type StorefrontCategory = Pick<CategoryRow, 'id' | 'name' | 'slug' | 'description' | 'image_url' | 'sort_order' | 'meta_title' | 'meta_description'>

/** Customer-safe public variant data. Exact stock counts and thresholds remain server/admin-only. */
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
}

export type StorefrontSettings = {
  delivery: { dhakaCharge: number; outsideDhakaCharge: number }
  warranty: { guaranteeDays: number; serviceWarrantyYears: number; policyText: string }
}

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

export type ProductListResult = { products: StorefrontProduct[]; total: number; page: number; pageSize: number; pageCount: number }

type RawProduct = ProductRow & { brand?: BrandRow | null; category?: CategoryRow | null }
type RawStorefrontVariant = Omit<StorefrontVariant, 'price' | 'compare_at_price'> & { price: number | string; compare_at_price: number | string | null }

const PRODUCT_SELECT = 'id,brand_id,category_id,name,slug,short_description,description,product_type,status,is_featured,is_published,warranty_policy,meta_title,meta_description,created_at,updated_at,brand:brands(id,name,slug,logo_url,description,meta_title,meta_description),category:categories(id,name,slug,description,image_url,sort_order,meta_title,meta_description)'
const STOREFRONT_VARIANT_SELECT = 'id,product_id,sku,variant_title,ram,storage,color,price,compare_at_price,is_in_stock,is_low_stock'

function normalizeVariant(variant: RawStorefrontVariant): StorefrontVariant {
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

function normalizeProduct(row: RawProduct, variants: StorefrontVariant[] = []): StorefrontProduct {
  const brand = row.brand
    ? { id: row.brand.id, name: row.brand.name, slug: row.brand.slug, logo_url: row.brand.logo_url, description: row.brand.description, meta_title: row.brand.meta_title, meta_description: row.brand.meta_description }
    : null
  const category = row.category
    ? { id: row.category.id, name: row.category.name, slug: row.category.slug, description: row.category.description, image_url: row.category.image_url, sort_order: row.category.sort_order, meta_title: row.category.meta_title, meta_description: row.category.meta_description }
    : null
  return { id: row.id, name: row.name, slug: row.slug, short_description: row.short_description, description: row.description, product_type: row.product_type, status: row.status, is_featured: row.is_featured, is_published: row.is_published, warranty_policy: row.warranty_policy, meta_title: row.meta_title, meta_description: row.meta_description, created_at: row.created_at, updated_at: row.updated_at, brand, category, variants }
}

async function getVariantsByProductId(supabase: Awaited<ReturnType<typeof createClient>>, productIds: string[]) {
  if (!productIds.length) return new Map<string, StorefrontVariant[]>()
  const { data, error } = await supabase.from('storefront_variants').select(STOREFRONT_VARIANT_SELECT).in('product_id', productIds)
  if (error) throw new Error('Unable to load product variants.')
  const variantsByProduct = new Map<string, StorefrontVariant[]>()
  for (const rawVariant of (data ?? []) as RawStorefrontVariant[]) {
    const variant = normalizeVariant(rawVariant)
    const variants = variantsByProduct.get(variant.product_id) ?? []
    variants.push(variant)
    variantsByProduct.set(variant.product_id, variants)
  }
  return variantsByProduct
}

function cleanTerm(value: string) {
  return value.trim().replace(/[%,]/g, ' ').replace(/\s+/g, ' ').slice(0, 80)
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

export function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'Price on request'
  return `${siteConfig.currency.symbol}${new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(value)}`
}

export function getVariantLabel(variant: StorefrontVariant) {
  return [variant.ram, variant.storage, variant.color].filter(Boolean).join(' · ') || variant.variant_title
}

export function getProductImageAlt(product: StorefrontProduct) {
  return `${product.brand?.name ? `${product.brand.name} ` : ''}${product.name}`
}

async function resolveProductIdsForSearch(supabase: Awaited<ReturnType<typeof createClient>>, query: string) {
  const term = cleanTerm(query)
  if (!term) return null
  const [products, brands, variants] = await Promise.all([
    supabase.from('products').select('id').eq('is_published', true).or(`name.ilike.%${term}%,short_description.ilike.%${term}%,slug.ilike.%${term}%`).limit(100),
    supabase.from('brands').select('id').eq('is_active', true).ilike('name', `%${term}%`).limit(50),
    supabase.from('storefront_variants').select('product_id').or(`sku.ilike.%${term}%,variant_title.ilike.%${term}%,ram.ilike.%${term}%,storage.ilike.%${term}%,color.ilike.%${term}%`).limit(100),
  ])
  const ids = new Set<string>([...(products.data ?? []).map((row) => row.id), ...(variants.data ?? []).map((row) => row.product_id)])
  const brandIds = (brands.data ?? []).map((row) => row.id)
  if (brandIds.length) {
    const { data } = await supabase.from('products').select('id').eq('is_published', true).in('brand_id', brandIds).limit(100)
    for (const row of data ?? []) ids.add(row.id)
  }
  return Array.from(ids)
}

async function resolveVariantIds(supabase: Awaited<ReturnType<typeof createClient>>, filters: ProductFilters) {
  const hasVariantFilter = filters.availability === 'in-stock' || filters.availability === 'low-stock' || filters.minPrice !== undefined || filters.maxPrice !== undefined
  if (!hasVariantFilter) return null
  let query = supabase.from('storefront_variants').select('product_id').limit(1000)
  if (filters.minPrice !== undefined) query = query.gte('price', filters.minPrice)
  if (filters.maxPrice !== undefined) query = query.lte('price', filters.maxPrice)
  if (filters.availability === 'in-stock') query = query.eq('is_in_stock', true)
  if (filters.availability === 'low-stock') query = query.eq('is_low_stock', true)
  const { data, error } = await query
  if (error) throw new Error('Unable to apply catalogue availability filters.')
  return (data ?? []).map((row) => row.product_id)
}

export async function getProducts(filters: ProductFilters = {}): Promise<ProductListResult> {
  const supabase = await createClient()
  const pageSize = Math.min(Math.max(filters.pageSize ?? 12, 1), 48)
  const page = Math.max(filters.page ?? 1, 1)
  const offset = (page - 1) * pageSize
  let categoryId: string | null = null
  let brandId: string | null = null
  if (filters.category) {
    const { data } = await supabase.from('categories').select('id').eq('slug', filters.category).eq('is_active', true).maybeSingle()
    categoryId = data?.id ?? '__missing__'
  }
  if (filters.brand) {
    const { data } = await supabase.from('brands').select('id').eq('slug', filters.brand).eq('is_active', true).maybeSingle()
    brandId = data?.id ?? '__missing__'
  }
  const [searchIds, variantIds] = await Promise.all([filters.query ? resolveProductIdsForSearch(supabase, filters.query) : Promise.resolve(null), resolveVariantIds(supabase, filters)])
  let query = supabase.from('products').select(PRODUCT_SELECT, { count: 'exact' }).eq('is_published', true)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (brandId) query = query.eq('brand_id', brandId)
  if (filters.productType) query = query.eq('product_type', filters.productType)
  if (searchIds) {
    if (!searchIds.length) return { products: [], total: 0, page, pageSize, pageCount: 0 }
    query = query.in('id', searchIds)
  }
  if (variantIds) {
    if (!variantIds.length) return { products: [], total: 0, page, pageSize, pageCount: 0 }
    query = query.in('id', Array.from(new Set(variantIds)))
  }
  if (filters.sort === 'featured') query = query.eq('is_featured', true)
  if (filters.sort !== 'price-asc' && filters.sort !== 'price-desc') query = query.order('created_at', { ascending: false })
  const { data, error, count } = await query.range(offset, offset + pageSize - 1)
  if (error) throw new Error('Unable to load the product catalogue.')
  const rows = (data ?? []) as unknown as RawProduct[]
  const variantsByProduct = await getVariantsByProductId(supabase, rows.map((row) => row.id))
  let products = rows.map((row) => normalizeProduct(row, variantsByProduct.get(row.id) ?? []))
  if (filters.sort === 'price-asc' || filters.sort === 'price-desc') products = products.sort((a, b) => (getStartingPrice(a) ?? Number.MAX_SAFE_INTEGER) - (getStartingPrice(b) ?? Number.MAX_SAFE_INTEGER))
  if (filters.sort === 'price-desc') products.reverse()
  const total = count ?? products.length
  return { products, total, page, pageSize, pageCount: Math.ceil(total / pageSize) }
}

export async function getFeaturedProducts(limit = 4) {
  return (await getProducts({ sort: 'featured', pageSize: Math.min(limit, 12) })).products
}

export async function getProductBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('slug', slug).eq('is_published', true).maybeSingle()
  if (error) throw new Error('Unable to load this product.')
  if (!data) return null
  const row = data as unknown as RawProduct
  const variantsByProduct = await getVariantsByProductId(supabase, [row.id])
  return normalizeProduct(row, variantsByProduct.get(row.id) ?? [])
}

export async function getBrands() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('brands').select('id,name,slug,logo_url,description,meta_title,meta_description').eq('is_active', true).order('name')
  if (error) throw new Error('Unable to load brands.')
  return (data ?? []) as StorefrontBrand[]
}

export async function getCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('categories').select('id,name,slug,description,image_url,sort_order,meta_title,meta_description').eq('is_active', true).order('sort_order').order('name')
  if (error) throw new Error('Unable to load categories.')
  return (data ?? []) as StorefrontCategory[]
}

export async function getProductTypes() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('products').select('product_type').eq('is_published', true).order('product_type').limit(100)
  if (error) throw new Error('Unable to load product types.')
  return Array.from(new Set((data ?? []).map((row) => row.product_type).filter(Boolean)))
}

export async function getStorefrontSettings(): Promise<StorefrontSettings> {
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('key,value').in('key', ['delivery_charges', 'business_policy'])
  const values = new Map((data ?? []).map((row) => [row.key, row.value] as [string, Json]))
  const delivery = (values.get('delivery_charges') ?? {}) as Record<string, unknown>
  const policy = (values.get('business_policy') ?? {}) as Record<string, unknown>
  return {
    delivery: { dhakaCharge: typeof delivery.dhaka === 'number' ? delivery.dhaka : siteConfig.delivery.dhakaCharge, outsideDhakaCharge: typeof delivery.outside_dhaka === 'number' ? delivery.outside_dhaka : siteConfig.delivery.outsideDhakaCharge },
    warranty: { guaranteeDays: typeof policy.guarantee_days === 'number' ? policy.guarantee_days : siteConfig.warranty.guaranteeDays, serviceWarrantyYears: typeof policy.service_warranty_years === 'number' ? policy.service_warranty_years : siteConfig.warranty.serviceWarrantyYears, policyText: typeof policy.policy_text === 'string' ? policy.policy_text : siteConfig.warranty.defaultPolicy },
  }
}

export function getProductPriceRange(product: StorefrontProduct) {
  const prices = product.variants.map((variant) => variant.price).filter(Number.isFinite)
  if (!prices.length) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`
}

export function getProductVariantSummary(product: StorefrontProduct) {
  return Array.from(new Set(product.variants.flatMap((variant) => [variant.ram, variant.storage, variant.color].filter(Boolean) as string[]))).slice(0, 3)
}

export function getProductPath(slug: string) { return `/products/${slug}` }
export function getBrandPath(slug: string) { return `/products?brand=${encodeURIComponent(slug)}` }
export function getCategoryPath(slug: string) { return `/products?category=${encodeURIComponent(slug)}` }
export function getSearchPath(query: string) { return `/search?q=${encodeURIComponent(query)}` }
export function getPaginationPages(page: number, pageCount: number) { const start = Math.max(1, page - 2); const end = Math.min(pageCount, page + 2); return pageCount > 1 ? Array.from({ length: end - start + 1 }, (_, index) => start + index) : [] }
export function getProductTypeLabel(value: string) { return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()) }
export function getProductImagePlaceholder(product: StorefrontProduct) { return product.name.slice(0, 2).toUpperCase() }
export function parsePage(value: string | undefined) { const page = Number(value); return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1 }
export function parsePrice(value: string | undefined) { const price = Number(value); return value && Number.isFinite(price) && price >= 0 ? price : undefined }
export function getStorefrontPolicySummary(settings: StorefrontSettings) { return `${settings.warranty.guaranteeDays} Days Guarantee · ${settings.warranty.serviceWarrantyYears} Year Service Warranty` }
export function getDeliverySummary(settings: StorefrontSettings) { return `Dhaka ${formatPrice(settings.delivery.dhakaCharge)} · Outside Dhaka ${formatPrice(settings.delivery.outsideDhakaCharge)}` }
export function getProductAvailabilityCopy(product: StorefrontProduct) { return getProductAvailability(product).label }
export function getProductDiscountLabel(product: StorefrontProduct) { const discount = getProductDiscount(product); return discount ? `Save ${discount}%` : null }
export function getProductDescription(product: StorefrontProduct) { return product.description || product.short_description || 'Product information will be updated soon.' }
export function getProductImageUrl(product: StorefrontProduct) { void product; return null as string | null }
export function getCatalogQuery(filters: ProductFilters) { const params = new URLSearchParams(); if (filters.category) params.set('category', filters.category); if (filters.brand) params.set('brand', filters.brand); if (filters.availability && filters.availability !== 'all') params.set('availability', filters.availability); if (filters.productType) params.set('type', filters.productType); if (filters.minPrice !== undefined) params.set('min', String(filters.minPrice)); if (filters.maxPrice !== undefined) params.set('max', String(filters.maxPrice)); if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort); if (filters.page && filters.page > 1) params.set('page', String(filters.page)); return params.toString() }
export function getStorefrontDescription() { return `${siteConfig.brandPromise}. Shop mobile phones and gadgets in Bangladesh with clear pricing, delivery information, and warranty context.` }
export function getProductMetaTitle(product: StorefrontProduct) { return product.meta_title || `${product.name} | ${siteConfig.name}` }
export function getProductMetaDescription(product: StorefrontProduct) { return product.meta_description || product.short_description || `${product.name} from ${siteConfig.name}.` }
export function getBrandMetaTitle(brand: StorefrontBrand) { return brand.meta_title || `${brand.name} mobile phones | ${siteConfig.name}` }
export function getCategoryMetaTitle(category: StorefrontCategory) { return category.meta_title || `${category.name} | ${siteConfig.name}` }
export function getBrandDescription(brand: StorefrontBrand) { return brand.description || `Explore ${brand.name} products from ${siteConfig.name}.` }
export function getCategoryDescription(category: StorefrontCategory) { return category.description || `Explore ${category.name} from ${siteConfig.name}.` }
export function getOrderBoundaryCopy() { return 'Checkout and order submission will be available in a later phase.' }
