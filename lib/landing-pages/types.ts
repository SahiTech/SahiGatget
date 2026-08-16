import type { StorefrontProduct } from '@/lib/services/storefront-utils'

export type LandingPageType = 'product' | 'campaign'
export type LandingPageStatus = 'draft' | 'published' | 'archived'

export type LandingSectionBase = { id: string; enabled?: boolean; mobileHidden?: boolean; desktopHidden?: boolean }
export type LandingSection =
  | (LandingSectionBase & { type: 'announcement'; eyebrow?: string; title: string; body?: string; tone?: 'neutral' | 'emerald' | 'amber' })
  | (LandingSectionBase & { type: 'hero'; eyebrow?: string; title: string; body?: string; ctaLabel?: string; ctaHref?: string; imageUrl?: string; imageAlt?: string })
  | (LandingSectionBase & { type: 'features'; title: string; items: Array<{ title: string; body?: string; icon?: string }> })
  | (LandingSectionBase & { type: 'product'; productId: string; title?: string; body?: string; ctaLabel?: string })
  | (LandingSectionBase & { type: 'offer'; title: string; body?: string; discountText?: string; ctaLabel?: string; ctaHref?: string; showLivePrice?: boolean; productId?: string })
  | (LandingSectionBase & { type: 'product_gallery'; title?: string; productId?: string })
  | (LandingSectionBase & { type: 'benefits'; title: string; items: Array<{ title: string; body?: string }> })
  | (LandingSectionBase & { type: 'specifications'; title: string; fields: Array<{ label: string; value: string }> })
  | (LandingSectionBase & { type: 'variant_selector'; title?: string; productId?: string })
  | (LandingSectionBase & { type: 'quantity_selector'; title?: string; maxQuantity?: number })
  | (LandingSectionBase & { type: 'delivery_info'; title: string; body: string; href?: string })
  | (LandingSectionBase & { type: 'warranty'; title: string; items: string[]; href?: string })
  | (LandingSectionBase & { type: 'social_proof'; title: string; body: string; disclaimer?: string })
  | (LandingSectionBase & { type: 'image_text'; title: string; body?: string; imageUrl: string; imageAlt: string; ctaLabel?: string; ctaHref?: string })
  | (LandingSectionBase & { type: 'comparison'; title: string; items: Array<{ label: string; value: string }> })
  | (LandingSectionBase & { type: 'related_products'; title?: string; productIds?: string[] })
  | (LandingSectionBase & { type: 'sticky_mobile_cta'; label: string; href: string; productId?: string })
  | (LandingSectionBase & { type: 'countdown'; title: string; body?: string; endsAt: string })
  | (LandingSectionBase & { type: 'order'; title?: string; body?: string; productId?: string; ctaLabel?: string })
  | (LandingSectionBase & { type: 'trust'; title: string; items: string[] })
  | (LandingSectionBase & { type: 'faq'; title: string; items: Array<{ question: string; answer: string }> })
  | (LandingSectionBase & { type: 'rich_text'; title?: string; body: string })
  | (LandingSectionBase & { type: 'cta'; title: string; body?: string; label: string; href: string })

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

export const landingSectionTypes = ['announcement', 'hero', 'features', 'product', 'offer', 'product_gallery', 'benefits', 'specifications', 'variant_selector', 'quantity_selector', 'delivery_info', 'warranty', 'social_proof', 'image_text', 'comparison', 'related_products', 'sticky_mobile_cta', 'countdown', 'order', 'trust', 'faq', 'rich_text', 'cta'] as const

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

function assertText(value: unknown, field: string, max: number) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${field} must be text with ${max} characters or fewer.`)
}

function validateSections(sections: LandingSection[]) {
  if (!Array.isArray(sections) || sections.length > 32) throw new Error('Landing pages may contain up to 32 structured sections.')
  const ids = new Set<string>()
  for (const section of sections) {
    if (!section || typeof section.id !== 'string' || !section.id.trim() || ids.has(section.id) || !landingSectionTypes.includes(section.type)) throw new Error('Each section must use a unique valid type and identifier.')
    ids.add(section.id)
    if ('title' in section && typeof section.title === 'string') assertText(section.title, 'Section title', 180)
    if ('body' in section && typeof section.body === 'string') assertText(section.body, 'Section body', 4000)
    if (section.type === 'hero') { assertSafeUrl(section.ctaHref, 'Hero CTA'); assertSafeUrl(section.imageUrl, 'Hero image') }
    if (section.type === 'cta') assertSafeUrl(section.href, 'CTA link')
    if (section.type === 'image_text') { assertSafeUrl(section.imageUrl, 'Image-text image'); assertSafeUrl(section.ctaHref, 'Image-text CTA') }
    if (section.type === 'delivery_info' || section.type === 'warranty') assertSafeUrl(section.href, `${section.type} link`)
    if (section.type === 'sticky_mobile_cta') assertSafeUrl(section.href, 'Sticky CTA')
    if (section.type === 'offer') { assertSafeUrl(section.ctaHref, 'Offer CTA'); if (section.discountText) assertText(section.discountText, 'Offer text', 240) }
    if (section.type === 'product' || section.type === 'order') if (!section.productId) throw new Error(`${section.type === 'product' ? 'Product' : 'Order'} sections require a product ID.`)
    if (section.type === 'countdown' && Number.isNaN(new Date(section.endsAt).getTime())) throw new Error('Countdown sections require a valid end time.')
    if (section.type === 'quantity_selector' && section.maxQuantity !== undefined && (!Number.isInteger(section.maxQuantity) || section.maxQuantity < 1 || section.maxQuantity > 99)) throw new Error('Quantity limits must be whole numbers between 1 and 99.')
    if (section.type === 'social_proof') assertText(section.body, 'Social proof text', 2000)
  }
  return sections
}

export function validateLandingPageInput(input: LandingPageInput) {
  const slug = normalizeSlug(input.slug)
  if (!slug) throw new Error('Add a URL slug using letters, numbers, and hyphens.')
  if (!input.internal_name.trim()) throw new Error('Add an internal page name.')
  if (input.page_type === 'product' && !input.linked_product_id) throw new Error('Product landing pages require a linked product.')
  if (input.status === 'published' && input.noindex) throw new Error('Published pages must be indexable or remain in draft.')
  const sections = validateSections(input.sections)
  assertSafeUrl(input.hero_image_url ?? undefined, 'Hero image')
  assertSafeUrl(input.mobile_hero_image_url ?? undefined, 'Mobile hero image')
  assertSafeUrl(input.og_image_url ?? undefined, 'Social image')
  if (input.ends_at && input.starts_at && new Date(input.ends_at).getTime() <= new Date(input.starts_at).getTime()) throw new Error('The end time must be after the start time.')
  return { ...input, slug, internal_name: input.internal_name.trim(), sections: sections.slice(0, 32) }
}
