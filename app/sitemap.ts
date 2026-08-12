import type { MetadataRoute } from 'next'

import { siteConfig } from '@/config/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['/', '/products', '/brands', '/categories', '/search']
  return routes.map((route) => ({ url: `${siteConfig.url}${route}`, lastModified: new Date(), changeFrequency: route === '/' ? 'daily' : 'weekly', priority: route === '/' ? 1 : 0.7 }))
}
