import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import type { StorefrontBrand, StorefrontCategory } from '@/lib/services/storefront-utils'

const loadCatalogFilterData = async () => {
  const supabase = createPublicClient()
  const [brandsResult, categoriesResult, productTypesResult] = await Promise.all([
    supabase
      .from('brands')
      .select('id,name,slug,logo_url,description,meta_title,meta_description')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('categories')
      .select('id,name,slug,description,image_url,sort_order,meta_title,meta_description')
      .eq('is_active', true)
      .order('sort_order')
      .order('name'),
    supabase
      .from('products')
      .select('product_type')
      .eq('is_published', true)
      .order('product_type')
      .limit(100),
  ])

  if (brandsResult.error || categoriesResult.error || productTypesResult.error) {
    throw new Error('Unable to load catalogue filters.')
  }

  return {
    brands: (brandsResult.data ?? []) as StorefrontBrand[],
    categories: (categoriesResult.data ?? []) as StorefrontCategory[],
    productTypes: Array.from(new Set((productTypesResult.data ?? []).map((row) => row.product_type))),
  }
}

export const getCatalogFilterData = unstable_cache(
  loadCatalogFilterData,
  ['catalog-filter-data-v1'],
  { revalidate: 300, tags: ['storefront:catalog-filters', 'storefront:brands', 'storefront:categories'] },
)
