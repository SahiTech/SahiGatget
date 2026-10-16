import { NextResponse } from 'next/server'
import { getAnalyticsConfig } from '@/lib/analytics/server'

export const revalidate = 0

export async function GET() {
  const config = await getAnalyticsConfig()
  return NextResponse.json({
    projectKey: config.projectKey,
    currency: config.currency,
    enabled: config.enabled,
    marketingEnabled: config.marketingEnabled,
    ga4MeasurementId: config.ga4MeasurementId,
    gtmContainerId: config.gtmContainerId,
    metaPixelId: config.metaPixelId,
    tiktokPixelId: config.tiktokPixelId,
    ga4ServerDeliveryEnabled: Boolean(config.ga4MeasurementId && process.env.GA4_API_SECRET),
    eventControls: config.eventControls,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
