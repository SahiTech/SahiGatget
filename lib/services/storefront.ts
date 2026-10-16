import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createPublicClient } from '@/lib/supabase/public'
import {
  normalizeProduct,
  normalizeVariant,
  cleanTerm,
  getStartingPrice,
} from './storefront-utils'
import type {
  FooterConfig,
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
  HomepageBanner,
  StorefrontProduct
} from './storefront-utils'

export * from './storefront-utils'

type RawProduct = ProductRow & { 
  brand?: BrandRow | null; 
  category?: CategoryRow | null;
  product_images?: Array<ProductImageRow & { variant_id: string | null }>
}
type RawStorefrontVariant = Omit<StorefrontVariant, 'price' | 'compare_at_price'> & { price: number | string; compare_at_price: number | string | null }

const PRODUCT_CARD_SELECT = `
  id,brand_id,category_id,name,slug,product_type,is_featured,is_published,created_at,
  brand:brands(id,name,slug,logo_url),
  category:categories(id,name,slug),
  product_images(id,variant_id,image_url,alt_text,is_primary,sort_order)
`
const PRODUCT_LIST_SELECT = PRODUCT_CARD_SELECT
const PRODUCT_DETAIL_SELECT = `
  id,brand_id,category_id,name,slug,short_description,description,product_type,status,is_featured,is_published,warranty_policy,meta_title,meta_description,created_at,updated_at,
  brand:brands(id,name,slug,logo_url,description,meta_title,meta_description),
  category:categories(id,name,slug,description,image_url,sort_order,meta_title,meta_description),
  product_images(id,variant_id,image_url,alt_text,is_primary,sort_order)
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

const HOMEPAGE_BRAND_SELECT = 'id,name,slug,logo_url,description,meta_title,meta_description'
const HOMEPAGE_CATEGORY_SELECT = 'id,name,slug,description,image_url,sort_order,meta_title,meta_description'
const HOMEPAGE_BANNER_SELECT = 'id,desktop_image_url,mobile_image_url,heading,description,primary_cta_text,primary_cta_url,secondary_cta_text,secondary_cta_url,is_active,sort_order,created_at,updated_at'

const getHomepageBanners = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('homepage_banners')
      .select(HOMEPAGE_BANNER_SELECT)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []) as HomepageBanner[]
  },
  ['homepage-banners'],
  { revalidate: 60, tags: ['homepage:banners'] },
)

export async function getHomepageHero() {
  const banners = await getHomepageBanners()
  if (banners.length > 0) return { banners, productCount: 0, brandCount: 0, categoryCount: 0 }

  // The fallback hero only needs to render the fallback copy. Avoid three exact-count
  // queries on the critical homepage path when there are no active banners.
  return { banners, productCount: 0, brandCount: 0, categoryCount: 0 }
}

export const getHomepageFeaturedProducts = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_CARD_SELECT)
      .eq('is_published', true)
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(8)
    if (error) return []
    const rows = (data ?? []) as unknown as RawProduct[]
    const variantsByProduct = await getVariantsByProductId(supabase, rows.map((row) => row.id))
    return rows.map((row) => normalizeProduct(row, variantsByProduct.get(row.id) ?? []))
  },
  ['homepage-featured-products'],
  { revalidate: 30, tags: ['homepage:products'] },
)

export const getHomepageLatestProducts = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_CARD_SELECT)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(8)
    if (error) return []
    const rows = (data ?? []) as unknown as RawProduct[]
    const variantsByProduct = await getVariantsByProductId(supabase, rows.map((row) => row.id))
    return rows.map((row) => normalizeProduct(row, variantsByProduct.get(row.id) ?? []))
  },
  ['homepage-latest-products'],
  { revalidate: 30, tags: ['homepage:products'] },
)

export const getHomepageCategories = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('categories')
      .select(HOMEPAGE_CATEGORY_SELECT)
      .eq('is_active', true)
      .order('sort_order')
      .order('name')
    if (error) return []
    return (data ?? []) as StorefrontCategory[]
  },
  ['homepage-categories'],
  { revalidate: 300, tags: ['homepage:categories'] },
)

export const getHomepageBrands = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('brands')
      .select(HOMEPAGE_BRAND_SELECT)
      .eq('is_active', true)
      .order('name')
    if (error) return []
    return (data ?? []) as StorefrontBrand[]
  },
  ['homepage-brands'],
  { revalidate: 300, tags: ['homepage:brands'] },
)

export const getHomepageDeals = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data: variantRows, error: variantError } = await supabase
      .from('storefront_variants')
      .select('product_id,price,compare_at_price')
      .not('compare_at_price', 'is', null)
      .limit(96)
    if (variantError) return []

    const discountedIds = Array.from(new Set(
      (variantRows ?? [])
        .filter((row) => Number(row.compare_at_price) > Number(row.price))
        .map((row) => row.product_id),
    )).slice(0, 12)

    if (!discountedIds.length) return []

    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_CARD_SELECT)
      .eq('is_published', true)
      .in('id', discountedIds)
      .order('created_at', { ascending: false })
      .limit(4)
    if (error) return []

    const rows = (data ?? []) as unknown as RawProduct[]
    const variantsByProduct = await getVariantsByProductId(supabase, rows.map((row) => row.id))
    return rows
      .map((row) => normalizeProduct(row, variantsByProduct.get(row.id) ?? []))
      .filter((product) => product.variants.some((variant) => variant.compare_at_price && variant.compare_at_price > variant.price))
      .slice(0, 4)
  },
  ['homepage-deals'],
  { revalidate: 30, tags: ['homepage:products'] },
)

export const getHomepageData = unstable_cache(async () => {
  const supabase = createPublicClient()
  const [latestResult, featuredResult, brandsResult, categoriesResult, bannersResult] = await Promise.all([
    supabase.from('products').select(PRODUCT_CARD_SELECT).eq('is_published', true).order('created_at', { ascending: false }).limit(12),
    supabase.from('products').select(PRODUCT_CARD_SELECT).eq('is_published', true).eq('is_featured', true).order('created_at', { ascending: false }).limit(8),
    supabase.from('brands').select('id,name,slug,logo_url,description,meta_title,meta_description').eq('is_active', true).order('name'),
    supabase.from('categories').select('id,name,slug,description,image_url,sort_order,meta_title,meta_description').eq('is_active', true).order('sort_order').order('name'),
    supabase.from('homepage_banners').select('*').eq('is_active', true).order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
  ])
  if (latestResult.error || featuredResult.error || brandsResult.error || categoriesResult.error) {
    throw new Error('Unable to load the storefront.')
  }
  const latestRows = (latestResult.data ?? []) as unknown as RawProduct[]
  const featuredRows = (featuredResult.data ?? []) as unknown as RawProduct[]
  const productIds = Array.from(new Set([...latestRows, ...featuredRows].map((row) => row.id)))
  const variantsByProduct = await getVariantsByProductId(supabase, productIds)
  const normalizeRows = (rows: RawProduct[]) => rows.map((row) => normalizeProduct(row, variantsByProduct.get(row.id) ?? []))
  const allProducts = normalizeRows(latestRows)
  const featuredProducts = normalizeRows(featuredRows)
  return {
    allProducts,
    featuredProducts: featuredProducts.length ? featuredProducts : allProducts.slice(0, 8),
    brands: (brandsResult.data ?? []) as StorefrontBrand[],
    categories: (categoriesResult.data ?? []) as StorefrontCategory[],
    banners: bannersResult.error ? [] : (bannersResult.data ?? []) as HomepageBanner[],
  }
}, ['homepage-storefront'], { revalidate: 30 })

export async function getProducts(filters: ProductFilters = {}): Promise<ProductListResult> {
  const supabase = await createClient()
  const pageSize = Math.min(Math.max(filters.pageSize ?? 12, 1), 48)
  const page = Math.max(filters.page ?? 1, 1)
  const offset = (page - 1) * pageSize
  // Resolve independent filter inputs concurrently to avoid serial database round trips.
  const resolveCategoryId = async (): Promise<string | null> => {
    if (!filters.category) return null
    const { data } = await supabase.from('categories').select('id').eq('slug', filters.category).eq('is_active', true).maybeSingle()
    return data?.id ?? '__missing__'
  }
  const resolveBrandId = async (): Promise<string | null> => {
    if (!filters.brand) return null
    const { data } = await supabase.from('brands').select('id').eq('slug', filters.brand).eq('is_active', true).maybeSingle()
    return data?.id ?? '__missing__'
  }
  const [categoryId, brandId, searchIds, variantIds] = await Promise.all([
    resolveCategoryId(),
    resolveBrandId(),
    filters.query ? resolveProductIdsForSearch(supabase, filters.query) : Promise.resolve(null),
    resolveVariantIds(supabase, filters),
  ])
  let query = supabase.from('products').select(PRODUCT_LIST_SELECT, { count: 'exact' }).eq('is_published', true)
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

export async function getProductById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('products').select(PRODUCT_DETAIL_SELECT).eq('id', id).eq('is_published', true).maybeSingle()
  if (error) throw new Error('Unable to load this product.')
  if (!data) return null
  const row = data as unknown as RawProduct
  const variantsByProduct = await getVariantsByProductId(supabase, [row.id])
  return normalizeProduct(row, variantsByProduct.get(row.id) ?? [])
}

const getCachedProductById = unstable_cache(
  async (id: string) => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_DETAIL_SELECT)
      .eq('id', id)
      .eq('is_published', true)
      .maybeSingle()
    if (error) throw new Error('Unable to load this product.')
    if (!data) return null
    const row = data as unknown as RawProduct
    const variantsByProduct = await getVariantsByProductId(supabase, [row.id])
    return normalizeProduct(row, variantsByProduct.get(row.id) ?? [])
  },
  ['public-product-by-id-v1'],
  { revalidate: 60, tags: ['storefront:product-detail'] }
)

export async function getPublicProductById(id: string) {
  return getCachedProductById(id)
}

const getCachedProductBySlug = unstable_cache(
  async (slug: string) => {
    const supabase = createPublicClient()
    const { data, error } = await supabase.from('products').select(PRODUCT_DETAIL_SELECT).eq('slug', slug).eq('is_published', true).maybeSingle()
    if (error) throw new Error('Unable to load this product.')
    if (!data) return null
    const row = data as unknown as RawProduct
    const variantsByProduct = await getVariantsByProductId(supabase, [row.id])
    return normalizeProduct(row, variantsByProduct.get(row.id) ?? [])
  },
  ['product-by-slug-v2'],
  { revalidate: 60, tags: ['storefront:product-detail'] }
)

export async function getProductBySlug(slug: string) {
  return getCachedProductBySlug(slug)
}

async function getProductCards(filters: ProductFilters = {}): Promise<StorefrontProduct[]> {
  const supabase = await createClient()
  const pageSize = Math.min(Math.max(filters.pageSize ?? 12, 1), 24)
  const [searchIds, variantIds] = await Promise.all([
    filters.query ? resolveProductIdsForSearch(supabase, filters.query) : Promise.resolve(null),
    resolveVariantIds(supabase, filters),
  ])
  let query = supabase.from('products').select(PRODUCT_CARD_SELECT).eq('is_published', true).limit(pageSize)
  if (filters.category) {
    const { data } = await supabase.from('categories').select('id').eq('slug', filters.category).eq('is_active', true).maybeSingle()
    query = query.eq('category_id', data?.id ?? '__missing__')
  }
  if (filters.brand) {
    const { data } = await supabase.from('brands').select('id').eq('slug', filters.brand).eq('is_active', true).maybeSingle()
    query = query.eq('brand_id', data?.id ?? '__missing__')
  }
  if (filters.productType) query = query.eq('product_type', filters.productType)
  if (filters.sort === 'featured') query = query.eq('is_featured', true)
  if (searchIds) {
    if (!searchIds.length) return []
    query = query.in('id', searchIds)
  }
  if (variantIds) {
    if (!variantIds.length) return []
    query = query.in('id', Array.from(new Set(variantIds)))
  }
  if (filters.sort !== 'price-asc' && filters.sort !== 'price-desc') query = query.order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) throw new Error('Unable to load product cards.')
  const rows = (data ?? []) as unknown as RawProduct[]
  const variantsByProduct = await getVariantsByProductId(supabase, rows.map((row) => row.id))
  const products = rows.map((row) => normalizeProduct(row, variantsByProduct.get(row.id) ?? []))
  if (filters.sort === 'price-asc' || filters.sort === 'price-desc') products.sort((a, b) => (getStartingPrice(a) ?? Number.MAX_SAFE_INTEGER) - (getStartingPrice(b) ?? Number.MAX_SAFE_INTEGER))
  if (filters.sort === 'price-desc') products.reverse()
  return products
}

export async function getSearchSuggestions(query: string, limit = 6): Promise<StorefrontProduct[]> {
  return getProductCards({ query, pageSize: Math.min(Math.max(limit, 1), 12) })
}

const getCachedRelatedProducts = unstable_cache(
  async (productId: string, categoryId: string | null, productType: string | null, brandId: string | null, productName: string, limit: number) => {
    const supabase = createPublicClient()
    const filters = [
      categoryId ? `category_id.eq.${categoryId}` : null,
      productType ? `product_type.eq.${productType}` : null,
      brandId ? `brand_id.eq.${brandId}` : null,
    ].filter((value): value is string => Boolean(value))
    if (!filters.length) return []
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_CARD_SELECT)
      .eq('is_published', true)
      .neq('id', productId)
      .or(filters.join(','))
      .order('created_at', { ascending: false })
      .limit(Math.min(24, Math.max(limit * 3, 12)))
    if (error) throw new Error('Unable to load related products.')
    const rows = (data ?? []) as unknown as RawProduct[]
    const variantsByProduct = await getVariantsByProductId(supabase, rows.map((row) => row.id))
    const products = rows.map((row) => normalizeProduct(row, variantsByProduct.get(row.id) ?? []))
    const tokens = productName.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2)
    return products
      .map((candidate) => {
        const categoryScore = categoryId && candidate.category?.id === categoryId ? 100 : 0
        const typeScore = productType && candidate.product_type === productType ? 50 : 0
        const brandScore = brandId && candidate.brand?.id === brandId ? 35 : 0
        const nameScore = tokens.reduce((score, token) => score + (candidate.name.toLowerCase().includes(token) ? 8 : 0), 0)
        return { candidate, score: categoryScore + typeScore + brandScore + nameScore }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(8, Math.max(1, limit)))
      .map(({ candidate }) => candidate)
  },
  ['related-products-v1'],
  { revalidate: 60, tags: ['storefront:related-products'] },
)

export async function getRelatedProducts(product: StorefrontProduct, limit = 4) {
  return getCachedRelatedProducts(
    product.id,
    product.category?.id ?? null,
    product.product_type ?? null,
    product.brand?.id ?? null,
    product.name,
    Math.min(8, Math.max(1, limit)),
  )
}

export async function getBrands() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('brands').select('id,name,slug,logo_url,description,meta_title,meta_description').eq('is_active', true).order('name')
  if (error) throw new Error('Unable to load brands.')
  return (data ?? []) as StorefrontBrand[]
}

export async function getBrandBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('brands').select('id,name,slug,logo_url,description,meta_title,meta_description').eq('slug', slug).eq('is_active', true).maybeSingle()
  if (error) throw new Error('Unable to load this brand.')
  return (data ?? null) as StorefrontBrand | null
}

export async function getCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('categories').select('id,name,slug,description,image_url,sort_order,meta_title,meta_description').eq('is_active', true).order('sort_order').order('name')
  if (error) throw new Error('Unable to load categories.')
  return (data ?? []) as StorefrontCategory[]
}

const defaultFooterConfig = {
  social: { facebook: 'https://www.facebook.com/share/1EA2WP2yNe/', tiktok: '', instagram: '', x: '', youtube: '' },
  payments: { cash_on_delivery: true, visa: false, mastercard: false },
}

async function loadStorefrontSettings(): Promise<StorefrontSettings> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      delivery: { dhakaCharge: 80, outsideDhakaCharge: 130 },
      warranty: { guaranteeDays: 7, serviceWarrantyYears: 1, policyText: 'Standard 1 Year Brand Warranty' },
      footer: defaultFooterConfig,
    }
  }
  const supabase = createPublicClient()
  const { data, error } = await supabase.from('settings').select('key, value').in('key', ['delivery_charges', 'business_policy', 'footer_config']).limit(3)
  if (error) {
    return {
      delivery: { dhakaCharge: 80, outsideDhakaCharge: 130 },
      warranty: { guaranteeDays: 7, serviceWarrantyYears: 1, policyText: 'Standard 1 Year Brand Warranty' },
      footer: defaultFooterConfig,
    }
  }
  const settings = Object.fromEntries((data ?? []).map((item) => [item.key, item.value])) as {
    delivery_charges?: { dhaka?: number; outside_dhaka?: number }
    business_policy?: { guarantee_days?: number; service_warranty_years?: number; policy_text?: string }
    footer_config?: Partial<FooterConfig> & { social?: Partial<FooterConfig['social']>; payments?: Partial<FooterConfig['payments']> }
  }
  const delivery = settings.delivery_charges ?? { dhaka: 80, outside_dhaka: 130 }
  const policy = settings.business_policy ?? { guarantee_days: 7, service_warranty_years: 1, policy_text: 'Standard 1 Year Brand Warranty' }
  return {
    delivery: { dhakaCharge: Number(delivery.dhaka ?? 80), outsideDhakaCharge: Number(delivery.outside_dhaka ?? 130) },
    warranty: { guaranteeDays: Number(policy.guarantee_days ?? 7), serviceWarrantyYears: Number(policy.service_warranty_years ?? 1), policyText: String(policy.policy_text ?? 'Standard 1 Year Brand Warranty') },
    footer: { ...defaultFooterConfig, ...(settings.footer_config ?? {}), social: { ...defaultFooterConfig.social, ...(settings.footer_config?.social ?? {}) }, payments: { ...defaultFooterConfig.payments, ...(settings.footer_config?.payments ?? {}) } },
  }
}

// Commerce-sensitive delivery and warranty settings stay uncached so pricing/order
// flows never receive stale values from a public cache.
export const getStorefrontSettings = loadStorefrontSettings

async function loadFooterSettings(): Promise<StorefrontSettings> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      delivery: { dhakaCharge: 80, outsideDhakaCharge: 130 },
      warranty: { guaranteeDays: 7, serviceWarrantyYears: 1, policyText: 'Standard 1 Year Brand Warranty' },
      footer: defaultFooterConfig,
    }
  }
  const supabase = createPublicClient()
  const { data, error } = await supabase.from('settings').select('key, value').eq('key', 'footer_config').limit(1)
  if (error) return { ...await loadStorefrontSettings(), footer: defaultFooterConfig }
  const footer = (data?.[0]?.value ?? {}) as Partial<FooterConfig> & { social?: Partial<FooterConfig['social']>; payments?: Partial<FooterConfig['payments']> }
  return {
    delivery: { dhakaCharge: 80, outsideDhakaCharge: 130 },
    warranty: { guaranteeDays: 7, serviceWarrantyYears: 1, policyText: 'Standard 1 Year Brand Warranty' },
    footer: { ...defaultFooterConfig, ...footer, social: { ...defaultFooterConfig.social, ...(footer.social ?? {}) }, payments: { ...defaultFooterConfig.payments, ...(footer.payments ?? {}) } },
  }
}

export const getCachedFooterSettings = unstable_cache(
  loadFooterSettings,
  ['storefront-footer-settings'],
  { revalidate: 300, tags: ['storefront:settings'] },
)

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

export async function getPublicSitemapEntries() {
  const supabase = await createClient()
  const [products, brands] = await Promise.all([
    supabase.from('products').select('slug,updated_at,created_at').eq('is_published', true).order('slug').limit(5000),
    supabase.from('brands').select('slug,updated_at,created_at').eq('is_active', true).order('slug').limit(1000),
  ])
  if (products.error || brands.error) throw new Error('Unable to load public sitemap entries.')
  return {
    products: (products.data ?? []).map((entry) => ({ slug: entry.slug, lastModified: entry.updated_at || entry.created_at })),
    brands: (brands.data ?? []).map((entry) => ({ slug: entry.slug, lastModified: entry.updated_at || entry.created_at })),
  }
}
