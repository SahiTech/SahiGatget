import { redirect } from 'next/navigation'
import { getAnalyticsConfig } from '@/lib/analytics/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = await getAnalyticsConfig()
  const id = config.gtmContainerId.trim().toUpperCase()
  if (!config.enabled || !/^GTM-[A-Z0-9]+$/i.test(id)) {
    return new Response(null, { status: 204 })
  }
  redirect(`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(id)}`)
}
