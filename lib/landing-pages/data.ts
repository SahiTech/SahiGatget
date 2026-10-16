import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createPublicClient } from '@/lib/supabase/public'
import type { Database } from '@/lib/types/database'
import { getPublicProductById } from '@/lib/services/storefront'
import type { LandingPage, LandingSection } from './types'

type LandingPageRow = Database['public']['Tables']['landing_pages']['Row']

function mapPage(row: LandingPageRow, linkedProducts: Array<{ product_id: string; sort_order: number }> = []): LandingPage {
  return {
    ...row,
    sections: (Array.isArray(row.sections) ? row.sections : []) as unknown as LandingSection[],
    linked_products: linkedProducts,
  } as LandingPage
}

const getCachedPublicLandingPage = unstable_cache(
  async (slug: string) => {
    // Public landing content is readable without a user session. Use the anon
    // client so this render can be cached instead of depending on request cookies.
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
    if (error) throw new Error('Unable to load this landing page.')
    if (!data) return null
    const page = mapPage(data)

    // Only one linked product is rendered publicly; avoid fetching all links.
    let selectedProductId = page.linked_product_id
    let links: Array<{ product_id: string; sort_order: number }> = []
    if (!selectedProductId) {
      const result = await supabase
        .from('landing_page_products')
        .select('product_id,sort_order')
        .eq('landing_page_id', page.id)
        .order('sort_order')
        .limit(1)
      if (result.error) throw new Error('Unable to load this landing page.')
      links = result.data ?? []
      selectedProductId = links[0]?.product_id ?? null
    }

    const selectedProduct = selectedProductId ? await getPublicProductById(selectedProductId) : null
    return {
      ...page,
      linked_products: links,
      linked_product: page.linked_product_id ? selectedProduct : null,
      resolved_products: selectedProduct ? [selectedProduct] : [],
    }
  },
  ['public-landing-page-v1'],
  { revalidate: 60, tags: ['landing-pages:public'] },
)

export async function getPublicLandingPage(slug: string) {
  return getCachedPublicLandingPage(slug)
}

export async function getPublicLandingPageEntries() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('landing_pages').select('slug,updated_at,seo_title,noindex').eq('status', 'published').eq('noindex', false).order('slug').limit(1000)
  if (error) throw new Error('Unable to load landing page sitemap entries.')
  return data ?? []
}

export async function getAdminLandingPages(): Promise<LandingPage[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('landing_pages').select('*').order('updated_at', { ascending: false }).limit(200)
  if (error) throw new Error('Unable to load landing pages.')
  return (data ?? []).map((row) => mapPage(row))
}

export async function getAdminLandingPage(id: string): Promise<LandingPage | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('landing_pages').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error('Unable to load the landing page.')
  return data ? mapPage(data) : null
}
