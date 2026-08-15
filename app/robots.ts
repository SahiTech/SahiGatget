import type { MetadataRoute } from 'next'

import { siteConfig } from '@/config/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/products', '/products/', '/categories', '/categories/', '/brands', '/brands/', '/help', '/warranty', '/shipping', '/returns', '/terms', '/privacy', '/contact'],
        disallow: ['/admin', '/admin/', '/api', '/api/', '/verify-order', '/verify-order/', '/track-order', '/track-order/', '/search'],
      },
      { userAgent: 'Googlebot', allow: '/', disallow: ['/admin', '/api', '/verify-order', '/track-order', '/search'] },
      { userAgent: 'Bingbot', allow: '/', disallow: ['/admin', '/api', '/verify-order', '/track-order', '/search'] },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: ['/admin', '/api', '/verify-order', '/track-order', '/search'] },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  }
}
