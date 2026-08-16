import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { siteConfig } from '@/config/site'
import { getPublicLandingPage } from '@/lib/landing-pages/data'
import { LandingPageRenderer } from '@/components/landing-pages/landing-page-renderer'

export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getPublicLandingPage(slug)
  if (!page) return { title: 'Landing Page Not Found | SahiGadget' }
  const title = page.seo_title || page.internal_name
  const description = page.seo_description || `Explore ${page.internal_name} at SahiGadget.`
  const canonical = `${siteConfig.url}/landing/${page.slug}`
  return { title, description, alternates: { canonical }, robots: page.noindex ? { index: false, follow: false } : { index: true, follow: true }, openGraph: { title, description, url: canonical, type: 'website', images: page.og_image_url ? [{ url: page.og_image_url, alt: title }] : undefined }, twitter: { card: 'summary_large_image', title, description, images: page.og_image_url ? [page.og_image_url] : undefined } }
}

export default async function LandingPage({ params }: Props) {
  const { slug } = await params
  const page = await getPublicLandingPage(slug)
  if (!page) notFound()
  const product = page.linked_product
  const jsonLd = product ? { '@context': 'https://schema.org', '@type': 'Product', '@id': `${siteConfig.url}/products/${product.slug}#product`, name: product.name, url: `${siteConfig.url}/products/${product.slug}`, description: product.description || product.short_description || undefined, image: product.images.map((image) => image.image_url), brand: product.brand?.name ? { '@type': 'Brand', name: product.brand.name } : undefined } : null
  return <><LandingPageRenderer page={page} />{jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}</>
}
