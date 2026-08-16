import type { StorefrontProduct } from '@/lib/services/storefront-utils'

export type LandingPageType = 'product' | 'campaign'
export type LandingPageStatus = 'draft' | 'published' | 'archived'

export type LandingSection =
  | { id: string; type: 'announcement'; eyebrow?: string; title: string; body?: string; tone?: 'neutral' | 'emerald' | 'amber' }
  | { id: string; type: 'hero'; eyebrow?: string; title: string; body?: string; ctaLabel?: string; ctaHref?: string; imageUrl?: string; imageAlt?: string }
  | { id: string; type: 'features'; title: string; items: Array<{ title: string; body?: string; icon?: string }> }
  | { id: string; type: 'product'; productId: string; title?: string; body?: string; ctaLabel?: string }
  | { id: string; type: 'trust'; title: string; items: string[] }
  | { id: string; type: 'faq'; title: string; items: Array<{ question: string; answer: string }> }
  | { id: string; type: 'rich_text'; title?: string; body: string }
  | { id: string; type: 'cta'; title: string; body?: string; label: string; href: string }

export type LandingPage = {
  id: string
  slug: string
  internal_name: string
  page_type: LandingPageType
  status: LandingPageStatus
  linked_product_id: string | null
  hero_image_url: string | null
  mobile_hero_image_url: string | null
  og_image_url: string | null
  sections: LandingSection[]
  seo_title: string | null
  seo_description: string | null
  noindex: boolean
  starts_at: string | null
  ends_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  linked_products?: Array<{ product_id: string; sort_order: number }>
  linked_product?: StorefrontProduct | null
  resolved_products?: StorefrontProduct[]
}

export type LandingPageInput = Pick<LandingPage, 'slug' | 'internal_name' | 'page_type' | 'status' | 'linked_product_id' | 'hero_image_url' | 'mobile_hero_image_url' | 'og_image_url' | 'sections' | 'seo_title' | 'seo_description' | 'noindex' | 'starts_at' | 'ends_at'> & {
  linked_product_ids?: string[]
}

export const landingSectionTypes = ['announcement', 'hero', 'features', 'product', 'trust', 'faq', 'rich_text', 'cta'] as const

export function isLandingPagePublic(page: Pick<LandingPage, 'status' | 'starts_at' | 'ends_at' | 'noindex'>, now = Date.now()) {
  if (page.status !== 'published') return false
  if (page.starts_at && new Date(page.starts_at).getTime() > now) return false
  if (page.ends_at && new Date(page.ends_at).getTime() <= now) return false
  return true
}

export function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90)
}

function assertSafeUrl(value: string | undefined, field: string) {
  if (!value) return
  if (value.startsWith('/') || value.startsWith('#')) return
  try {
    if (new URL(value).protocol !== 'https:') throw new Error(`${field} must use an internal path or HTTPS URL.`)
  } catch {
    throw new Error(`${field} must use an internal path or HTTPS URL.`)
  }
}

function validateSections(sections: LandingSection[]) {
  if (!Array.isArray(sections) || sections.length > 24) throw new Error('Landing pages may contain up to 24 structured sections.')
  for (const section of sections) {
    if (!section || typeof section.id !== 'string' || !section.id.trim() || !landingSectionTypes.includes(section.type)) throw new Error('Each section must use a valid type and identifier.')
    if ('title' in section && typeof section.title === 'string' && section.title.length > 180) throw new Error('Section titles must be 180 characters or fewer.')
    if ('body' in section && typeof section.body === 'string' && section.body.length > 4000) throw new Error('Section body text must be 4,000 characters or fewer.')
    if (section.type === 'hero') { assertSafeUrl(section.ctaHref, 'Hero CTA'); assertSafeUrl(section.imageUrl, 'Hero image') }
    if (section.type === 'cta') assertSafeUrl(section.href, 'CTA link')
    if (section.type === 'product' && !section.productId) throw new Error('Product sections require a product ID.')
  }
  return sections
}

export function validateLandingPageInput(input: LandingPageInput) {
  const slug = normalizeSlug(input.slug)
  if (!slug) throw new Error('Add a URL slug using letters, numbers, and hyphens.')
  if (!input.internal_name.trim()) throw new Error('Add an internal page name.')
  if (input.page_type === 'product' && !input.linked_product_id) throw new Error('Product landing pages require a linked product.')
  const sections = validateSections(input.sections)
  assertSafeUrl(input.hero_image_url ?? undefined, 'Hero image')
  assertSafeUrl(input.mobile_hero_image_url ?? undefined, 'Mobile hero image')
  assertSafeUrl(input.og_image_url ?? undefined, 'Social image')
  if (input.ends_at && input.starts_at && new Date(input.ends_at).getTime() <= new Date(input.starts_at).getTime()) throw new Error('The end time must be after the start time.')
  return { ...input, slug, internal_name: input.internal_name.trim(), sections: sections.slice(0, 24) }
}
