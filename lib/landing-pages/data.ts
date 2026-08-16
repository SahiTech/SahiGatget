import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'
import { getProductById } from '@/lib/services/storefront'
import type { LandingPage, LandingSection } from './types'

type LandingPageRow = Database['public']['Tables']['landing_pages']['Row']

function mapPage(row: LandingPageRow, linkedProducts: Array<{ product_id: string; sort_order: number }> = []): LandingPage {
  return {
    ...row,
    sections: (Array.isArray(row.sections) ? row.sections : []) as unknown as LandingSection[],
    linked_products: linkedProducts,
  } as LandingPage
}

export async function getPublicLandingPage(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('landing_pages').select('*').eq('slug', slug).eq('status', 'published').maybeSingle()
  if (error) throw new Error('Unable to load this landing page.')
  if (!data) return null
  const page = mapPage(data)
  const { data: links } = await supabase.from('landing_page_products').select('product_id,sort_order').eq('landing_page_id', page.id).order('sort_order').limit(48)
  const linkedIds = Array.from(new Set([page.linked_product_id, ...(links ?? []).map((link) => link.product_id)].filter((id): id is string => Boolean(id))))
  const resolvedProducts = (await Promise.all(linkedIds.map((id) => getProductById(id)))).filter((product): product is NonNullable<typeof product> => Boolean(product))
  return { ...page, linked_products: links ?? [], linked_product: page.linked_product_id ? resolvedProducts.find((product) => product?.id === page.linked_product_id) ?? null : null, resolved_products: resolvedProducts }
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
