import type { LandingPage } from '@/lib/landing-pages/types'
import type { StorefrontProduct } from '@/lib/services/storefront-utils'
import { LandingConversionSections } from './landing-conversion-sections'
import { SiteFooter } from '@/components/layout/site-footer'

export function LandingPageRenderer({ page }: { page: LandingPage }) {
  const products: StorefrontProduct[] = page.linked_product ? [page.linked_product] : (page.resolved_products ?? []).slice(0, 1)
  return <main data-analytics-event="landing_page_view" data-landing-page={page.slug} className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950"><div className="mx-auto max-w-5xl px-4 py-4 pb-24 sm:px-6 sm:py-6"><header className="mb-5 flex items-center justify-between gap-4" aria-label="SahiGadget trust header"><div className="text-sm font-black tracking-tight text-slate-950">SahiGadget</div><span className="text-xs font-semibold text-slate-500">ক্যাশ অন ডেলিভারি</span></header></div><LandingConversionSections sections={page.sections} products={products} fixedImageUrl={page.hero_image_url} /><SiteFooter /></main>
}
