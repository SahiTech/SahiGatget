import type { MetadataRoute } from 'next'

import { siteConfig } from '@/config/site'
import { getPublicSitemapEntries } from '@/lib/services/storefront'

const publicRoutes = [
  { path: '/', priority: 1, changeFrequency: 'daily' as const },
  { path: '/products', priority: 0.9, changeFrequency: 'daily' as const },
  { path: '/brands', priority: 0.8, changeFrequency: 'weekly' as const },
  { path: '/categories', priority: 0.8, changeFrequency: 'weekly' as const },
  { path: '/help', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/warranty', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/shipping', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/returns', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/terms', priority: 0.4, changeFrequency: 'yearly' as const },
  { path: '/privacy', priority: 0.4, changeFrequency: 'yearly' as const },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' as const },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getPublicSitemapEntries()
  const baseEntries = publicRoutes.map((route) => ({ url: `${siteConfig.url}${route.path}`, priority: route.priority, changeFrequency: route.changeFrequency }))
  const productEntries = entries.products.map((entry) => ({ url: `${siteConfig.url}/products/${encodeURIComponent(entry.slug)}`, lastModified: entry.lastModified, changeFrequency: 'weekly' as const, priority: 0.8 }))
  const brandEntries = entries.brands.map((entry) => ({ url: `${siteConfig.url}/brands/${encodeURIComponent(entry.slug)}`, lastModified: entry.lastModified, changeFrequency: 'weekly' as const, priority: 0.7 }))
  return [...baseEntries, ...productEntries, ...brandEntries]
}
