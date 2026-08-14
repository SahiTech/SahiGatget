import { createClient } from '@/lib/supabase/server'
import {
  normalizeProduct,
  normalizeVariant,
  cleanTerm,
  getStartingPrice,
} from './storefront-utils'
import type {
  StorefrontProduct,
  StorefrontVariant,
  StorefrontBrand,
  StorefrontCategory,
  BrandRow,
  CategoryRow,
  ProductRow,
  ProductImageRow,
  ProductFilters,
  ProductListResult,
  StorefrontSettings,
  HomepageBanner
} from './storefront-utils'

export * from './storefront-utils'

type RawProduct = ProductRow & { 
  brand?: BrandRow | null; 
  category?: CategoryRow | null;
  product_images?: ProductImageRow[]
}
type RawStorefrontVariant = Omit<StorefrontVariant, 'price' | 'compare_at_price'> & { price: number | string; compare_at_price: number | string | null }

const PRODUCT_SELECT = `
  id,brand_id,category_id,name,slug,short_description,description,product_type,status,is_featured,is_published,warranty_policy,meta_title,meta_description,created_at,updated_at,
  brand:brands(id,name,slug,logo_url,description,meta_title,meta_description),
  category:categories(id,name,slug,description,image_url,sort_order,meta_title,meta_description),
  product_images(id,image_url,alt_text,is_primary,sort_order)
`
const STOREFRONT_VARIANT_SELECT = 'id,product_id,sku,variant_title,ram,storage,color,price,compare_at_price,is_in_stock,is_low_stock'

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

export async function getStorefrontSettings(): Promise<StorefrontSettings> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('storefront_settings').select('config').maybeSingle()
  if (error || !data) {
    return {
      delivery: { dhakaCharge: 80, outsideDhakaCharge: 130 },
      warranty: { guaranteeDays: 7, serviceWarrantyYears: 1, policyText: 'Standard 1 Year Brand Warranty' }
    }
  }
  return data.config as unknown as StorefrontSettings
}

export async function getProductTypes() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('products').select('product_type').eq('is_published', true).order('product_type').limit(100)
  if (error) throw new Error('Unable to load product types.')
  return Array.from(new Set((data ?? []).map((row) => row.product_type)))
}

export async function getStorefrontBanners() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('homepage_banners')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading banners:', error)
    return []
  }
  return data as HomepageBanner[]
}
