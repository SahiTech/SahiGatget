import type { Metadata } from 'next'
import { getImageProps } from 'next/image'
import { preload } from 'react-dom'
import { notFound } from 'next/navigation'
import { siteConfig } from '@/config/site'
import { getPublicLandingPage } from '@/lib/landing-pages/data'
import { LandingPageRenderer } from '@/components/landing-pages/landing-page-renderer'

export const revalidate = 60
export const dynamic = 'force-static'

type Props = { params: Promise<{ slug: string }> }

const HERO_IMAGE_SIZES = '(max-width: 640px) 88vw, (max-width: 1024px) 92vw, 42vw'

function getInitialHeroImage(product: NonNullable<Awaited<ReturnType<typeof getPublicLandingPage>>>['linked_product']) {
  if (!product) return null
  const primaryImage = product.images.find((image) => image.is_primary) ?? product.images[0]
  const variant = product.variants.find((candidate) => candidate.is_in_stock) ?? product.variants[0]
  if (!variant) return primaryImage ?? null
  const linkedImage = product.images.find((image) => image.variant_id === variant.id)
  if (linkedImage) return linkedImage
  const tokens = [variant.color, variant.variant_title]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .split(/\s+|\//)
    .filter((token) => token.length > 2)
  return product.images.find((image) => tokens.some((token) => `${image.alt_text ?? ''} ${image.image_url}`.toLowerCase().includes(token))) ?? primaryImage ?? null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await getPublicLandingPage(slug)
  if (!page) return { title: `Landing Page Not Found | ${siteConfig.name}` }
  const title = page.seo_title || page.internal_name
  const description = page.seo_description || `Explore ${page.internal_name} at ${siteConfig.name}.`
  const canonical = `${siteConfig.url}/landing/${page.slug}`
  return { title, description, alternates: { canonical }, robots: page.noindex ? { index: false, follow: false } : { index: true, follow: true }, openGraph: { title, description, url: canonical, type: 'website', images: page.og_image_url ? [{ url: page.og_image_url, alt: title }] : undefined }, twitter: { card: 'summary_large_image', title, description, images: page.og_image_url ? [page.og_image_url] : undefined } }
}

export default async function LandingPage({ params }: Props) {
  const { slug } = await params
  const page = await getPublicLandingPage(slug)
  if (!page) notFound()
  const product = page.linked_product
  const heroImage = getInitialHeroImage(product) ?? (page.hero_image_url ? { image_url: page.hero_image_url, alt_text: product?.name ?? page.internal_name } : null)

  // Emit the responsive image preload from the server so the browser can discover
  // the LCP image before client-component hydration starts.
  if (heroImage?.image_url) {
    const { props: imageProps } = getImageProps({
      src: heroImage.image_url,
      alt: heroImage.alt_text || product?.name || page.internal_name,
      fill: true,
      sizes: HERO_IMAGE_SIZES,
    })
    preload(imageProps.src, {
      as: 'image',
      imageSrcSet: imageProps.srcSet,
      imageSizes: imageProps.sizes,
      fetchPriority: 'high',
    })
  }

  const jsonLd = product ? { '@context': 'https://schema.org', '@type': 'Product', '@id': `${siteConfig.url}/landing/${page.slug}#product`, name: product.name, url: `${siteConfig.url}/landing/${page.slug}`, description: product.description || product.short_description || undefined, image: product.images.map((image) => image.image_url), brand: product.brand?.name ? { '@type': 'Brand', name: product.brand.name } : undefined, offers: product.variants.filter((variant) => variant.is_in_stock).map((variant) => ({ '@type': 'Offer', priceCurrency: 'BDT', price: variant.price, availability: 'https://schema.org/InStock', url: `${siteConfig.url}/landing/${page.slug}` })) } : null
  return <><LandingPageRenderer page={page} />{jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}</>
}
